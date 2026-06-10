require('dotenv').config();
const pool = require('../db');

/**
 * migrate-audit.js — indexes flagged by the 2026-06 code audit.
 *
 * - ai_queries(user_id, created_at): the AI rate limit runs this lookup on
 *   every request over a table that only grows.
 * - users(slug) / users(LOWER(username)): public profile lookups were
 *   sequential scans.
 * - lodestone_cache(expires_at): the daily cron purge deletes by expiry.
 *
 * Run (link the Postgres service, not the app — see migrate-overrides.js):
 *   railway run sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL NODE_ENV=production node scripts/migrate-audit.js'
 */
async function migrate() {
  const stmts = [
    'CREATE INDEX IF NOT EXISTS idx_ai_queries_user_created ON ai_queries (user_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_users_slug ON users (slug)',
    'CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username))',
    'CREATE INDEX IF NOT EXISTS idx_lodestone_cache_expires ON lodestone_cache (expires_at)',
  ];
  for (const sql of stmts) {
    await pool.query(sql);
    console.log('  ok:', sql.match(/idx_\w+/)[0]);
  }
  console.log('audit index migration complete.');
  await pool.end();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
