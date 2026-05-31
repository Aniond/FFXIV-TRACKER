const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS nuts_stash INTEGER NOT NULL DEFAULT 0
  `);
  console.log('Migration complete: users.nuts_stash added.');
  await pool.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
