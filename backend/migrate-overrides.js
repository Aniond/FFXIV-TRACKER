require('dotenv').config();
const pool = require('./db');

/**
 * migrate-overrides.js — authoritative seed for ingredient_overrides.
 *
 * These manual rows take precedence over the baked Teamcraft classification at
 * request time (see /api/recipes). The override is matched by item_id — that is
 * the table PK AND the key the endpoint joins on, so every row MUST carry a real
 * item_id (a name-only row would never be applied).
 *
 * Re-runnable: ON CONFLICT (item_id) DO UPDATE so edits here are pushed on
 * re-run. To patch a new gap, add a row below (resolve the item_id from the
 * recipe ingredients) and re-run against prod:
 *   railway run sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL NODE_ENV=production node migrate-overrides.js'
 *
 * source ∈ 'Fishing' | 'Mining' | 'Botany' | 'Market Board'
 */
const OVERRIDES = [
  // item_id, item_name, source, node_name, zone, coords, notes
  [49233, 'Quahog', 'Fishing', null, null, null,
    'Dawntrail coastal fishing — missing from Teamcraft open data'],
  [39865, 'Dark Eggplant', 'Botany', null, null, null,
    'Dawntrail botany — missing from Teamcraft open data'],

  // Added from in-game verification (cooking tips):
  [49229, 'Flint Corn', 'Market Board', null, null, null,
    'Not gatherable — purchase from Market Board only'],
  [43978, "Ut'ohmu Tomato", 'Botany', 'Regular Node', "Yak T'el", 'X:11.6, Y:19.3',
    'Level 95 regular node. Found via Ut\'ohmu Chili Sauce subcraft chain (Nachos). No timer needed.'],
  [46246, 'Levinchrome Aethersand', 'Market Board', null, null, null,
    'Aetherial reduction byproduct — not directly gatherable. Purchase from Market Board.'],
  [36097, 'Alien Onion', 'Botany', 'Regular Node', 'Elpis', 'X:26.1, Y:27.3',
    'Level 88 regular Botany node in Elpis.'],
  [36089, 'Giant Popoto', 'Botany', 'Regular Node', 'Labyrinthos', 'X:29.5, Y:19.8',
    'Level 83 regular Botany node in Labyrinthos.'],
];

async function migrate() {
  console.log('Seeding ingredient_overrides…');

  // Self-contained: ensure the table exists (mirrors migrate-cooking.js).
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

  let n = 0;
  for (const [item_id, item_name, source, node_name, zone, coords, notes] of OVERRIDES) {
    await pool.query(
      `INSERT INTO ingredient_overrides (item_id, item_name, source, node_name, zone, coords, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (item_id) DO UPDATE SET
         item_name = EXCLUDED.item_name,
         source    = EXCLUDED.source,
         node_name = EXCLUDED.node_name,
         zone      = EXCLUDED.zone,
         coords    = EXCLUDED.coords,
         notes     = EXCLUDED.notes`,
      [item_id, item_name, source, node_name, zone, coords, notes]
    );
    n++;
  }
  console.log(`  upserted ${n} overrides`);

  const { rows } = await pool.query(
    'SELECT item_id, item_name, source, zone, coords FROM ingredient_overrides ORDER BY item_name'
  );
  console.log('  current table:');
  rows.forEach((r) => console.log(`    ${r.item_name} (${r.item_id}) → ${r.source}${r.zone ? ' @ ' + r.zone + ' ' + (r.coords || '') : ''}`));
  console.log('ingredient_overrides migration complete.');
  await pool.end();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
