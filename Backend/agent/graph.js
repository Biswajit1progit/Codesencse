import { planNode, retrieveNode, analyzeNode, reviewNode } from './nodes.js';
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
};