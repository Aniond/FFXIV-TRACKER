require('dotenv').config();
const pool = require('../db');

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
 * recipe ingredients) and re-run against prod. NOTE: link the *Postgres*
 * service, not FFXIV-TRACKER — DATABASE_PUBLIC_URL only exists on Postgres
 * (the app service's DATABASE_URL is the internal host, unreachable locally):
 *   railway link --project ffxivlog-backend --environment production --service Postgres
 *   railway run sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL NODE_ENV=production node scripts/migrate-overrides.js'
 *
 * source ∈ 'Fishing' | 'Mining' | 'Botany' | 'Market Board' | 'Scrip Exchange' | 'Gemstone'
 *
 * Rows may carry an optional trailing { price, currency } object — used for
 * scrip/gemstone purchases so the UI can show the cost chip (e.g. aethersands).
 */
const OVERRIDES = [
  // item_id, item_name, source, node_name, zone, coords, notes
  // NOTE: scrape-cooking.js now classifies Scrip Exchange / Bicolor Gemstone
  // shops natively (buildSpecialShopIndex), so the baked source for these is
  // already correct. These rows are kept only to UPDATE the previously-wrong
  // prod rows on re-run (upsert-only migration won't delete them otherwise).
  [49233, 'Quahog', 'Scrip Exchange', null, null, null,
    "Orange Crafters' Scrip ×15 (Lv.100 Materials), or buy on the Market Board. Not gathered."],
  [39865, 'Dark Eggplant', 'Scrip Exchange', null, null, null,
    "Purple Crafters' Scrip ×10 (Lv.90 Materials), or Market Board. NOT gatherable — the prior 'Botany' label was wrong (verified via Lodestone/Teamcraft)."],

  // Added from in-game verification (cooking tips):
  [49229, 'Flint Corn', 'Scrip Exchange', null, null, null,
    "Orange Crafters' Scrip ×15 (Lv.100 Materials), or Market Board. Not gatherable."],
  [43978, "Ut'ohmu Tomato", 'Botany', 'Regular Node', "Yak T'el", 'X:11.6, Y:19.3',
    'Level 95 regular node. Found via Ut\'ohmu Chili Sauce subcraft chain (Nachos). No timer needed.'],
  // Aethersands — purchasable with Gatherers' Scrips at any Scrip Exchange, or
  // obtained by aetherial reduction of ephemeral-node collectables (windows are
  // Eorzea Time; ephemeral nodes stay up 4 ET hours). Sources: Garland Tools +
  // Teamcraft node data, scraped 2026-06-10.
  [46246, 'Levinchrome Aethersand', 'Scrip Exchange', 'Scrip Exchange NPC', 'Multiple Cities', null,
    "Orange Gatherers' Scrips ×300, or aetherial reduction of Levin Quartz (Mining — Living Memory, The Knowable, X:10.5 Y:11.1, ET 0:00–4:00), Calamus Root (Botany — Living Memory, Matchlock Menagerie, X:26.9 Y:7.4, ET 16:00–20:00), or Purple Palate (Fishing — Living Memory). Also on the Market Board.",
    { price: 300, currency: "Orange Gatherers' Scrip" }],
  [44035, 'Sungilt Aethersand', 'Scrip Exchange', 'Scrip Exchange NPC', 'Multiple Cities', null,
    "Orange Gatherers' Scrips ×100, or aetherial reduction of Goldbranch (Botany — Shaaloani, Eshceyaani Wilds, X:16.3 Y:10.4, ET 4:00–8:00), Electrocoal (Mining — Heritage Found, East Yyasulani, X:26.7 Y:12.2, ET 20:00–24:00), Sunlit Prism (Mining — Yak T'el, X:28.8 Y:4.7), or Horned Frog / Shovelnose Catfish (Fishing). Also on the Market Board.",
    { price: 100, currency: "Orange Gatherers' Scrip" }],
  [36223, 'Moonlight Aethersand', 'Scrip Exchange', 'Scrip Exchange NPC', 'Multiple Cities', null,
    "Purple Gatherers' Scrips ×10, or aetherial reduction of Lunar Quartz (Mining — Mare Lamentorum, The Numbing Brand, X:21.7 Y:34.7, ET 0:00–4:00), Ewer Clay (Botany — Labyrinthos, Logistikon Gamma, X:10.6 Y:34.8, ET 8:00–12:00), or Gilled Topknot (Fishing — Thavnair, Southern/Outer Akyaali). Also on the Market Board.",
    { price: 10, currency: "Purple Gatherers' Scrip" }],
  [38936, 'Earthbreak Aethersand', 'Scrip Exchange', 'Scrip Exchange NPC', 'Multiple Cities', null,
    "Purple Gatherers' Scrips ×30, or aetherial reduction of Earthen Quartz (Mining — Mare Lamentorum, The Numbing Brand, X:21.7 Y:34.7, ET 0:00–4:00), Sophora Roots (Botany — Labyrinthos, Logistikon Gamma, X:10.6 Y:34.8, ET 8:00–12:00), or Nosceasaur / Verdigris Guppy (Fishing — Upper La Noscea, Northeast Bronze Lake). Also on the Market Board.",
    { price: 30, currency: "Purple Gatherers' Scrip" }],
  [4767, 'Raptor Shank', 'Market Board', null, null, null,
    'Mob drop — hunt raptors: Grass Raptor (Lv.32, Eastern La Noscea), Velociraptor (Lv.34, Outer La Noscea), Territorial Raptor (Lv.36, Upper La Noscea), Lindwurm (Lv.28–33, Central Shroud). Otherwise Market Board.'],
  [36097, 'Alien Onion', 'Botany', 'Regular Node', 'Elpis', 'X:26.1, Y:27.3',
    'Level 88 regular Botany node in Elpis.'],
  [36089, 'Giant Popoto', 'Botany', 'Regular Node', 'Labyrinthos', 'X:29.5, Y:19.8',
    'Level 83 regular Botany node in Labyrinthos.'],

  // Scrip Exchange examples — bought from Scrip Exchange NPCs with crafter/gatherer
  // scrips, NOT the Market Board. (item_id is the table PK; the AI matches by name.)
  [38932, "Craftsman's Alkahest", 'Scrip Exchange', 'Scrip Exchange NPC', 'Multiple Cities', null,
    "Purchased with White Crafters' Scrips from the Scrip Exchange in Limsa/Gridania/Ul'dah/Ishgard/Radz-at-Han/Old Sharlayan."],
  [41780, "Craftsman's Command Materia", 'Scrip Exchange', 'Scrip Exchange NPC', 'Multiple Cities', null,
    "Purchased with Purple Crafters' Scrips."],
];

async function migrate() {
  console.log('Seeding ingredient_overrides…');

  // Self-contained: ensure the table exists (mirrors migrate-cooking.js).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingredient_overrides (
      item_id   INTEGER PRIMARY KEY,
      item_name VARCHAR(255),
      source    VARCHAR(20),  -- 'Fishing' | 'Mining' | 'Botany' | 'Market Board' | 'Scrip Exchange' | 'Gemstone'
      node_name VARCHAR(255),
      zone      VARCHAR(100),
      coords    VARCHAR(50),
      notes     TEXT
    );
  `);
  // price/currency: scrip & gemstone purchase cost (added 2026-06-10).
  await pool.query(`ALTER TABLE ingredient_overrides ADD COLUMN IF NOT EXISTS price INTEGER`);
  await pool.query(`ALTER TABLE ingredient_overrides ADD COLUMN IF NOT EXISTS currency VARCHAR(60)`);

  let n = 0;
  for (const [item_id, item_name, source, node_name, zone, coords, notes, cost] of OVERRIDES) {
    await pool.query(
      `INSERT INTO ingredient_overrides (item_id, item_name, source, node_name, zone, coords, notes, price, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (item_id) DO UPDATE SET
         item_name = EXCLUDED.item_name,
         source    = EXCLUDED.source,
         node_name = EXCLUDED.node_name,
         zone      = EXCLUDED.zone,
         coords    = EXCLUDED.coords,
         notes     = EXCLUDED.notes,
         price     = EXCLUDED.price,
         currency  = EXCLUDED.currency`,
      [item_id, item_name, source, node_name, zone, coords, notes, cost?.price ?? null, cost?.currency ?? null]
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
