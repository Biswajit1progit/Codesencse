import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Force IPv4 — Render free tier doesn't support IPv6
  family: 4,
});

pool.on('error', (err) => {
  console.error('Supabase pool error:', err.message);
});

export default pool;