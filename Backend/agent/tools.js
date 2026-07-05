import { embedText } from '../utils/embeddings.js';
import { searchChunks } from '../utils/vectorStore.js';
import Repo from '../models/Repo.js';

// Tool 1 — retrieve relevant code chunks for a query
export const retrieveContext = async (query, repoId, topK = 5) => {
  const queryEmbedding = await embedText(query);
  const chunks = await searchChunks(queryEmbedding, repoId, topK);
  return chunks;
};

// Tool 2 — extract changed function names from diff patch
export const extractChangedFunctions = (diff) => {
  const changedFunctions = [];

  for (const file of diff) {
    if (!file.patch) continue;

    // Match function declarations in the diff
    const lines = file.patch.split('\n');
    for (const line of lines) {
      // Only look at added/modified lines
      if (!line.startsWith('+')) continue;

      // Match common JS/TS function patterns
      const patterns = [
        /function\s+(\w+)\s*\(/,           // function myFunc(
        /const\s+(\w+)\s*=\s*(?:async\s+)?\(/, // const myFunc = (
        /(\w+)\s*:\s*(?:async\s+)?function/, // myFunc: function
        /async\s+(\w+)\s*\(/,               // async myFunc(
        /(\w+)\s*=\s*async\s+\(/,           // myFunc = async (
      ];

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          changedFunctions.push({
            name: match[1],
            file: file.filename,
          });
        }
      }
    }
  }

  // Deduplicate
  return [...new Map(changedFunctions.map(f => [`${f.file}:${f.name}`, f])).values()];
};

// Tool 3 — build a summary of the diff for the agent
export const summarizeDiff = (diff) => {
  const jsDiff = diff.filter(f => {
    const ext = f.filename.split('.').pop();
    return ['js', 'jsx', 'ts', 'tsx'].includes(ext);
  });

  return {
    totalFiles: diff.length,
    jsFiles: jsDiff.length,
    totalAdditions: diff.reduce((sum, f) => sum + f.additions, 0),
    totalDeletions: diff.reduce((sum, f) => sum + f.deletions, 0),
    files: jsDiff.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch?.slice(0, 500) || '', // truncate for prompt
    })),
  };
};