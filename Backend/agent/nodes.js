import Groq from 'groq-sdk';
import { retrieveContext, extractChangedFunctions, summarizeDiff } from './tools.js';
import { trackedGroqCall } from '../utils/trackedGroqCall.js'; // NEW
import { AGENT_PROMPT_VERSION } from '../utils/promptVersions.js'; // NEW

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const addTrace = (state, step, detail) => {
  console.log(`🤖 [${step}] ${detail}`);
  return [...state.trace, { step, detail, timestamp: new Date().toISOString() }];
};

// Node 1 — PLAN
export const planNode = async (state) => {
  console.log('\n--- PLAN NODE ---');
  const diffSummary = summarizeDiff(state.diff);

  if (diffSummary.jsFiles === 0) {
    return {
      ...state,
      plan: { skip: true, reason: 'No JS/TS files changed' },
      trace: addTrace(state, 'PLAN', 'No JS/TS files — skipping review'),
    };
  }

  const prompt = `You are a code review planning agent. Given this PR diff summary, decide what context to retrieve from the codebase to do a thorough review.

PR: "${state.prDetails.title}"
Author: ${state.prDetails.author}
Changed files: ${diffSummary.jsFiles} JS/TS files
Total changes: +${diffSummary.totalAdditions} -${diffSummary.totalDeletions}

Files changed:
${diffSummary.files.map(f => `- ${f.filename} (${f.status}: +${f.additions} -${f.deletions})`).join('\n')}

Generate 2-3 specific search queries to retrieve relevant context from the codebase. Return ONLY a JSON array of query strings, nothing else.
Example: ["how is auth middleware implemented", "where are database transactions used"]`;

  // CHANGED — wrapped with trackedGroqCall; prompt content and every downstream line unchanged
  const { response: completion } = await trackedGroqCall({
    context: 'pr_review',
    userId: state.userId,
    repoFullName: `${state.owner}/${state.repo}`,
    prNumber: state.pullNumber,
    callKind: 'plan',
    model: 'openai/gpt-oss-120b',
    promptVersion: AGENT_PROMPT_VERSION,
    callFn: () => groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 256,
    }),
  });

  let queries = [];
  try {
    const content = completion.choices[0].message.content.trim();
    const clean = content.replace(/```json|```/g, '').trim();
    queries = JSON.parse(clean);
  } catch {
    queries = diffSummary.files.map(f => `code in ${f.filename}`);
  }

  const plan = {
    skip: false,
    queries,
    diffSummary,
    changedFunctions: extractChangedFunctions(state.diff),
  };

  return {
    ...state,
    plan,
    trace: addTrace(state, 'PLAN', `Generated ${queries.length} retrieval queries: ${queries.join(' | ')}`),
  };
};

// Node 2 — RETRIEVE (unchanged — no Groq calls in this node)
export const retrieveNode = async (state) => {
  console.log('\n--- RETRIEVE NODE ---');

  if (state.plan.skip) {
    return {
      ...state,
      trace: addTrace(state, 'RETRIEVE', 'Skipped — no JS/TS files'),
    };
  }

  const allChunks = [];
  const seenIds = new Set();

  for (const query of state.plan.queries) {
    const chunks = await retrieveContext(query, state.repoId, 6);
    for (const chunk of chunks) {
      if (!seenIds.has(chunk.id)) {
        seenIds.add(chunk.id);
        allChunks.push(chunk);
      }
    }
  }

  const fileCounts = {};
  const diverseChunks = [];
  for (const chunk of allChunks) {
    const file = chunk.file_path;
    fileCounts[file] = (fileCounts[file] || 0) + 1;
    if (fileCounts[file] <= 2) {
      diverseChunks.push(chunk);
    }
  }

  console.log(`Retrieved ${diverseChunks.length} unique chunks (diversity filtered from ${allChunks.length})`);

  return {
    ...state,
    retrievedChunks: diverseChunks,
    trace: addTrace(state, 'RETRIEVE', `Retrieved ${diverseChunks.length} chunks from ${state.plan.queries.length} queries (diversity filtered)`),
  };
};
 

