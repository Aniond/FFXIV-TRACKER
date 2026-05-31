require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = `
INSERT INTO hunts (id, name, rank, type, bill_number, zone, area, coords, coords_note, targets, reward, authority, tips, status) VALUES
(1, 'Mourner', 'B', 'Intermediate Dawn Hunt', '1/5', 'Yak T''el', 'The Ja Tiika Heartland', '~X:22, Y:28', 'Roams central forest area', 2, '1,000 Gil · 4 Sacks of Nuts · 471,744 EXP', 'Dawn Hunt', ARRAY['2 targets — kill both to complete.', 'Found in the lower Ja Tiika Heartland jungle.', 'Roaming mob — patrol until you find both.'], 'done'),
(2, 'Blue Morpho', 'B', 'Intermediate Dawn Hunt', '2/5', 'Yak T''el', 'The Cerulean Cexudross', '~X:18, Y:32', 'Roams lower forest area', 3, '1,000 Gil · 4 Sacks of Nuts · 471,744 EXP', 'Dawn Hunt', ARRAY['3 targets — kill all 3 to complete.', 'Large blue butterflies in the lower Yak T''el forest.', 'Same lower forest tier as Mourner — do both together.'], 'done'),
(3, 'Balyaborr', 'B', 'Intermediate Dawn Hunt', '3/5', 'Yak T''el', 'The Ut''ohmu Horizon', '~X:31, Y:11', 'Roams — NE of map', 1, '1,000 Gil · 4 Sacks of Nuts · 471,744 EXP', 'Dawn Hunt', ARRAY['B ranks roam continuously — no fixed spawn timer.', 'Teleport to Dirigible Landing aetheryte and sweep open ground north.', 'Single-target kill — soloable.'], 'todo'),
(4, 'Aspis', 'B', 'Intermediate Dawn Hunt', '4/5', 'Shaaloani', 'Eshceyaani Wilds', '~X:26, Y:10', 'Roams the wilds — snake-heavy area', 3, '1,000 Gil · 4 Sacks of Nuts · 471,744 EXP', 'Dawn Hunt', ARRAY['3 targets — kill all 3 Aspis to complete.', 'Common open-world snakes — easy to spot.', 'Plentiful in the area — shouldn''t take long.'], 'todo'),
(5, 'Horned Lizard', 'B', 'Intermediate Dawn Hunt', '5/5', 'Shaaloani', 'Eshceyaani Wilds', 'X:11.7, Y:13.7', 'Roams — same area as Aspis', 2, '1,000 Gil · 4 Sacks of Nuts · 471,744 EXP', 'Dawn Hunt', ARRAY['2 targets — kill both to complete.', 'Same area as Aspis — do both in one run.', 'Aggressive — will attack on sight.'], 'todo'),
(6, 'Hammerhead Crocodile', 'B', 'Advanced Dawn Hunt', '1/5', 'Kozama''uka', 'Uyuyub''', 'X:11, Y:9', 'NW of Ok''hanu — watch for Beginner-rank nearby', 1, '1,500 Gil · 15 Sacks of Nuts · 471,744 EXP', 'Dawn Hunt', ARRAY['1 target — soloable.', 'NW of Ok''hanu at X:11 Y:9.', 'Caution: a Beginner-rank Hammerhead Crocodile roams nearby — different bill tier.'], 'todo'),
(7, 'Yak T''el Squib', 'B', 'Advanced Dawn Hunt', '2/5', 'Yak T''el', 'Iq Rrax Tsoly', '~X:28, Y:20', 'Roams the lake area', 2, '1,500 Gil · 15 Sacks of Nuts · 471,744 EXP', 'Dawn Hunt', ARRAY['2 targets — kill both to complete.', 'Found around the Iq Rrax Tsoly lake area.'], 'done'),
(8, 'Turali Hawksbill', 'B', 'Advanced Dawn Hunt', '3/5', 'Shaaloani', 'Pyariyoanaan Plain', '~X:20, Y:30', 'Roams open plains area', 2, '1,500 Gil · 15 Sacks of Nuts · 471,744 EXP', 'Dawn Hunt', ARRAY['2 targets — kill both to complete.', 'Large turtles on the Pyariyoanaan Plain.', 'Open terrain — visible from a distance.'], 'todo'),
(9, 'Defective Turret', 'B', 'Advanced Dawn Hunt', '4/5', 'Heritage Found', 'East Yyasulani', '~X:30, Y:15', 'Roams east sector', 3, '1,500 Gil · 15 Sacks of Nuts · 471,744 EXP', 'Dawn Hunt', ARRAY['3 targets — kill all 3 to complete.', 'Mechanical enemies in East Yyasulani.', 'Watch for explosive attacks.'], 'todo'),
(10, 'Matchlock Scorpion', 'B', 'Advanced Dawn Hunt', '5/5', 'Living Memory', 'Matchlock Menagerie', '~X:25, Y:20', 'Roams Matchlock Menagerie', 1, '1,500 Gil · 15 Sacks of Nuts · 471,744 EXP', 'Dawn Hunt', ARRAY['1 target — soloable.', 'Found in the Matchlock Menagerie section of Living Memory.', 'Vilekin-type — watch for poison attacks.'], 'todo'),
(11, 'Chupacabra', 'B', 'Elite Dawn Hunt', 'Weekly', 'Urqopacha', 'Urqopacha', 'X:16-32, Y:8-30', 'Multiple spawn points — use Faloop or hunt Discord', 1, '5,000 Gil · 100 Sacks of Nuts', 'Dawn Hunt', ARRAY['Weekly Elite mark — massive rewards.', 'Watch for Triclip — telegraphed column AoE.', 'Group up — tough solo.', 'Use Faloop.app or hunt Discord for live callouts.', 'Respawns 5 seconds after previous kill.'], 'todo'),
(12, 'Megamaguey', 'B', 'Beginner Dawn Hunt', '1/5', 'Urqopacha', 'Chabameki', 'X:18, Y:13', 'Northern Urqopacha — large group spawns here', 1, '1,000 Gil · 3 Sacks of Nuts · 465,696 EXP', 'Dawn Hunt', ARRAY['1 target — soloable.', 'Spawns in a large group at X:18 Y:13 — easy to find.', 'Level 91 mob — accessible early in Dawntrail.'], 'todo'),
(13, 'Bandercoeurl', 'B', 'Beginner Dawn Hunt', '2/5', 'Urqopacha', 'Chabameki', '~X:12, Y:11', 'Roams NW Chabameki area', 1, '1,000 Gil · 3 Sacks of Nuts · 465,696 EXP', 'Dawn Hunt', ARRAY['1 target — soloable.', 'Same general area as Megamaguey — efficient to do both together.', 'Beastkin-type enemy.'], 'todo'),
(14, 'Jungle Iguana', 'B', 'Beginner Dawn Hunt', '3/5', 'Kozama''uka', 'The Glostfired Bank', '~X:22, Y:18', 'Roams the Glostfired Bank jungle', 2, '1,000 Gil · 3 Sacks of Nuts · 465,696 EXP', 'Dawn Hunt', ARRAY['2 targets — kill both to complete.', 'Found in the Glostfired Bank area of Kozama''uka.', 'Common lizard mob — easy to spot.'], 'todo'),
(15, 'Hammerhead Crocodile', 'B', 'Beginner Dawn Hunt', '4/5', 'Kozama''uka', 'Uyuyub''', 'X:11, Y:9', 'Same area as Advanced version — different bill tier', 1, '1,000 Gil · 3 Sacks of Nuts · 465,696 EXP', 'Dawn Hunt', ARRAY['1 target — soloable.', 'Same mob and location as Advanced 1/5 bill.', 'Check bill tier before accepting — rewards differ significantly.'], 'todo'),
(16, 'Woodsman', 'B', 'Beginner Dawn Hunt', '5/5', 'Kozama''uka', 'Uyuypoga', '~X:15, Y:25', 'Roams Uyuypoga jungle area', 2, '1,000 Gil · 3 Sacks of Nuts · 465,696 EXP', 'Dawn Hunt', ARRAY['2 targets — kill both to complete.', 'Plant-type enemy in the Uyuypoga area.', 'Roaming mob — patrol the jungle until you find both.'], 'todo')
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  rank        = EXCLUDED.rank,
  type        = EXCLUDED.type,
  bill_number = EXCLUDED.bill_number,
  zone        = EXCLUDED.zone,
  area        = EXCLUDED.area,
  coords      = EXCLUDED.coords,
  coords_note = EXCLUDED.coords_note,
  targets     = EXCLUDED.targets,
  reward      = EXCLUDED.reward,
  authority   = EXCLUDED.authority,
  tips        = EXCLUDED.tips,
  status      = EXCLUDED.status;
`;

const verifySQL = `SELECT id, name, type FROM hunts ORDER BY id`;

async function run() {
  await pool.query(sql);
  console.log('Seed complete.');
  const result = await pool.query(verifySQL);
  console.log(`\n${result.rows.length} hunts in table:\n`);
  result.rows.forEach(r => console.log(`  ${r.id}. [${r.type}] ${r.name}`));
  await pool.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
