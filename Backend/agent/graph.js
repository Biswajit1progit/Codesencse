/* import { planNode, retrieveNode, analyzeNode, reviewNode } from './nodes.js';
import { createInitialState } from './state.js';
import { getInstallationOctokit, postPRComment } from '../utils/githubApp.js';
import Repo from '../models/Repo.js';
import Review from '../models/Review.js';

// Extract verdict from review text
const extractVerdict = (reviewText) => {
  if (reviewText.includes('APPROVE')) return 'APPROVE';
  if (reviewText.includes('REQUEST_CHANGES')) return 'REQUEST_CHANGES';
  if (reviewText.includes('SKIP')) return 'SKIP';
  return 'COMMENT';
};

export const runReviewAgent = async (prData) => {
  console.log('\n🚀 Starting CodeSense Review Agent');
  console.log(`PR: #${prData.pullNumber} in ${prData.owner}/${prData.repo}`);

  let state = createInitialState(prData);

  try {
    // Run all nodes
    state = await planNode(state);
    state = await retrieveNode(state);
    state = await analyzeNode(state);
    state = await reviewNode(state);

    // Post to GitHub
    console.log('\n--- POST NODE ---');
    const octokit = await getInstallationOctokit(prData.installationId);
    await postPRComment(
      octokit,
      prData.owner,
      prData.repo,
      prData.pullNumber,
      state.review
    );
    state.reviewPosted = true;
    state.trace = [
      ...state.trace,
      {
        step: 'POST',
        detail: `Review posted to PR #${prData.pullNumber}`,
        timestamp: new Date().toISOString(),
      },
    ];
    console.log(`✅ Review posted to PR #${prData.pullNumber}`);

    // Save to MongoDB
    console.log('\n--- SAVE NODE ---');
    const verdict = extractVerdict(state.review);

    await Review.findOneAndUpdate(
      {
        repoId: prData.repoId,
        pullNumber: prData.pullNumber,
      },
      {
        userId: prData.userId,
        repoId: prData.repoId,
        repoFullName: `${prData.owner}/${prData.repo}`,
        pullNumber: prData.pullNumber,
        prTitle: prData.prDetails.title,
        prAuthor: prData.prDetails.author,
        review: state.review,
        analysis: state.analysis || {},
        trace: state.trace,
        chunksUsed: state.retrievedChunks.length,
        verdict,
        diffStats: {
          additions: prData.prDetails.additions,
          deletions: prData.prDetails.deletions,
          changedFiles: prData.prDetails.changedFiles,
        },
      },
      { upsert: true, returnDocument: 'after' }

    );

    state.trace = [
      ...state.trace,
      {
        step: 'SAVE',
        detail: 'Review saved to database',
        timestamp: new Date().toISOString(),
      },
    ];
    console.log('✅ Review saved to MongoDB');

  } catch (err) {
    console.error('Agent error:', err.message);
    state.error = err.message;
  }

  console.log('\n📋 Agent trace:');
  state.trace.forEach((t) => console.log(`  [${t.step}] ${t.detail}`));

  return state;
}; */


import { planNode, retrieveNode,gradeNode, analyzeNode, reviewNode } from './nodes.js';
import { createInitialState } from './state.js';
import { getInstallationOctokit, postPRComment, postInlineReview } from '../utils/githubApp.js'; // CHANGED — added postInlineReview
import { buildValidLineMap } from '../utils/diffParser.js'; // NEW
import Repo from '../models/Repo.js';
import Review from '../models/Review.js';

// Extract verdict from review text
const extractVerdict = (reviewText) => {
  if (reviewText.includes('APPROVE')) return 'APPROVE';
  if (reviewText.includes('REQUEST_CHANGES')) return 'REQUEST_CHANGES';
  if (reviewText.includes('SKIP')) return 'SKIP';
  return 'COMMENT';
};

// NEW — maps your internal verdict to GitHub's review event enum
const verdictToGithubEvent = (verdict) => {
  if (verdict === 'APPROVE') return 'APPROVE';
  if (verdict === 'REQUEST_CHANGES') return 'REQUEST_CHANGES';
  return 'COMMENT'; // COMMENT and SKIP both post as a plain comment review
};