// Node 2.5 — GRADE (context grading, sits between RETRIEVE and ANALYZE)
export const gradeNode = async (state) => {
  console.log('\n--- GRADE NODE ---');

  if (state.plan.skip) {
    return {
      ...state,
      trace: addTrace(state, 'GRADE', 'Skipped — no JS/TS files'),
    };
  }

  if (state.retrievedChunks.length === 0) {
    return {
      ...state,
      trace: addTrace(state, 'GRADE', 'No chunks to grade'),
    };
  }

  const diffSummary = state.plan.diffSummary;
  const diffContext = diffSummary.files
    .map(f => `File: ${f.filename}\n\`\`\`diff\n${f.patch}\n\`\`\``)
    .join('\n\n');

  const chunksList = state.retrievedChunks
    .map((c, i) => `[${i}] ${c.chunk_type} "${c.chunk_name}" in ${c.file_path}:\n${c.content.slice(0, 200)}`)
    .join('\n\n');

  const prompt = `You are grading retrieved code context for relevance to a PR diff.

PR DIFF:
${diffContext}

RETRIEVED CHUNKS:
${chunksList}

For each chunk, decide if it is actually relevant to reviewing this diff — meaning it would help spot bugs, security issues, or inconsistencies specific to the changed code. Irrelevant chunks only match on generic keywords but don't relate to the actual logic being changed.

Return ONLY a JSON array of the indices (numbers) of chunks to KEEP. Example: [0, 2, 3]
If all chunks are relevant, return all indices. If none are, return [].`;

  let keepIndices = [];
  try {
    // NEW — wrapped with trackedGroqCall, same pattern as the other three nodes
    const { response: completion } = await trackedGroqCall({
      context: 'pr_review',
      userId: state.userId,
      repoFullName: `${state.owner}/${state.repo}`,
      prNumber: state.pullNumber,
      callKind: 'grade',
      model: 'openai/gpt-oss-120b',
      promptVersion: AGENT_PROMPT_VERSION,
      callFn: () => groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 128,
      }),
    });

    const content = completion.choices[0].message.content.trim();
    const clean = content.replace(/```json|```/g, '').trim();
   /*  keepIndices = JSON.parse(clean);
    if (!Array.isArray(keepIndices)) throw new Error('not array'); */
    try {
  keepIndices = JSON.parse(clean);
  if (!Array.isArray(keepIndices)) throw new Error('not array');
} catch {
  // NEW — fallback: pull any standalone numbers from the response as a best-effort array
  const numbers = clean.match(/\d+/g);
  keepIndices = numbers ? numbers.map(Number) : state.retrievedChunks.map((_, i) => i);
}
  } catch {
    // fail-safe — grading broke, keep everything rather than losing context
    keepIndices = state.retrievedChunks.map((_, i) => i);
  }

  const gradedChunks = state.retrievedChunks.filter((_, i) => keepIndices.includes(i));

  console.log(`Graded ${state.retrievedChunks.length} chunks → kept ${gradedChunks.length}`);

  return {
    ...state,
    retrievedChunks: gradedChunks,
    trace: addTrace(
      state,
      'GRADE',
      `Kept ${gradedChunks.length}/${state.retrievedChunks.length} chunks after relevance grading`
    ),
  };
};
// Node 3 — ANALYZE
export const analyzeNode = async (state) => {
  console.log('\n--- ANALYZE NODE ---');

  if (state.plan.skip) {
    return {
      ...state,
      analysis: { skip: true },
      trace: addTrace(state, 'ANALYZE', 'Skipped'),
    };
  }

  const diffSummary = state.plan.diffSummary;

  const context = state.retrievedChunks
    .slice(0, 6)
    .map((c, i) =>
      `[${i + 1}] ${c.chunk_type} "${c.chunk_name}" in ${c.file_path}:\n\`\`\`\n${c.content.slice(0, 300)}\n\`\`\``
    )
    .join('\n\n');

  const diffContext = diffSummary.files
    .map(f => `File: ${f.filename}\n\`\`\`diff\n${f.patch}\n\`\`\``)
    .join('\n\n');

  const prompt = `You are an expert code reviewer. Analyze this PR diff against the existing codebase context.

PR: "${state.prDetails.title}"
Author: ${state.prDetails.author}

EXISTING CODEBASE CONTEXT:
${context}

PR DIFF:
${diffContext}

Analyze the changes and identify:
1. Potential bugs or logic errors (type coercion, null checks, off-by-one)
2. Security concerns (missing auth checks, IDOR, data exposure in logs, unvalidated input)
3. Catastrophic operations (deleteMany with empty filter, irreversible actions, no confirmation)
4. Performance issues
5. Code style/pattern inconsistencies with existing code
6. Missing error handling
7. Sensitive data logging (console.error/log that may expose tokens, payment data, PII)

Be specific — reference actual function names, variable names, and line numbers from the diff.
Do not flag things that are correct patterns in the existing codebase.

Return ONLY a JSON object with this structure:
{
  "bugs": ["description of bug 1"],
  "security": ["security concern 1"],
  "catastrophic": ["catastrophic operation 1"],
  "performance": ["performance issue 1"],
  "style": ["style issue 1"],
  "missing": ["missing thing 1"],
  "sensitive_logging": ["sensitive data logging concern 1"],
  "positive": ["good thing about this PR"],
  "findings": [
    {
      "file": "exact/path/from/diff.js",
      "line": 42,
      "category": "security",
      "severity": "high",
      "message": "short specific description, under 200 chars"
    }
  ]
}

IMPORTANT for "findings": this array must mirror the issues you already listed above (bugs/security/catastrophic/performance/missing/sensitive_logging), but with a specific file path (must exactly match one of the file paths shown in PR DIFF above) and line number (must be a line number visible in that file's diff hunk — either a "+" added line or a " " context line, never a "-" removed line). Do not include "style" or "positive" items in findings. If you cannot confidently attribute an issue to a specific line, omit it from findings but still include it in its category array above.`;

  // CHANGED — wrapped with trackedGroqCall; prompt content and every downstream line unchanged
  const { response: completion } = await trackedGroqCall({
    context: 'pr_review',
    userId: state.userId,
    repoFullName: `${state.owner}/${state.repo}`,
    prNumber: state.pullNumber,
    callKind: 'analyze',
    model: 'openai/gpt-oss-120b',
    promptVersion: AGENT_PROMPT_VERSION,
    callFn: () => groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1536,
    }),
  });

  let analysis = {};
  try {
    const content = completion.choices[0].message.content.trim();
    const clean = content.replace(/```json|```/g, '').trim();
    analysis = JSON.parse(clean);
    if (!Array.isArray(analysis.findings)) analysis.findings = [];
  } catch {
    analysis = { error: 'Failed to parse analysis', raw: completion.choices[0].message.content, findings: [] };
  }

  const issueCount = Object.values(analysis)
    .filter(v => Array.isArray(v))
    .reduce((sum, arr) => sum + arr.length, 0);

  return {
    ...state,
    analysis,
    trace: addTrace(state, 'ANALYZE', `Found ${issueCount} items across ${Object.keys(analysis).length} categories`),
  };
};

