import 'dotenv/config';
import mongoose from 'mongoose';
import { embedText } from '../utils/embeddings.js';
import { searchChunks } from '../utils/vectorStore.js';

const REPO_ID = '6a48a056ee579f3afd2bab95';

const queries = [
  'refresh token interceptor axios',
  'protect restrictTo middleware authorization',
  'notification controller',
  'hotel image upload cloudinary',
  'RAG chatbot pipeline embeddings',
  'cancelBooking processRefund',
];

const inspect = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Inspecting SafarSetu chunks...\n');

  for (const query of queries) {
    console.log(`Query: "${query}"`);
    const embedding = await embedText(query);
    const chunks = await searchChunks(embedding, REPO_ID, 3);
    chunks.forEach((c) =>
      console.log(`  ${c.chunk_type} "${c.chunk_name}" in ${c.file_path} (${Math.round(c.similarity * 100)}%)`)
    );
    console.log();
    await new Promise((r) => setTimeout(r, 2000));
  }

  await mongoose.disconnect();
};

inspect().catch(console.error);