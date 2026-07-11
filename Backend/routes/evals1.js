/* import { EventEmitter } from 'events';

// Track running eval state
let evalRunning = false;
let evalProgress = { status: 'idle', step: '', progress: 0, total: 0 };

// GET /api/evals/status — poll for progress
router.get('/status', verifyToken, (req, res) => {
  res.json({ running: evalRunning, ...evalProgress });
});

// POST /api/evals/run — trigger full eval run
router.post('/run', verifyToken, async (req, res) => {
  if (evalRunning) {
    return res.status(409).json({ message: 'Eval already running' });
  }

  // Respond immediately — eval runs in background
  res.json({ message: 'Eval started', status: 'running' });

  evalRunning = true;
  evalProgress = { status: 'running', step: 'Starting...', progress: 0, total: 0 };

  try {
    const Groq = (await import('groq-sdk')).default;
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const { embedText } = await import('../utils/embeddings.js');
    const { searchChunks } = await import('../utils/vectorStore.js');

    // ── RETRIEVAL EVAL ──
    const retrievalCases = await EvalCase.find({ type: 'retrieval' });
    evalProgress = { status: 'running', step: 'Running retrieval eval...', progress: 0, total: retrievalCases.length };

    const TOP_K = 8;

    const isRelevant = (chunk, relevantFiles, relevantFunctions) => {
      const chunkFile = chunk.file_path?.toLowerCase() || '';
      const chunkName = chunk.chunk_name?.toLowerCase() || '';
      const fileMatch = relevantFiles.some(f => chunkFile.includes(f.toLowerCase().split('/').pop()));
      const functionMatch = relevantFunctions.some(fn => chunkName.includes(fn.toLowerCase()));
      return fileMatch || functionMatch;
    };

    for (let i = 0; i < retrievalCases.length; i++) {
      const evalCase = retrievalCases[i];
      const { query, repoId, relevantFiles, relevantFunctions } = evalCase.retrieval;

      evalProgress.step = `Retrieval ${i + 1}/${retrievalCases.length}: "${query.slice(0, 40)}..."`;
      evalProgress.progress = i + 1;

      try {
        const queryEmbedding = await embedText(query);
        const chunks = await searchChunks(queryEmbedding, repoId, TOP_K);

        const relevantCount = chunks.filter(c => isRelevant(c, relevantFiles, relevantFunctions)).length;
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
        console.error(`Retrieval eval error: ${err.message}`);
      }
    }

    // ── REVIEW EVAL ──
    const reviewCases = await EvalCase.find({ type: 'review' });
    evalProgress = { status: 'running', step: 'Running review eval...', progress: 0, total: reviewCases.length };

    const Repo = (await import('../models/Repo.js')).default;
    const repo = await Repo.findOne({ fullName: reviewCases[0]?.review?.repoFullName }).select('_id');
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
        const context = chunks.map((c, idx) =>
          `[${idx + 1}] ${c.chunk_type} "${c.chunk_name}" in ${c.file_path}:\n\`\`\`\n${c.content.slice(0, 300)}\n\`\`\``
        ).join('\n\n');

        const generateCompletion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'user',
            content: `You are CodeSense, an expert code reviewer. Review this PR diff.

PR: "${prTitle}"
Codebase context: ${context}
PR Diff: \`\`\`diff\n${diff}\n\`\`\`

Write a concise review in markdown with verdict: APPROVE / REQUEST_CHANGES / COMMENT`
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
            content: `Score this code review (0-10 each dimension).

Ground Truth issues: ${groundTruth.shouldCatch.join(', ')}
Expected verdict: ${groundTruth.expectedVerdict}
Review: ${generatedReview}

Return ONLY JSON:
{"caughtRealIssues":7,"falsePositives":8,"specificity":6,"actionability":7,"verdictCorrect":10,"reasoning":"brief"}`
          }],
          temperature: 0.1,
          max_tokens: 256,
        });

        const scoreContent = scoreCompletion.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
        const scores = JSON.parse(scoreContent);
        const overall = (scores.caughtRealIssues + scores.falsePositives + scores.specificity + scores.actionability + scores.verdictCorrect) / 5;

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
        console.error(`Review eval error: ${err.message}`);
      }
    }

    evalProgress = { status: 'completed', step: 'Eval complete', progress: 0, total: 0 };

  } catch (err) {
    console.error('Eval run error:', err.message);
    evalProgress = { status: 'failed', step: err.message, progress: 0, total: 0 };
  } finally {
    evalRunning = false;
  }
}); */