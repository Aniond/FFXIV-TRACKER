require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

// Cooking migration — creates the recipes table and seeds it from
// cooking-recipes.json (produced by scrape-cooking.js). Re-runnable: it
// clears and reseeds the CUL/Dawntrail slice each time.
//
// Run against prod from a local machine (see reference-railway-ops):
//   railway run sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL node migrate-cooking.js'
async function migrate() {
  console.log('Running cooking migration…');

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
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('  recipes table ready');

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
  // Seed known Dawntrail gaps missing from Teamcraft's open dataset.
  // ON CONFLICT DO NOTHING so manual edits to existing rows are preserved.
  await pool.query(`
    INSERT INTO ingredient_overrides (item_id, item_name, source, node_name, zone, coords, notes) VALUES
      (49233, 'Quahog',       'Fishing', NULL, NULL, NULL, 'Dawntrail coastal fishing — missing from Teamcraft open data'),
      (39865, 'Dark Eggplant','Botany',  NULL, NULL, NULL, 'Dawntrail botany — missing from Teamcraft open data')
    ON CONFLICT (item_id) DO NOTHING;
  `);
  console.log('  ingredient_overrides table ready + seeded');

  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'cooking-recipes.json'), 'utf8'));

  await pool.query("DELETE FROM recipes WHERE job = 'CUL' AND expansion = 'Dawntrail'");
  let n = 0;
  for (const r of seed) {
    await pool.query(
      `INSERT INTO recipes (name, job, item_level, stars, food_buff, ingredients, expansion)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        r.name, r.job, r.item_level, r.stars,
        r.food_buff ? JSON.stringify(r.food_buff) : null,
        JSON.stringify(r.ingredients),
        r.expansion,
      ]
    );
    n++;
  }
  console.log(`  seeded ${n} CUL Dawntrail recipes`);
  console.log('Cooking migration complete.');
  await pool.end();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
