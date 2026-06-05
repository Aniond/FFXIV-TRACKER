require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Canonical seed: the 30 real Dawntrail hunt marks (2 B-rank + 2 A-rank + 1
// S-rank per zone), verified vs consolegameswiki + Destructoid. The hunts table
// was trimmed to exactly these by trim-hunts-to-marks.js, which removed 104
// normal-enemy rows a bad import had mislabeled as Dawn Hunt marks.
const sql = `
INSERT INTO hunts (id, name, rank, type, bill_number, zone, area, coords, coords_note, targets, reward, authority, tips, status) VALUES
(116, 'Go''ozoabek''be', 'B', 'Beginner Dawn Hunt', 'Daily', 'Kozama''uka', 'Kozama''uka', '', '', 1, '10 Sacks of Nuts · 1,000 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(117, 'The Slammer', 'B', 'Beginner Dawn Hunt', 'Daily', 'Kozama''uka', 'Kozama''uka', '', '', 1, '10 Sacks of Nuts · 1,000 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(118, 'Chupacabra', 'B', 'Beginner Dawn Hunt', 'Daily', 'Urqopacha', 'Urqopacha', '', '', 1, '10 Sacks of Nuts · 1,000 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(119, 'Mad Maguey', 'B', 'Beginner Dawn Hunt', 'Daily', 'Urqopacha', 'Urqopacha', '', '', 1, '10 Sacks of Nuts · 1,000 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(120, 'Leafscourge Hadoll Ja', 'B', 'Intermediate Dawn Hunt', 'Daily', 'Yak T''el', 'Yak T''el', '', '', 1, '10 Sacks of Nuts · 1,000 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(121, 'Xty''iinbek', 'B', 'Intermediate Dawn Hunt', 'Daily', 'Yak T''el', 'Yak T''el', '', '', 1, '10 Sacks of Nuts · 1,000 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(122, 'Nopalitender Fabuloso', 'B', 'Intermediate Dawn Hunt', 'Daily', 'Shaaloani', 'Shaaloani', '', '', 1, '10 Sacks of Nuts · 1,000 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(123, 'Uktena', 'B', 'Intermediate Dawn Hunt', 'Daily', 'Shaaloani', 'Shaaloani', '', '', 1, '10 Sacks of Nuts · 1,000 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(124, 'Gallowsbeak', 'B', 'Intermediate Dawn Hunt', 'Daily', 'Heritage Found', 'Heritage Found', '', '', 1, '10 Sacks of Nuts · 1,000 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(125, 'Gargant', 'B', 'Intermediate Dawn Hunt', 'Daily', 'Heritage Found', 'Heritage Found', '', '', 1, '10 Sacks of Nuts · 1,000 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(126, '13th Child', 'B', 'Intermediate Dawn Hunt', 'Daily', 'Living Memory', 'Living Memory', '', '', 1, '10 Sacks of Nuts · 1,000 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(127, 'Jewel Bearer', 'B', 'Intermediate Dawn Hunt', 'Daily', 'Living Memory', 'Living Memory', '', '', 1, '10 Sacks of Nuts · 1,000 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(128, 'Pkuucha', 'A', 'Advanced Dawn Hunt', 'Daily', 'Kozama''uka', 'Kozama''uka', '', '', 1, '40 Sacks of Nuts · 1,500 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(129, 'The Raintriller', 'A', 'Advanced Dawn Hunt', 'Daily', 'Kozama''uka', 'Kozama''uka', '', '', 1, '40 Sacks of Nuts · 1,500 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(130, 'Nechuciho', 'A', 'Advanced Dawn Hunt', 'Daily', 'Urqopacha', 'Urqopacha', '', '', 1, '40 Sacks of Nuts · 1,500 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(131, 'Queen Hawk', 'A', 'Advanced Dawn Hunt', 'Daily', 'Urqopacha', 'Urqopacha', '', '', 1, '40 Sacks of Nuts · 1,500 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(132, 'Rrax Yity''a', 'A', 'Advanced Dawn Hunt', 'Daily', 'Yak T''el', 'Yak T''el', '', '', 1, '40 Sacks of Nuts · 1,500 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(133, 'Starcrier', 'A', 'Advanced Dawn Hunt', 'Daily', 'Yak T''el', 'Yak T''el', '', '', 1, '40 Sacks of Nuts · 1,500 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(134, 'Keheniheyamewi', 'A', 'Advanced Dawn Hunt', 'Daily', 'Shaaloani', 'Shaaloani', '', '', 1, '40 Sacks of Nuts · 1,500 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(135, 'Yehehetoaua''pyo', 'A', 'Advanced Dawn Hunt', 'Daily', 'Shaaloani', 'Shaaloani', '', '', 1, '40 Sacks of Nuts · 1,500 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(136, 'Heshuala', 'A', 'Advanced Dawn Hunt', 'Daily', 'Heritage Found', 'Heritage Found', '', '', 1, '40 Sacks of Nuts · 1,500 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(137, 'Urna Variabilis', 'A', 'Advanced Dawn Hunt', 'Daily', 'Heritage Found', 'Heritage Found', '', '', 1, '40 Sacks of Nuts · 1,500 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(138, 'Cat''s Eye', 'A', 'Advanced Dawn Hunt', 'Daily', 'Living Memory', 'Living Memory', '', '', 1, '40 Sacks of Nuts · 1,500 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(139, 'Sally the Sweeper', 'A', 'Advanced Dawn Hunt', 'Daily', 'Living Memory', 'Living Memory', '', '', 1, '40 Sacks of Nuts · 1,500 Gil', 'Dawn Hunt', ARRAY[]::text[], 'todo'),
(140, 'Ihnuxokiy', 'S', 'Elite Dawn Hunt', 'Weekly', 'Kozama''uka', 'Kozama''uka', '', 'Check spawn trigger', 1, '100 Sacks of Nuts · 5,000 Gil', 'Dawn Hunt', ARRAY['Use the Morpho minion on spawn points.'], 'todo'),
(141, 'Kirlirger the Abhorrent', 'S', 'Elite Dawn Hunt', 'Weekly', 'Urqopacha', 'Urqopacha', '', 'Check spawn trigger', 1, '100 Sacks of Nuts · 5,000 Gil', 'Dawn Hunt', ARRAY['Be on a spawn point during fog and a new moon.'], 'todo'),
(142, 'Neyoozoteel', 'S', 'Elite Dawn Hunt', 'Weekly', 'Yak T''el', 'Yak T''el', '', 'Check spawn trigger', 1, '100 Sacks of Nuts · 5,000 Gil', 'Dawn Hunt', ARRAY['Discard a stack of at least 50 Fish Meal.'], 'todo'),
(143, 'Sansheya', 'S', 'Elite Dawn Hunt', 'Weekly', 'Shaaloani', 'Shaaloani', '', 'Check spawn trigger', 1, '100 Sacks of Nuts · 5,000 Gil', 'Dawn Hunt', ARRAY['Complete '' You Are What You Drink'' FATE at (X:14, Y:23.5) three times in a row.'], 'todo'),
(144, 'Atticus the Primogenitor', 'S', 'Elite Dawn Hunt', 'Weekly', 'Heritage Found', 'Heritage Found', '', 'Check spawn trigger', 1, '100 Sacks of Nuts · 5,000 Gil', 'Dawn Hunt', ARRAY['Craft HQ Rroneek Steak.'], 'todo'),
(145, 'The Forecaster', 'S', 'Elite Dawn Hunt', 'Weekly', 'Living Memory', 'Living Memory', '', 'Check spawn trigger', 1, '100 Sacks of Nuts · 5,000 Gil', 'Dawn Hunt', ARRAY['Cast the blue mage action Northerlies on spawn points.'], 'todo')
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, rank=EXCLUDED.rank, type=EXCLUDED.type, bill_number=EXCLUDED.bill_number,
  zone=EXCLUDED.zone, area=EXCLUDED.area, coords=EXCLUDED.coords, coords_note=EXCLUDED.coords_note,
  targets=EXCLUDED.targets, reward=EXCLUDED.reward, authority=EXCLUDED.authority,
  tips=EXCLUDED.tips, status=EXCLUDED.status;
`;

async function run() {
  await pool.query(sql);
  const { rows } = await pool.query('SELECT id, name, type FROM hunts ORDER BY id');
  console.log(`Seed complete — ${rows.length} marks.`);
  rows.forEach((r) => console.log(`  ${r.id}. [${r.type}] ${r.name}`));
  await pool.end();
}

run().catch((e) => { console.error(e.message); process.exit(1); });
