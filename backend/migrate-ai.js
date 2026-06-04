require('dotenv').config();
const pool = require('./db');

// AI search migration — adds the short-lived query cache used by /api/ai/search.
// Logging still goes to the existing `ai_queries` table (see migrate-admin.js),
// which the /admin dashboard reads. This migration only adds the cache table.
//
// Run against prod from a local machine (see reference-railway-ops):
//   railway run sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL node migrate-ai.js'
async function migrate() {
  console.log('Running AI migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_searches (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      query_norm  TEXT NOT NULL,
      response    JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('  user_searches table ready');

  // Identical-query cache lookups filter by normalized text + recency.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_searches_lookup
      ON user_searches (query_norm, created_at DESC);
  `);
  console.log('  user_searches index ready');

  console.log('AI migration complete.');
  await pool.end();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
