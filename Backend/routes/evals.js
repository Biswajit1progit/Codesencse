import express from 'express';
import Groq from 'groq-sdk';
import verifyToken from '../middleware/verifyToken.js';
import EvalCase from '../models/EvalCase.js';
import Repo from '../models/Repo.js';
import { embedText } from '../utils/embeddings.js';
import { searchChunks } from '../utils/vectorStore.js';

const router = express.Router();

// Track running eval state — module level so it persists between requests
let evalRunning = false;
let evalProgress = { status: 'idle', step: '', progress: 0, total: 0 };

// GET /api/evals/status
router.get('/status', verifyToken, (req, res) => {
  res.json({ running: evalRunning, ...evalProgress });
});

// POST /api/evals/run — trigger full eval run from dashboard
router.post('/run', verifyToken, async (req, res) => {
  if (evalRunning) {
    return res.status(409).json({ message: 'Eval already running' });
  }

  // Respond immediately — eval runs in background
  res.json({ message: 'Eval started', status: 'running' });

  evalRunning = true;
  evalProgress = { status: 'running', step: 'Starting...', progress: 0, total: 0 };

  // Run async in background
  runEvals().catch((err) => {
    console.error('Eval run error:', err.message);
    evalProgress = { status: 'failed', step: err.message, progress: 0, total: 0 };
    evalRunning = false;
  });
});

const runEvals = async () => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const TOP_K = 8;

  const isRelevant = (chunk, relevantFiles, relevantFunctions) => {
    const chunkFile = chunk.file_path?.toLowerCase() || '';
    const chunkName = chunk.chunk_name?.toLowerCase() || '';
    const fileMatch = relevantFiles.some(f =>
      chunkFile.includes(f.toLowerCase().split('/').pop())
    );
    const functionMatch = relevantFunctions.some(fn =>
      chunkName.includes(fn.toLowerCase())
    );
    return fileMatch || functionMatch;
  };

  // ── RETRIEVAL EVAL ──
  const retrievalCases = await EvalCase.find({ type: 'retrieval' });
  evalProgress = {
    status: 'running',
    step: 'Running retrieval eval...',
    progress: 0,
    total: retrievalCases.length,
  };

  for (let i = 0; i < retrievalCases.length; i++) {
    const evalCase = retrievalCases[i];
    const { query, repoId, relevantFiles, relevantFunctions } = evalCase.retrieval;

    evalProgress.step = `Retrieval ${i + 1}/${retrievalCases.length}: "${query.slice(0, 40)}..."`;
    evalProgress.progress = i + 1;

    try {
      const queryEmbedding = await embedText(query);
      const chunks = await searchChunks(queryEmbedding, repoId, TOP_K);

      const relevantCount = chunks.filter(c =>
        isRelevant(c, relevantFiles, relevantFunctions)
      ).length;
      const precision = chunks.length > 0 ? relevantCount / chunks.length : 0;

      const allRelevant = [...relevantFiles, ...relevantFunctions];
      const foundItems = new Set();
      for (const chunk of chunks) {
        const chunkFile = chunk.file_path?.toLowerCase() || '';
        const chunkName = chunk.chunk_name?.toLowerCase() || '';
        for (const f of relevantFiles) {
          if (chunkFile.includes(f.toLowerCase().split('/').pop())) foundItems.add(f);
        }
        for (const fn of relevantFunctions) {
          if (chunkName.includes(fn.toLowerCase())) foundItems.add(fn);
        }
      }
      const recall = allRelevant.length > 0 ? foundItems.size / allRelevant.length : 1;

      evalCase.results.push({
        runAt: new Date(),
        precision,
        recall,
        notes: `topK=${TOP_K} — triggered from dashboard`,
      });
      await evalCase.save();

      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`Retrieval eval error on "${query}": ${err.message}`);
    }
  }

  // ── REVIEW EVAL ──
  const reviewCases = await EvalCase.find({ type: 'review' });
  evalProgress = {
    status: 'running',
    step: 'Running review eval...',
    progress: 0,
    total: reviewCases.length,
  };

  const repo = await Repo.findOne({
    fullName: reviewCases[0]?.review?.repoFullName,
  }).select('_id');
  const repoIdStr = repo?._id?.toString();

  for (let i = 0; i < reviewCases.length; i++) {
    const evalCase = reviewCases[i];
    const { prTitle, diff, groundTruth } = evalCase.review;

    evalProgress.step = `Review ${i + 1}/${reviewCases.length}: "${prTitle.slice(0, 40)}..."`;
    evalProgress.progress = i + 1;

    try {
      // Generate review
      const queryEmbedding = await embedText(prTitle);
      const chunks = await searchChunks(queryEmbedding, repoIdStr, 4);
      const context = chunks
        .map((c, idx) =>
          `[${idx + 1}] ${c.chunk_type} "${c.chunk_name}" in ${c.file_path}:\n\`\`\`\n${c.content.slice(0, 300)}\n\`\`\``
        )
        .join('\n\n');

      const generateCompletion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `You are CodeSense, an expert code reviewer. Review this PR diff.

PR: "${prTitle}"
Codebase context:
${context}

PR Diff:
\`\`\`diff
${diff}
\`\`\`

Write a concise review in markdown. Include verdict: APPROVE / REQUEST_CHANGES / COMMENT`,
        }],
        temperature: 0.1,
        max_tokens: 800,
      });

      const generatedReview = generateCompletion.choices[0].message.content;

      // Score it
      const scoreCompletion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `Score this code review on 5 dimensions (0-10 each).

Ground Truth issues: ${groundTruth.shouldCatch.join(', ')}
Expected verdict: ${groundTruth.expectedVerdict}

Review:
${generatedReview}

Return ONLY JSON:
{"caughtRealIssues":7,"falsePositives":8,"specificity":6,"actionability":7,"verdictCorrect":10,"reasoning":"brief explanation"}`,
        }],
        temperature: 0.1,
        max_tokens: 256,
      });

      const scoreContent = scoreCompletion.choices[0].message.content
        .trim()
        .replace(/```json|```/g, '')
        .trim();
      const scores = JSON.parse(scoreContent);
      const overall =
        (scores.caughtRealIssues +
          scores.falsePositives +
          scores.specificity +
          scores.actionability +
          scores.verdictCorrect) / 5;

      evalCase.results.push({
        runAt: new Date(),
        rubricScores: {
          caughtRealIssues: scores.caughtRealIssues,
          falsePositives: scores.falsePositives,
          specificity: scores.specificity,
          actionability: scores.actionability,
          verdictCorrect: scores.verdictCorrect,
        },
        overallScore: overall,
        notes: scores.reasoning + ' — triggered from dashboard',
      });
      await evalCase.save();

      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`Review eval error on "${prTitle}": ${err.message}`);
    }
  }

  evalProgress = { status: 'completed', step: 'Eval complete ✅', progress: 0, total: 0 };
  evalRunning = false;
  console.log('✅ Dashboard eval run complete');
};

