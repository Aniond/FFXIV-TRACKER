require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db');

// Goldsmith migration — seeds the recipes table from
// goldsmith-recipes.json (produced by scrape-goldsmith.js). Re-runnable: it
// clears and reseeds the GSM slice each time.
//
// Run against prod from a local machine (see reference-railway-ops):
//   railway run sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL node scripts/migrate-goldsmith.js'
async function migrate() {
  console.log('Running goldsmith migration…');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS recipes (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255),
      job         VARCHAR(10) DEFAULT 'CUL',
      item_level  INTEGER,
      stars       INTEGER DEFAULT 0,
      food_buff   JSONB,
      ingredients JSONB,
      expansion   VARCHAR(50) DEFAULT 'Dawntrail',
      is_subcraft BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // is_subcraft distinguishes intermediate crafted ingredients (any DoH job,
  // no food buff) from actual food dishes. Added for existing deployments.
  await pool.query(`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_subcraft BOOLEAN NOT NULL DEFAULT false`);
  console.log('  recipes table ready');

  // Indexes on frequently-queried columns (audit Fix 4).
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_recipes_job_expansion ON recipes(job, expansion)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_queries_created_at ON ai_queries(created_at)`);
  console.log('  indexes ready (recipes job/expansion, submissions user_id, ai_queries created_at)');

  // Manual ingredient source/location overrides — take precedence over the
  // baked Teamcraft data at request time (see /api/recipes). Patch any gap by
  // inserting a row; no code change or re-scrape needed.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingredient_overrides (
      item_id   INTEGER PRIMARY KEY,
      item_name VARCHAR(255),
      source    VARCHAR(20),  -- 'Fishing' | 'Mining' | 'Botany' | 'Market Board'
      node_name VARCHAR(255),
      zone      VARCHAR(100),
      coords    VARCHAR(50),
      notes     TEXT
    );
  `);
  // Override ROWS are owned by migrate-overrides.js (authoritative, re-runnable
  // with DO UPDATE). Run that separately to seed/refresh them; this migration
  // only guarantees the table exists so /api/recipes never errors.
  console.log('  ingredient_overrides table ready (rows seeded by migrate-overrides.js)');

  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'goldsmith-recipes.json'), 'utf8'));

  // Delete all GSM items that are not subcrafts
  await pool.query('DELETE FROM recipes WHERE job = $1 AND is_subcraft = false', ['GSM']);
  
  // We need to handle subcrafts carefully so we don't duplicate them or delete cooking subcrafts.
  // Easiest is to delete GSM subcrafts that don't overlap, or just do ON CONFLICT if we had a unique constraint.
  // Since we don't have a unique constraint on (name), let's just delete ALL GSM rows, and also delete subcrafts
  // that we are going to insert anyway to avoid duplicates.
  // Actually, wait: `recipes` might have multiple of the same subcraft if both GSM and CUL seed it.
  // It's cleaner to just delete GSM job recipes, and also delete subcrafts by name that we are about to insert
  // to avoid duplication.
  const subcraftNames = seed.filter(r => r.is_subcraft).map(r => r.name);
  if (subcraftNames.length > 0) {
    await pool.query('DELETE FROM recipes WHERE name = ANY($1)', [subcraftNames]);
  }
  let n = 0;
  for (const r of seed) {
    await pool.query(
      `INSERT INTO recipes (name, job, item_level, stars, food_buff, ingredients, expansion, is_subcraft)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        r.name, r.job, r.item_level, r.stars,
        r.food_buff ? JSON.stringify(r.food_buff) : null,
        JSON.stringify(r.ingredients),
        r.expansion,
        !!r.is_subcraft,
      ]
    );
    n++;
  }
  const dishes = seed.filter((r) => !r.is_subcraft).length;
  const subs = seed.length - dishes;
  console.log(`  seeded ${n} recipes (${dishes} goldsmith recipes + ${subs} subcrafts)`);
  console.log('Goldsmith migration complete.');
  await pool.end();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
