import pool from './supabase.js';

export const storeChunks = async (chunks, embeddings, repoId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM code_chunks WHERE repo_id = $1', [repoId]);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const embeddingStr = `[${embedding.join(',')}]`;
      await client.query(
        `INSERT INTO code_chunks
          (repo_id, user_id, file_path, chunk_name, chunk_type, content, start_line, end_line, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [repoId, userId, chunk.filePath, chunk.name, chunk.type, chunk.content, chunk.startLine, chunk.endLine, embeddingStr]
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

// NEW — delete chunks for specific files only (for incremental update)
export const deleteChunksByFiles = async (repoId, filePaths) => {
  if (!filePaths || filePaths.length === 0) return;
  const client = await pool.connect();
  try {
    for (const filePath of filePaths) {
      await client.query(
        'DELETE FROM code_chunks WHERE repo_id = $1 AND file_path = $2',
        [repoId, filePath]
      );
    }
    console.log(`Deleted chunks for ${filePaths.length} files`);
  } finally {
    client.release();
  }
};

// NEW — store chunks for specific files only (incremental)
export const storeChunksIncremental = async (chunks, embeddings, repoId, userId) => {
  if (chunks.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const embeddingStr = `[${embedding.join(',')}]`;
      await client.query(
        `INSERT INTO code_chunks
          (repo_id, user_id, file_path, chunk_name, chunk_type, content, start_line, end_line, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [repoId, userId, chunk.filePath, chunk.name, chunk.type, chunk.content, chunk.startLine, chunk.endLine, embeddingStr]
      );
    }
    await client.query('COMMIT');
    console.log(`Stored ${chunks.length} incremental chunks`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const searchChunks = async (queryEmbedding, repoId, topK = 8) => {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  const fetchK = Math.max(topK * 2, 16);

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
    [embeddingStr, repoId, fetchK]
  );

  // Diversity filter — max 2 chunks per file
  const fileCounts = {};
  const deduped = [];
  for (const row of rows) {
    fileCounts[row.file_path] = (fileCounts[row.file_path] || 0) + 1;
    if (fileCounts[row.file_path] <= 2) deduped.push(row);
  }

  return deduped.slice(0, topK);
};

export const deleteChunks = async (repoId) => {
  await pool.query('DELETE FROM code_chunks WHERE repo_id = $1', [repoId]);
};