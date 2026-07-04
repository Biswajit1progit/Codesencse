import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Retry with exponential backoff on 429
const embedWithRetry = async (text, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
        config: { outputDimensionality: 768 },
      });
      return result.embeddings[0].values;
    } catch (err) {
      if (err.message?.includes('429') && i < retries - 1) {
        const waitMs = (i + 1) * 5000; // 5s, 10s, 15s
        console.log(`Rate limited — waiting ${waitMs / 1000}s before retry...`);
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        throw err;
      }
    }
  }
};

export const embedText = async (text) => {
  return await embedWithRetry(text);
};

export const embedBatch = async (texts) => {
  const embeddings = [];

  for (let i = 0; i < texts.length; i++) {
    const embedding = await embedText(texts[i]);
    embeddings.push(embedding);
    console.log(`Embedded ${i + 1}/${texts.length}`);

    // 1.5s delay between every call — stays within free tier RPM limit
    await new Promise((r) => setTimeout(r, 1500));
  }

  return embeddings;
};

export const buildEmbeddingText = (chunk) => {
  return `File: ${chunk.filePath}
Type: ${chunk.type}
Name: ${chunk.name}
Code:
${chunk.content}`;
};