// Node 4 — REVIEW
export const reviewNode = async (state) => {
  console.log('\n--- REVIEW NODE ---');

  if (state.plan.skip) {
    const review = `## 🤖 CodeSense Review\n\nNo JavaScript/TypeScript files were changed in this PR. No automated review needed.`;
    return {
      ...state,
      review,
      trace: addTrace(state, 'REVIEW', 'Generated skip review'),
    };
  }

  const { analysis, plan, prDetails } = state;
  const changedFunctions = plan.changedFunctions || [];

  const prompt = `You are CodeSense, an AI code reviewer. Generate a professional, helpful PR review comment in Markdown.

PR: "${prDetails.title}" by @${prDetails.author}
Changed functions: ${changedFunctions.map(f => f.name).join(', ') || 'none detected'}

Analysis results:
${JSON.stringify(analysis, null, 2)}

Write a review comment that:
1. Starts with ## 🤖 CodeSense Review
2. Has a brief summary paragraph
3. Uses sections: 🐛 Issues Found, 🔒 Security, ⚠️ Catastrophic Risk, 📊 Sensitive Logging, ⚡ Performance, 💅 Style, ✅ Looks Good
4. Only includes sections that have content
5. Ends with overall verdict: APPROVE / REQUEST_CHANGES / COMMENT
6. Is constructive and specific — references actual function names, variable names, file paths from the diff
7. Does not invent concerns not visible in the diff
8. Flags sensitive data logging explicitly if console.error/log exposes tokens, payment data, or PII

Keep it concise — max 400 words.`;

  // CHANGED — wrapped with trackedGroqCall; prompt content and every downstream line unchanged
  const { response: completion } = await trackedGroqCall({
    context: 'pr_review',
    userId: state.userId,
    repoFullName: `${state.owner}/${state.repo}`,
    prNumber: state.pullNumber,
    callKind: 'review',
    model: 'openai/gpt-oss-120b',
    promptVersion: AGENT_PROMPT_VERSION,
    callFn: () => groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1024,
    }),
  });

  const review = completion.choices[0].message.content;

  return {
    ...state,
    review,
    trace: addTrace(state, 'REVIEW', `Generated review (${review.length} chars)`),
  };
};