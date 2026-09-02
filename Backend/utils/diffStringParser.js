// Eval cases store diff as a single truncated string (see EvalCase model).
// The live agent (nodes.js) expects an array of file objects, since that's
// the shape GitHub's API returns. This adapter exists only for the eval harness
// so it can call the real nodes.js pipeline instead of a separate implementation.

export const parseDiffString = (diffString) => {
  if (!diffString || typeof diffString !== 'string') return [];

  const hasFileHeaders = diffString.includes('diff --git');

  if (!hasFileHeaders) {
    // No per-file headers — treat the whole string as one file, best-guess the name
    const nameMatch = diffString.match(/\+\+\+ b\/(\S+)/) || diffString.match(/--- a\/(\S+)/);
    const filename = nameMatch ? nameMatch[1] : 'unknown-file.js';
    return [buildFileEntry(filename, diffString)];
  }

  const fileBlocks = diffString.split(/^diff --git /m).filter(Boolean);

  return fileBlocks.map((block) => {
    const nameMatch = block.match(/a\/(\S+)\s+b\/(\S+)/);
    const filename = nameMatch ? nameMatch[2] : (block.match(/\+\+\+ b\/(\S+)/) || [])[1] || 'unknown-file.js';
    return buildFileEntry(filename, block);
  });
};

const buildFileEntry = (filename, patch) => {
  let additions = 0;
  let deletions = 0;
  for (const line of patch.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }
  return { filename, status: 'modified', additions, deletions, patch };
};