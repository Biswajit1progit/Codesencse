import * as babelParser from '@babel/parser';
import traverse from '@babel/traverse';

export const extractChunks = (code, filePath) => {
  const chunks = [];

  const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  const isJSX = filePath.endsWith('.jsx') || filePath.endsWith('.tsx');

  let ast;
  try {
    ast = babelParser.parse(code, {
      sourceType: 'module',
      errorRecovery: true,
      plugins: [
        isTS ? 'typescript' : 'flow',
        isJSX ? 'jsx' : null,
        'decorators-legacy',
        'classProperties',
        'optionalChaining',
        'nullishCoalescingOperator',
      ].filter(Boolean),
    });
  } catch (err) {
    return [{
      type: 'file',
      name: filePath.split('/').pop(),
      filePath,
      content: code,
      startLine: 1,
      endLine: code.split('\n').length,
    }];
  }

  const lines = code.split('\n');
  const getLines = (start, end) => lines.slice(start - 1, end).join('\n');
  const getName = (node) => {
    if (node.id?.name) return node.id.name;
    if (node.key?.name) return node.key.name;
    return 'anonymous';
  };

  const chunkedRanges = new Set();

  traverse.default(ast, {
    FunctionDeclaration(path) {
      const node = path.node;
      if (!node.loc) return;
      const key = `${node.loc.start.line}-${node.loc.end.line}`;
      if (chunkedRanges.has(key)) return;
      chunkedRanges.add(key);
      chunks.push({
        type: 'function',
        name: getName(node),
        filePath,
        content: getLines(node.loc.start.line, node.loc.end.line),
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
      });
    },
    VariableDeclaration(path) {
      const node = path.node;
      if (!node.loc) return;
      for (const declarator of node.declarations) {
        const init = declarator.init;
        if (!init) continue;
        if (init.type !== 'ArrowFunctionExpression' && init.type !== 'FunctionExpression') continue;
        if (!init.loc) continue;
        const key = `${node.loc.start.line}-${init.loc.end.line}`;
        if (chunkedRanges.has(key)) return;
        chunkedRanges.add(key);
        chunks.push({
          type: 'function',
          name: declarator.id?.name || 'anonymous',
          filePath,
          content: getLines(node.loc.start.line, init.loc.end.line),
          startLine: node.loc.start.line,
          endLine: init.loc.end.line,
        });
      }
    },
    ClassDeclaration(path) {
      const node = path.node;
      if (!node.loc) return;
      const key = `${node.loc.start.line}-${node.loc.end.line}`;
      if (chunkedRanges.has(key)) return;
      chunkedRanges.add(key);
      chunks.push({
        type: 'class',
        name: getName(node),
        filePath,
        content: getLines(node.loc.start.line, node.loc.end.line),
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
      });
    },
    ClassMethod(path) {
      const node = path.node;
      if (!node.loc) return;
      const key = `${node.loc.start.line}-${node.loc.end.line}`;
      if (chunkedRanges.has(key)) return;
      chunkedRanges.add(key);
      chunks.push({
        type: 'method',
        name: getName(node),
        filePath,
        content: getLines(node.loc.start.line, node.loc.end.line),
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
      });
    },
    ObjectMethod(path) {
      const node = path.node;
      if (!node.loc) return;
      const key = `${node.loc.start.line}-${node.loc.end.line}`;
      if (chunkedRanges.has(key)) return;
      chunkedRanges.add(key);
      chunks.push({
        type: 'method',
        name: getName(node),
        filePath,
        content: getLines(node.loc.start.line, node.loc.end.line),
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
      });
    },
  });

  if (chunks.length === 0) {
    return [{
      type: 'file',
      name: filePath.split('/').pop(),
      filePath,
      content: code,
      startLine: 1,
      endLine: lines.length,
    }];
  }

  return chunks.sort((a, b) => a.startLine - b.startLine);
};

// NEW — sliding window with overlap
// maxLines: max chunk size
// overlapLines: how many lines to overlap between chunks
export const splitLargeChunk = (chunk, maxLines = 80, overlapLines = 20) => {
  const lines = chunk.content.split('\n');

  // Small chunk — no splitting needed
  if (lines.length <= maxLines) return [chunk];

  const result = [];
  let partIndex = 0;
  let i = 0;

  while (i < lines.length) {
    const sliceLines = lines.slice(i, i + maxLines);

    result.push({
      ...chunk,
      name: `${chunk.name}_part${partIndex}`,
      content: sliceLines.join('\n'),
      startLine: chunk.startLine + i,
      endLine: chunk.startLine + i + sliceLines.length - 1,
    });

    partIndex++;

    // Move forward by (maxLines - overlapLines) so next chunk overlaps
    const step = maxLines - overlapLines;
    i += step;

    // If remaining lines are less than overlapLines, stop — already covered
    if (i >= lines.length) break;
  }

  return result;
};

// Build overlap context chunk — adds N lines before and after a chunk
// Used during retrieval to give the LLM more surrounding context
export const addContextWindow = (chunk, allFileLines, contextLines = 10) => {
  const startLine = Math.max(0, chunk.startLine - 1 - contextLines);
  const endLine = Math.min(allFileLines.length, chunk.endLine + contextLines);

  const beforeContext = allFileLines.slice(startLine, chunk.startLine - 1).join('\n');
  const afterContext = allFileLines.slice(chunk.endLine, endLine).join('\n');

  return {
    ...chunk,
    content: [
      beforeContext ? `// ... context before ...\n${beforeContext}` : '',
      chunk.content,
      afterContext ? `${afterContext}\n// ... context after ...` : '',
    ].filter(Boolean).join('\n'),
  };
};