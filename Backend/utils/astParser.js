import * as babelParser from '@babel/parser';
import traverse from '@babel/traverse';

// Parse a JS/TS file and extract function/class level chunks
export const extractChunks = (code, filePath) => {
  const chunks = [];

  // Detect if TypeScript
  const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  const isJSX = filePath.endsWith('.jsx') || filePath.endsWith('.tsx');

  let ast;
  try {
    ast = babelParser.parse(code, {
      sourceType: 'module',
      errorRecovery: true, // don't crash on partial parse errors
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
    // If parsing fails entirely, return the whole file as one chunk
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

  const getLines = (start, end) => {
    return lines.slice(start - 1, end).join('\n');
  };

  const getName = (node) => {
    if (node.id?.name) return node.id.name;
    if (node.key?.name) return node.key.name;
    return 'anonymous';
  };

  // Track what we've already chunked to avoid duplicates
  const chunkedRanges = new Set();

  traverse.default(ast, {
    // Named function declarations: function myFunc() {}
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

    // Arrow functions and function expressions assigned to variables
    // e.g. const myFunc = () => {} or const myFunc = function() {}
    VariableDeclaration(path) {
      const node = path.node;
      if (!node.loc) return;

      for (const declarator of node.declarations) {
        const init = declarator.init;
        if (!init) continue;
        if (
          init.type !== 'ArrowFunctionExpression' &&
          init.type !== 'FunctionExpression'
        ) continue;
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

    // Class declarations: class MyClass {}
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

    // Class methods: myMethod() {} inside a class
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

    // Object methods: { myMethod() {} }
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

  // If no chunks extracted (e.g. config file, constants only)
  // return whole file as one chunk so nothing is lost
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

  // Sort by line number
  return chunks.sort((a, b) => a.startLine - b.startLine);
};

// Chunk size guard — split very large chunks into smaller pieces
// Prevents embedding API token limits being exceeded
export const splitLargeChunk = (chunk, maxLines = 80) => {
  const lines = chunk.content.split('\n');
  if (lines.length <= maxLines) return [chunk];

  const result = [];
  let partIndex = 0;

  for (let i = 0; i < lines.length; i += maxLines) {
    const sliceLines = lines.slice(i, i + maxLines);
    result.push({
      ...chunk,
      name: `${chunk.name}_part${partIndex}`,
      content: sliceLines.join('\n'),
      startLine: chunk.startLine + i,
      endLine: chunk.startLine + i + sliceLines.length - 1,
    });
    partIndex++;
  }

  return result;
};