// GET /api/evals/summary
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const retrievalCases = await EvalCase.find({ type: 'retrieval' });
    const reviewCases = await EvalCase.find({ type: 'review' });

    const getLatestResult = (evalCase) => {
      if (!evalCase.results || evalCase.results.length === 0) return null;
      return evalCase.results[evalCase.results.length - 1];
    };

    const retrievalResults = retrievalCases.map(getLatestResult).filter(Boolean);

    const avgPrecision = retrievalResults.length
      ? retrievalResults.reduce((sum, r) => sum + (r.precision || 0), 0) / retrievalResults.length
      : 0;

    const avgRecall = retrievalResults.length
      ? retrievalResults.reduce((sum, r) => sum + (r.recall || 0), 0) / retrievalResults.length
      : 0;

    const tagMetrics = {};
    for (const evalCase of retrievalCases) {
      const result = getLatestResult(evalCase);
      if (!result) continue;
      for (const tag of evalCase.tags) {
        if (!tagMetrics[tag]) tagMetrics[tag] = { precisions: [], recalls: [] };
        tagMetrics[tag].precisions.push(result.precision || 0);
        tagMetrics[tag].recalls.push(result.recall || 0);
      }
    }

    const tagBreakdown = Object.entries(tagMetrics).map(([tag, scores]) => ({
      tag,
      precision: scores.precisions.reduce((a, b) => a + b, 0) / scores.precisions.length,
      recall: scores.recalls.reduce((a, b) => a + b, 0) / scores.recalls.length,
    }));

    const reviewResults = reviewCases.map(getLatestResult).filter(Boolean);

    const avgReviewScore = reviewResults.length
      ? reviewResults.reduce((sum, r) => sum + (r.overallScore || 0), 0) / reviewResults.length
      : 0;

    const rubricAvgs = {
      caughtRealIssues: 0,
      falsePositives: 0,
      specificity: 0,
      actionability: 0,
      verdictCorrect: 0,
    };

    if (reviewResults.length > 0) {
      for (const key of Object.keys(rubricAvgs)) {
        rubricAvgs[key] =
          reviewResults.reduce((sum, r) => sum + (r.rubricScores?.[key] || 0), 0) /
          reviewResults.length;
      }
    }

    const runHistory = [];
    for (const evalCase of [...retrievalCases, ...reviewCases]) {
      for (const result of evalCase.results || []) {
        runHistory.push({
          type: evalCase.type,
          runAt: result.runAt,
          precision: result.precision,
          recall: result.recall,
          overallScore: result.overallScore,
        });
      }
    }
    runHistory.sort((a, b) => new Date(a.runAt) - new Date(b.runAt));

    res.json({
      retrieval: { totalCases: retrievalCases.length, avgPrecision, avgRecall, tagBreakdown },
      review: { totalCases: reviewCases.length, avgOverallScore: avgReviewScore, rubricAvgs },
      runHistory,
    });
  } catch (err) {
    console.error('Eval summary error:', err.message);
    res.status(500).json({ message: 'Failed to fetch eval summary' });
  }
});

// GET /api/evals/cases
router.get('/cases', verifyToken, async (req, res) => {
  try {
    const cases = await EvalCase.find({}).sort({ type: 1, createdAt: 1 });
    const formatted = cases.map((c) => {
      const latest = c.results?.[c.results.length - 1] || null;
      return {
        id: c._id,
        type: c.type,
        tags: c.tags,
        query: c.retrieval?.query || c.review?.prTitle,
        latestPrecision: latest?.precision,
        latestRecall: latest?.recall,
        latestScore: latest?.overallScore,
        runCount: c.results?.length || 0,
      };
    });
    res.json({ cases: formatted });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch eval cases' });
  }
});

export default router;