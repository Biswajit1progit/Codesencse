import dotenv from 'dotenv';
dotenv.config();

console.log('CWD:', process.cwd());
console.log('RAW SUPABASE_DATABASE_URL:', JSON.stringify(process.env.SUPABASE_DATABASE_URL));

import pg from 'pg';
const { Pool } = pg;

if (!process.env.SUPABASE_DATABASE_URL) {
  console.error('❌ SUPABASE_DATABASE_URL is undefined. Check that .env exists in this folder and dotenv.config() ran before this line.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    console.error(err);
  } else {
    console.log('✅ Connection successful! Server time:', res.rows[0].now);
  }
  pool.end();
});