require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS portrait_url VARCHAR(500)
  `);
  console.log('Migration complete: users.portrait_url added.');
  await pool.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
