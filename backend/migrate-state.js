require('dotenv').config();
const pool = require('./db');

/**
 * migrate-state.js — per-user synced UI state (account sync).
 *
 * One JSONB blob per (user, key). Keys mirror the frontend's localStorage
 * keys (gathering checklists, fishing log, cooking list, saved recipes,
 * favorite nodes, search history) — see routes/users.js STATE_KEYS.
 *
 * Run (link the Postgres service — see migrate-overrides.js):
 *   railway run sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL NODE_ENV=production node migrate-state.js'
 */
async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_state (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key        VARCHAR(64) NOT NULL,
      value      JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, key)
    );
  `);
  console.log('  user_state table ready');
  await pool.end();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
