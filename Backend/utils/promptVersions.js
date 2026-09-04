// Single source of truth for prompt version tags.
// Bump the relevant constant whenever you actually change that prompt's wording —
// this is what makes the eval Versions tab and cost/latency breakdown meaningful.
// Never bump these without also updating evals/CHANGELOG.md with what changed and why.

export const EVAL_PROMPT_VERSION = 'v1.0';   // covers evals.js — retrieval + review-generation + scoring prompts
export const AGENT_PROMPT_VERSION = 'v1.1';  // covers nodes.js — planNode, analyzeNode, reviewNode (live PR reviews)
export const QA_PROMPT_VERSION = 'v1.0';     // covers qa.js — codebase Q&A prompt