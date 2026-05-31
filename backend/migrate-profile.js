require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS slug         VARCHAR(64),
      ADD COLUMN IF NOT EXISTS world        VARCHAR(64),
      ADD COLUMN IF NOT EXISTS dc           VARCHAR(32),
      ADD COLUMN IF NOT EXISTS lodestone_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS xivapi_cache JSONB
  `);

  const { rowCount } = await pool.query(`
    UPDATE users SET slug = LOWER(username) WHERE slug IS NULL
  `);

  // Partial unique index allows multiple NULLs while enforcing uniqueness for set slugs
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_slug_unique ON users(slug) WHERE slug IS NOT NULL
  `);

  console.log(`Migration complete. ${rowCount} users given slugs.`);
  await pool.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
