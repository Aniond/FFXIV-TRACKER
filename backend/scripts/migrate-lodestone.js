require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lodestone_cache (
      cache_key  VARCHAR(255) PRIMARY KEY,
      data       JSONB        NOT NULL,
      expires_at TIMESTAMPTZ  NOT NULL,
      created_at TIMESTAMPTZ  DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS lodestone_cache_expires_idx ON lodestone_cache (expires_at)
  `);
  console.log('Migration complete: lodestone_cache table ready.');
  await pool.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
