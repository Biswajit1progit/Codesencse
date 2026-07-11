import 'dotenv/config';
import mongoose from 'mongoose';
import Groq from 'groq-sdk';
import EvalCase from '../models/EvalCase.js';
import Repo from '../models/Repo.js';
import { embedText } from '../utils/embeddings.js';
import { searchChunks } from '../utils/vectorStore.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Score a single review against ground truth using LLM as judge
const scoreReview = async (generatedReview, groundTruth, prTitle, diff) => {
  const prompt = `You are an expert code review evaluator. Score this AI-generated code review against the ground truth.

PR Title: "${prTitle}"
PR Diff:
\`\`\`
${diff}
\`\`\`

Ground Truth — Issues the review SHOULD catch:
${groundTruth.shouldCatch.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Ground Truth — Things that are FINE (should NOT be flagged):
${groundTruth.shouldNotFlag.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Expected Verdict: ${groundTruth.expectedVerdict}

AI Generated Review:
${generatedReview}

Score the review on these 5 dimensions (0-10 each):

1. caughtRealIssues (0-10): How many of the ground truth issues did it catch?
   10 = caught all, 5 = caught half, 0 = caught none

2. falsePositives (0-10): Did it flag things that are actually fine?
   10 = no false positives, 5 = some minor false positives, 0 = many false positives

3. specificity (0-10): Does it reference actual function names, file names, line numbers?
   10 = very specific with real references, 5 = somewhat specific, 0 = completely generic

4. actionability (0-10): Is the feedback actionable — does it tell the developer what to fix?
   10 = every issue has a clear fix, 5 = some actionable feedback, 0 = vague complaints

5. verdictCorrect (0 or 10): Is the verdict (APPROVE/REQUEST_CHANGES/COMMENT) correct?
   10 = matches expected verdict exactly, 0 = wrong verdict

Return ONLY a JSON object with this exact structure, nothing else:
{
  "caughtRealIssues": 7,
  "falsePositives": 8,
  "specificity": 6,
  "actionability": 7,
  "verdictCorrect": 10,
  "reasoning": "brief explanation of scores"
}`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 512,
  });

  const content = completion.choices[0].message.content.trim();
  const clean = content.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

// Generate a review for a given diff using the same agent prompt
const generateReview = async (prTitle, diff, repoIdStr) => {
  const queryEmbedding = await embedText(prTitle);
  const chunks = await searchChunks(queryEmbedding, repoIdStr, 4);

  const context = chunks
    .map((c, i) =>
      `[${i + 1}] ${c.chunk_type} "${c.chunk_name}" in ${c.file_path}:\n\`\`\`\n${c.content.slice(0, 300)}\n\`\`\``
    )
    .join('\n\n');

  const prompt = `You are CodeSense, an expert code reviewer. Review this PR diff.

PR: "${prTitle}"

Codebase context:
${context}

PR Diff:
\`\`\`diff
${diff}
\`\`\`

Write a concise review in markdown. Include:
## 🤖 CodeSense Review
- Brief summary
- 🐛 Issues Found (if any)
- 🔒 Security (if any)
- ✅ Looks Good (if any)
- Overall verdict: APPROVE / REQUEST_CHANGES / COMMENT`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 800,
  });

  return completion.choices[0].message.content;
};

const runReviewEval = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected\n');

  const evalCases = await EvalCase.find({ type: 'review' });
  console.log(`Found ${evalCases.length} review eval cases\n`);
  console.log('='.repeat(60));

  // Get repoId for SafarSetu
  const repo = await Repo.findOne({
    fullName: evalCases[0]?.review?.repoFullName,
  }).select('_id');
  const repoIdStr = repo?._id?.toString();

  if (!repoIdStr) {
    console.error('Repo not found — make sure SafarSetu is connected and ingested');
    process.exit(1);
  }

  console.log(`Using repo: ${evalCases[0]?.review?.repoFullName} (${repoIdStr})\n`);

  const allScores = {
    caughtRealIssues: [],
    falsePositives: [],
    specificity: [],
    actionability: [],
    verdictCorrect: [],
    overall: [],
  };

  for (const evalCase of evalCases) {
    const { prTitle, diff, groundTruth } = evalCase.review;

    console.log(`\nPR: "${prTitle}"`);
    console.log(`Expected verdict: ${groundTruth.expectedVerdict}`);
    console.log(`Should catch: ${groundTruth.shouldCatch.length} issues`);

    try {
      // Generate review
      console.log('Generating review...');
      const generatedReview = await generateReview(prTitle, diff, repoIdStr);

      console.log('\nGenerated review:');
      console.log(generatedReview);
      console.log();

      // Score it
      console.log('Scoring...');
      const scores = await scoreReview(
        generatedReview,
        groundTruth,
        prTitle,
        diff
      );

      const overall =
        (scores.caughtRealIssues +
          scores.falsePositives +
          scores.specificity +
          scores.actionability +
          scores.verdictCorrect) / 5;

      console.log('\nScores:');
      console.log(`  Caught real issues:  ${scores.caughtRealIssues}/10`);
      console.log(`  False positives:     ${scores.falsePositives}/10`);
      console.log(`  Specificity:         ${scores.specificity}/10`);
      console.log(`  Actionability:       ${scores.actionability}/10`);
      console.log(`  Verdict correct:     ${scores.verdictCorrect}/10`);
      console.log(`  Overall:             ${overall.toFixed(1)}/10`);
      console.log(`  Reasoning:           ${scores.reasoning}`);
      console.log('-'.repeat(60));

      allScores.caughtRealIssues.push(scores.caughtRealIssues);
      allScores.falsePositives.push(scores.falsePositives);
      allScores.specificity.push(scores.specificity);
      allScores.actionability.push(scores.actionability);
      allScores.verdictCorrect.push(scores.verdictCorrect);
      allScores.overall.push(overall);

      // Save to MongoDB
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
        notes: scores.reasoning,
      });
      await evalCase.save();

      // Delay between cases
      await new Promise((r) => setTimeout(r, 3000));

    } catch (err) {
      console.error(`Error on "${prTitle}": ${err.message}`);
    }
  }

  // Summary
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  console.log('\n' + '='.repeat(60));
  console.log('REVIEW EVAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Cases evaluated:        ${evalCases.length}`);
  console.log(`Avg caught real issues: ${avg(allScores.caughtRealIssues).toFixed(1)}/10`);
  console.log(`Avg false positives:    ${avg(allScores.falsePositives).toFixed(1)}/10`);
  console.log(`Avg specificity:        ${avg(allScores.specificity).toFixed(1)}/10`);
  console.log(`Avg actionability:      ${avg(allScores.actionability).toFixed(1)}/10`);
  console.log(`Avg verdict correct:    ${avg(allScores.verdictCorrect).toFixed(1)}/10`);
  console.log(`Avg overall score:      ${avg(allScores.overall).toFixed(1)}/10`);
  console.log('='.repeat(60));
  console.log('\n✅ Results saved to MongoDB');

  await mongoose.disconnect();
};

runReviewEval().catch(console.error);