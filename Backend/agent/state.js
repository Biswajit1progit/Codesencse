// Agent state — passed between every node in the graph
// Each node reads from state and returns updated state

export const createInitialState = (prData) => ({
  // Input — set once at start
  owner: prData.owner,
  repo: prData.repo,
  pullNumber: prData.pullNumber,
  repoId: prData.repoId,
  installationId: prData.installationId,
  prDetails: prData.prDetails,
  diff: prData.diff,

  // Populated by agent nodes
  plan: null,              // what the agent decided to do
  retrievedChunks: [],     // relevant code chunks from pgvector
  analysis: null,          // analysis of the diff
  review: null,            // final structured review
  reviewPosted: false,     // whether comment was posted to GitHub

  // Reasoning trace — stored for UI display later
  trace: [],

  // Error handling
  error: null,
});