import express from 'express';
import Groq from 'groq-sdk';
import verifyToken from '../middleware/verifyToken.js';
import EvalCase from '../models/EvalCase.js';
import Repo from '../models/Repo.js';
import { embedText } from '../utils/embeddings.js';
import { searchChunks } from '../utils/vectorStore.js';
import { trackedGroqCall } from '../utils/trackedGroqCall.js';
import { planNode, retrieveNode, gradeNode, analyzeNode, reviewNode } from '../agent/nodes.js'; // NEW
import { parseDiffString } from '../utils/diffStringParser.js'; // NEW
import { AGENT_PROMPT_VERSION,EVAL_PROMPT_VERSION } from '../utils/promptVersions.js';

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

  const triggeredByUserId = req.userId; // capture before responding, since runEvals() is async/detached

  res.json({ message: 'Eval started', status: 'running' });

  evalRunning = true;
  evalProgress = { status: 'running', step: 'Starting...', progress: 0, total: 0 };

  runEvals(triggeredByUserId).catch((err) => {
    console.error('Eval run error:', err.message);
    evalProgress = { status: 'failed', step: err.message, progress: 0, total: 0 };
    evalRunning = false;
  });
});

const runEvals = async (triggeredByUserId) => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const TOP_K = 8;
  // REMOVED: const PROMPT_VERSION = 'v1.0';  ← this was shadowing the imported EVAL_PROMPT_VERSION and was never actually used correctly

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
        promptVersion: EVAL_PROMPT_VERSION, // CHANGED — was PROMPT_VERSION
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

  for (let i = 0; i < reviewCases.length; i++) {
  const evalCase = reviewCases[i];
  const { prTitle, diff, groundTruth, repoFullName } = evalCase.review;

  evalProgress.step = `Review ${i + 1}/${reviewCases.length}: "${prTitle.slice(0, 40)}..."`;
  evalProgress.progress = i + 1;

  try {
    const repo = await Repo.findOne({ fullName: repoFullName }).select('_id');
    const repoIdStr = repo?._id?.toString();

    // NEW — build state exactly like the live agent, then run the REAL pipeline
    const parsedFiles = parseDiffString(diff);

    let state = {
      owner: repoFullName?.split('/')[0] || 'unknown',
      repo: repoFullName?.split('/')[1] || 'unknown',
      pullNumber: evalCase.review.prNumber || 0,
      repoId: repoIdStr,
      installationId: null, // not needed — eval stops before POST
      userId: triggeredByUserId,
      prDetails: {
        title: prTitle,
        author: 'eval-harness',
        additions: parsedFiles.reduce((s, f) => s + f.additions, 0),
        deletions: parsedFiles.reduce((s, f) => s + f.deletions, 0),
        changedFiles: parsedFiles.length,
      },
      diff: parsedFiles,
      plan: null,
      retrievedChunks: [],
      analysis: null,
      review: null,
      reviewPosted: false,
      trace: [],
      error: null,
    };

    // CHANGED — this now calls the exact same code that runs on real PRs, including gradeNode
    state = await planNode(state);
    state = await retrieveNode(state);
    state = await gradeNode(state);
    state = await analyzeNode(state);
    state = await reviewNode(state);

    const generatedReview = state.review;

    // Score it — dedicated eval-only prompt, still tagged with EVAL_PROMPT_VERSION
    const { response: scoreCompletion } = await trackedGroqCall({
      context: 'eval_run',
      callKind: 'score',
      userId: triggeredByUserId,
      repoFullName,
      evalCaseId: evalCase._id,
      model: 'openai/gpt-oss-120b',
      promptVersion: EVAL_PROMPT_VERSION,
      callFn: () => groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [{
          role: 'user',
          content: `Score this code review on 5 dimensions (0-10 each).

Ground Truth issues: ${groundTruth.shouldCatch.join(', ')}
Expected verdict: ${groundTruth.expectedVerdict}

Review:
${generatedReview}

Return ONLY JSON:Return ONLY valid JSON, no markdown formatting, no code fences. The "reasoning" field must be a single line with no quotation marks or line breaks inside it.
{"caughtRealIssues":7,"falsePositives":8,"specificity":6,"actionability":7,"verdictCorrect":10,"reasoning":"brief explanation"}`,
        }],
        temperature: 0.1,
        max_tokens: 512,
      }),
    });

    /* const scoreContent = scoreCompletion.choices[0].message.content
      .trim()
      .replace(/```json|```/g, '')
      .trim();
    const scores = JSON.parse(scoreContent); */
    const scoreContent = scoreCompletion.choices[0].message.content
  .trim()
  .replace(/```json|```/g, '')
  .trim();

