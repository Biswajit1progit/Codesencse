import 'dotenv/config';
import mongoose from 'mongoose';
import EvalCase from '../models/EvalCase.js';
import { embedText } from '../utils/embeddings.js';
import { searchChunks } from '../utils/vectorStore.js';

const TOP_K = 8; // how many chunks to retrieve per query

// Check if a returned chunk is relevant based on ground truth
const isRelevant = (chunk, relevantFiles, relevantFunctions) => {
  const chunkFile = chunk.file_path?.toLowerCase() || '';
  const chunkName = chunk.chunk_name?.toLowerCase() || '';

  // Check if chunk's file matches any relevant file
  const fileMatch = relevantFiles.some((f) =>
    chunkFile.includes(f.toLowerCase().split('/').pop()) // match by filename only
  );

  // Check if chunk's function name matches any relevant function
  const functionMatch = relevantFunctions.some((fn) =>
    chunkName.includes(fn.toLowerCase())
  );

  return fileMatch || functionMatch;
};

// Compute precision@k
const computePrecision = (returnedChunks, relevantFiles, relevantFunctions) => {
  if (returnedChunks.length === 0) return 0;

  const relevantCount = returnedChunks.filter((chunk) =>
    isRelevant(chunk, relevantFiles, relevantFunctions)
  ).length;

  return relevantCount / returnedChunks.length;
};

// Compute recall@k
const computeRecall = (returnedChunks, relevantFiles, relevantFunctions) => {
  const allRelevant = [...relevantFiles, ...relevantFunctions];
  if (allRelevant.length === 0) return 1; // nothing to recall

  // Count how many unique relevant items appeared in results
  const foundItems = new Set();

  for (const chunk of returnedChunks) {
    const chunkFile = chunk.file_path?.toLowerCase() || '';
    const chunkName = chunk.chunk_name?.toLowerCase() || '';

    for (const f of relevantFiles) {
      if (chunkFile.includes(f.toLowerCase().split('/').pop())) {
        foundItems.add(f);
      }
    }
    for (const fn of relevantFunctions) {
      if (chunkName.includes(fn.toLowerCase())) {
        foundItems.add(fn);
      }
    }
  }

  return foundItems.size / allRelevant.length;
};

const runRetrievalEval = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected\n');

  // Load all retrieval eval cases
  const evalCases = await EvalCase.find({ type: 'retrieval' });
  console.log(`Found ${evalCases.length} retrieval eval cases\n`);
  console.log('='.repeat(60));

  const allPrecisions = [];
  const allRecalls = [];

  for (const evalCase of evalCases) {
    const { query, repoId, relevantFiles, relevantFunctions } =
      evalCase.retrieval;

    console.log(`\nQuery: "${query}"`);
    console.log(`Expected files: ${relevantFiles.join(', ')}`);
    console.log(`Expected functions: ${relevantFunctions.join(', ')}`);

    try {
      // Embed query
      const queryEmbedding = await embedText(query);

      // Search pgvector
const chunks = await searchChunks(queryEmbedding, repoId, TOP_K, { query });
      console.log(`\nReturned ${chunks.length} chunks:`);
      chunks.forEach((c, i) => {
        const relevant = isRelevant(c, relevantFiles, relevantFunctions);
        console.log(
          `  ${i + 1}. [${relevant ? '✅' : '❌'}] ${c.chunk_type} "${c.chunk_name}" in ${c.file_path} (${Math.round(c.similarity * 100)}%)`
        );
      });

      // Compute scores
      const precision = computePrecision(chunks, relevantFiles, relevantFunctions);
      const recall = computeRecall(chunks, relevantFiles, relevantFunctions);

      console.log(`\nPrecision@${TOP_K}: ${(precision * 100).toFixed(1)}%`);
      console.log(`Recall@${TOP_K}:    ${(recall * 100).toFixed(1)}%`);
      console.log('-'.repeat(60));

      allPrecisions.push(precision);
      allRecalls.push(recall);

      // Save results back to MongoDB
      evalCase.results.push({
        runAt: new Date(),
        precision,
        recall,
        notes: `topK=${TOP_K}`,
      });
      await evalCase.save();

      // Small delay to avoid Gemini rate limit
      await new Promise((r) => setTimeout(r, 2000));

    } catch (err) {
      console.error(`Error on query "${query}": ${err.message}`);
    }
  }

  // Summary report
  const avgPrecision = allPrecisions.reduce((a, b) => a + b, 0) / allPrecisions.length;
  const avgRecall = allRecalls.reduce((a, b) => a + b, 0) / allRecalls.length;

  console.log('\n' + '='.repeat(60));
  console.log('RETRIEVAL EVAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Cases evaluated:     ${evalCases.length}`);
  console.log(`Top-K:               ${TOP_K}`);
  console.log(`Avg Precision@${TOP_K}:  ${(avgPrecision * 100).toFixed(1)}%`);
  console.log(`Avg Recall@${TOP_K}:     ${(avgRecall * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  // Per-tag breakdown
  const tagScores = {};
  for (let i = 0; i < evalCases.length; i++) {
    const evalCase = evalCases[i];
    for (const tag of evalCase.tags) {
      if (!tagScores[tag]) tagScores[tag] = { precisions: [], recalls: [] };
      tagScores[tag].precisions.push(allPrecisions[i]);
      tagScores[tag].recalls.push(allRecalls[i]);
    }
  }

  console.log('\nPer-tag breakdown:');
  for (const [tag, scores] of Object.entries(tagScores)) {
    const avgP = scores.precisions.reduce((a, b) => a + b, 0) / scores.precisions.length;
    const avgR = scores.recalls.reduce((a, b) => a + b, 0) / scores.recalls.length;
    console.log(`  ${tag.padEnd(15)} P: ${(avgP * 100).toFixed(1)}%  R: ${(avgR * 100).toFixed(1)}%`);
  }

  console.log('\n✅ Results saved to MongoDB');
  await mongoose.disconnect();
};

runRetrievalEval().catch(console.error);