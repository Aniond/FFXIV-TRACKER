require('dotenv').config();
const pool = require('./db');

async function migrate() {
  console.log('Running admin migration...');

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;
  `);
  console.log('  users.banned column ready');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_queries (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      query_text  TEXT NOT NULL,
      tokens_in   INTEGER NOT NULL DEFAULT 0,
      tokens_out  INTEGER NOT NULL DEFAULT 0,
      cached      BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('  ai_queries table ready');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_flags (
      key         VARCHAR(100) PRIMARY KEY,
      enabled     BOOLEAN NOT NULL DEFAULT false,
      description TEXT
    );
  `);
  console.log('  feature_flags table ready');

  await pool.query(`
    INSERT INTO feature_flags (key, enabled, description) VALUES
      ('ENABLE_AI_PUBLIC',  false, 'Enable AI assistant for logged-in users'),
      ('ENABLE_AI_GUESTS',  false, 'Enable AI assistant for guests (not logged in)')
    ON CONFLICT (key) DO NOTHING;
  `);
  console.log('  feature_flags seeded');

  console.log('Admin migration complete.');
  await pool.end();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