let scores;
try {
  scores = JSON.parse(scoreContent);
} catch {
  // NEW — repair attempt: pull the 5 numeric fields via regex even if "reasoning" broke the JSON
  const numMatch = (key) => {
    const m = scoreContent.match(new RegExp(`"${key}"\\s*:\\s*(\\d+(\\.\\d+)?)`));
    return m ? parseFloat(m[1]) : null;
  };
  const repaired = {
    caughtRealIssues: numMatch('caughtRealIssues'),
    falsePositives: numMatch('falsePositives'),
    specificity: numMatch('specificity'),
    actionability: numMatch('actionability'),
    verdictCorrect: numMatch('verdictCorrect'),
    reasoning: 'parse error — reasoning field dropped',
  };
  if ([repaired.caughtRealIssues, repaired.falsePositives, repaired.specificity, repaired.actionability, repaired.verdictCorrect].some(v => v === null)) {
    throw new Error('Could not repair malformed scoring JSON');
  }
  scores = repaired;
}
    const overall =
      (scores.caughtRealIssues +
        scores.falsePositives +
        scores.specificity +
        scores.actionability +
        scores.verdictCorrect) / 5;

    evalCase.results.push({
      runAt: new Date(),
      promptVersion: AGENT_PROMPT_VERSION, // CHANGED — tags which nodes.js version generated this review, not the eval harness version
      rubricScores: {
        caughtRealIssues: scores.caughtRealIssues,
        falsePositives: scores.falsePositives,
        specificity: scores.specificity,
        actionability: scores.actionability,
        verdictCorrect: scores.verdictCorrect,
      },
      overallScore: overall,
      notes: `${scores.reasoning} — real agent pipeline, ${state.retrievedChunks.length} chunks after grading`,
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

// GET /api/evals/versions — compare metrics across all promptVersions ever run
router.get('/versions', verifyToken, async (req, res) => {
  try {
    const retrievalCases = await EvalCase.find({ type: 'retrieval' });
    const reviewCases = await EvalCase.find({ type: 'review' });

    const retrievalByVersion = {};
    for (const evalCase of retrievalCases) {
      for (const result of evalCase.results || []) {
        const v = result.promptVersion || 'unversioned';
        if (!retrievalByVersion[v]) retrievalByVersion[v] = { precisions: [], recalls: [], runs: 0, lastRunAt: null };
        retrievalByVersion[v].precisions.push(result.precision || 0);
        retrievalByVersion[v].recalls.push(result.recall || 0);
        retrievalByVersion[v].runs++;
        if (!retrievalByVersion[v].lastRunAt || result.runAt > retrievalByVersion[v].lastRunAt) {
          retrievalByVersion[v].lastRunAt = result.runAt;
        }
      }
    }

    const reviewByVersion = {};
    for (const evalCase of reviewCases) {
      for (const result of evalCase.results || []) {
        const v = result.promptVersion || 'unversioned';
        if (!reviewByVersion[v]) {
          reviewByVersion[v] = {
            overallScores: [],
            rubric: { caughtRealIssues: [], falsePositives: [], specificity: [], actionability: [], verdictCorrect: [] },
            runs: 0,
            lastRunAt: null,
          };
        }
        reviewByVersion[v].overallScores.push(result.overallScore || 0);
        for (const key of Object.keys(reviewByVersion[v].rubric)) {
          reviewByVersion[v].rubric[key].push(result.rubricScores?.[key] || 0);
        }
        reviewByVersion[v].runs++;
        if (!reviewByVersion[v].lastRunAt || result.runAt > reviewByVersion[v].lastRunAt) {
          reviewByVersion[v].lastRunAt = result.runAt;
        }
      }
    }

    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const retrievalVersions = Object.entries(retrievalByVersion).map(([version, data]) => ({
      version,
      runs: data.runs,
      lastRunAt: data.lastRunAt,
      avgPrecision: avg(data.precisions),
      avgRecall: avg(data.recalls),
    })).sort((a, b) => new Date(a.lastRunAt) - new Date(b.lastRunAt));

    const reviewVersions = Object.entries(reviewByVersion).map(([version, data]) => ({
      version,
      runs: data.runs,
      lastRunAt: data.lastRunAt,
      avgOverallScore: avg(data.overallScores),
      rubricAvgs: {
        caughtRealIssues: avg(data.rubric.caughtRealIssues),
        falsePositives: avg(data.rubric.falsePositives),
        specificity: avg(data.rubric.specificity),
        actionability: avg(data.rubric.actionability),
        verdictCorrect: avg(data.rubric.verdictCorrect),
      },
    })).sort((a, b) => new Date(a.lastRunAt) - new Date(b.lastRunAt));

    res.json({ retrievalVersions, reviewVersions });
  } catch (err) {
    console.error('Eval versions error:', err.message);
    res.status(500).json({ message: 'Failed to fetch version comparison' });
  }
});

export default router;