import express from 'express';
import verifyToken from '../middleware/verifyToken.js';
import Repo from '../models/Repo.js';
import { embedText, buildEmbeddingText } from '../utils/embeddings.js';
import { searchChunks } from '../utils/vectorStore.js';
import Groq from 'groq-sdk';

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// POST /api/qa/ask
router.post('/ask', verifyToken, async (req, res) => {
  const { question, repoId } = req.body;

  if (!question || !repoId) {
    return res.status(400).json({ message: 'question and repoId required' });
  }

  try {
    // Verify repo belongs to user
    const repo = await Repo.findOne({ _id: repoId, userId: req.userId });
    if (!repo) {
      return res.status(404).json({ message: 'Repo not found' });
    }

    if (repo.ingestionStatus !== 'completed') {
      return res.status(400).json({ message: 'Repo not ingested yet' });
    }

    // Embed the question
    const questionEmbedding = await embedText(question);

    // Retrieve top 5 most relevant chunks
    const relevantChunks = await searchChunks(questionEmbedding, repoId, 8);

    if (relevantChunks.length === 0) {
      return res.json({
        answer: 'No relevant code found for this question.',
        sources: [],
      });
    }

    // Build context from retrieved chunks
    const context = relevantChunks
      .map((chunk, i) =>
        `[${i + 1}] ${chunk.chunk_type} "${chunk.chunk_name}" in ${chunk.file_path} (lines ${chunk.start_line}-${chunk.end_line}):
\`\`\`
${chunk.content}
\`\`\``
      )
      .join('\n\n');

    // Ask Groq with retrieved context
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are CodeSense, an expert code assistant. Answer questions about the codebase using ONLY the provided code context. Be precise, reference specific function names and file paths. If the answer is not in the context, say so clearly.`,
        },
        {
          role: 'user',
          content: `Codebase: ${repo.fullName}

Code context:
${context}

Question: ${question}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });

    const answer = completion.choices[0].message.content;

    res.json({
      answer,
      sources: relevantChunks.map((chunk) => ({
        file: chunk.file_path,
        name: chunk.chunk_name,
        type: chunk.chunk_type,
        lines: `${chunk.start_line}-${chunk.end_line}`,
        similarity: Math.round(chunk.similarity * 100) + '%',
      })),
    });

  } catch (err) {
    console.error('Q&A error:', err.message);
    res.status(500).json({ message: 'Q&A failed', error: err.message });
  }
});

export default router;