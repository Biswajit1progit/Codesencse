// Parses a unified diff patch (GitHub's `patch` field) to find which
// new-file line numbers are actually visible in the diff — GitHub's
// Reviews API rejects any comment line that isn't part of a hunk.

export const getValidCommentLines = (patch) => {
  const validLines = new Set();
  if (!patch) return validLines;

  const lines = patch.split('\n');
  let newLineNum = null;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      newLineNum = parseInt(hunkMatch[1], 10);
      continue;
    }
    if (newLineNum === null) continue;

    if (line.startsWith('+')) {
      validLines.add(newLineNum);
      newLineNum++;
    } else if (line.startsWith(' ')) {
      validLines.add(newLineNum); // context lines are commentable too
      newLineNum++;
    } else if (line.startsWith('-')) {
      // removed line — no new-file line number, don't increment newLineNum
    }
  }

  return validLines;
};

// Builds a { filename: Set(validLines) } map from the diffSummary.files array
export const buildValidLineMap = (files) => {
  const map = {};
  for (const file of files) {
    map[file.filename] = getValidCommentLines(file.patch);
  }
  return map;
};