// NEW — builds the inline comments array from analysis.findings, dropping
// any finding whose line isn't actually visible in that file's diff hunk
const buildInlineComments = (findings, diffFiles) => {
  if (!findings || findings.length === 0) return [];

  const validLineMap = buildValidLineMap(diffFiles);
  const comments = [];

  for (const finding of findings) {
    const validLines = validLineMap[finding.file];
    if (!validLines || !validLines.has(finding.line)) {
      console.log(`⚠️ Skipping finding — line ${finding.line} not in diff for ${finding.file}`);
      continue;
    }
    const icon = finding.severity === 'high' || finding.severity === 'critical' ? '🔴' : '🟡';
    comments.push({
      path: finding.file,
      line: finding.line,
      side: 'RIGHT',
      body: `${icon} **[${finding.category}]** ${finding.message}`,
    });
  }

  return comments;
};

export const runReviewAgent = async (prData) => {
  console.log('\n🚀 Starting CodeSense Review Agent');
  console.log(`PR: #${prData.pullNumber} in ${prData.owner}/${prData.repo}`);

  let state = createInitialState(prData);

  try {
    // Run all nodes
    state = await planNode(state);
    state = await retrieveNode(state);
    state = await gradeNode(state);
    state = await analyzeNode(state);
    state = await reviewNode(state);

    // Post to GitHub
    console.log('\n--- POST NODE ---');
    const octokit = await getInstallationOctokit(prData.installationId);

    // NEW — determine verdict early so we can pick the right GitHub event
    const verdict = extractVerdict(state.review);
    const githubEvent = verdictToGithubEvent(verdict);

    // NEW — build inline comments from findings, validated against the diff
    const inlineComments = state.plan.skip
      ? []
      : buildInlineComments(state.analysis.findings, state.plan.diffSummary.files);

    let inlineCommentsPosted = 0;

    try {
      // CHANGED — try inline review first
      await postInlineReview(
        octokit,
        prData.owner,
        prData.repo,
        prData.pullNumber,
        { body: state.review, comments: inlineComments, event: githubEvent }
      );
      inlineCommentsPosted = inlineComments.length;
      console.log(`✅ Posted review with ${inlineCommentsPosted} inline comments`);
    } catch (inlineErr) {
      // NEW — fallback: if inline review fails for any reason (bad line, API quirk),
      // never let the whole review silently fail — fall back to the old summary-only comment
      console.error('Inline review failed, falling back to summary comment:', inlineErr.message);
      await postPRComment(octokit, prData.owner, prData.repo, prData.pullNumber, state.review);
      inlineCommentsPosted = 0;
    }

    state.reviewPosted = true;
    state.trace = [
      ...state.trace,
      {
        step: 'POST',
        detail: `Review posted to PR #${prData.pullNumber} (${inlineCommentsPosted} inline comments)`, // CHANGED
        timestamp: new Date().toISOString(),
      },
    ];
    console.log(`✅ Review posted to PR #${prData.pullNumber}`);

    // Save to MongoDB
    console.log('\n--- SAVE NODE ---');

    await Review.findOneAndUpdate(
      {
        repoId: prData.repoId,
        pullNumber: prData.pullNumber,
      },
      {
        userId: prData.userId,
        repoId: prData.repoId,
        repoFullName: `${prData.owner}/${prData.repo}`,
        pullNumber: prData.pullNumber,
        prTitle: prData.prDetails.title,
        prAuthor: prData.prDetails.author,
        review: state.review,
        analysis: state.analysis || {},
        trace: state.trace,
        chunksUsed: state.retrievedChunks.length,
        verdict,
        inlineCommentsCount: inlineCommentsPosted, // NEW — only written if your Review schema allows extra fields; if you have `strict: true` on the schema, add this field to the schema first
        diffStats: {
          additions: prData.prDetails.additions,
          deletions: prData.prDetails.deletions,
          changedFiles: prData.prDetails.changedFiles,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    state.trace = [
      ...state.trace,
      {
        step: 'SAVE',
        detail: 'Review saved to database',
        timestamp: new Date().toISOString(),
      },
    ];
    console.log('✅ Review saved to MongoDB');

  } catch (err) {
    console.error('Agent error:', err.message);
    state.error = err.message;
  }

  console.log('\n📋 Agent trace:');
  state.trace.forEach((t) => console.log(`  [${t.step}] ${t.detail}`));

  return state;
};