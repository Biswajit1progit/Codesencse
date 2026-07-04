import pool from './supabase.js';

// Store chunks with embeddings in pgvector
export const storeChunks = async (chunks, embeddings, repoId, userId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete existing chunks for this repo before reinserting
    await client.query(
      'DELETE FROM code_chunks WHERE repo_id = $1',
      [repoId]
    );

    // Insert all chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      // pgvector expects embedding as string '[0.1, 0.2, ...]'
      const embeddingStr = `[${embedding.join(',')}]`;

      await client.query(
        `INSERT INTO code_chunks
          (repo_id, user_id, file_path, chunk_name, chunk_type, content, start_line, end_line, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          repoId,
          userId,
          chunk.filePath,
          chunk.name,
          chunk.type,
          chunk.content,
          chunk.startLine,
          chunk.endLine,
          embeddingStr,
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`Stored ${chunks.length} chunks in pgvector`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Cosine similarity search — returns top k most relevant chunks
export const searchChunks = async (queryEmbedding, repoId, topK = 5) => {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const { rows } = await pool.query(
    `SELECT
      id,
      file_path,
      chunk_name,
      chunk_type,
      content,
      start_line,
      end_line,
      1 - (embedding <=> $1::vector) as similarity
    FROM code_chunks
    WHERE repo_id = $2
    ORDER BY embedding <=> $1::vector
    LIMIT $3`,
    [embeddingStr, repoId, topK]
  );

  return rows;
};

// Delete all chunks for a repo
export const deleteChunks = async (repoId) => {
  await pool.query('DELETE FROM code_chunks WHERE repo_id = $1', [repoId]);
};