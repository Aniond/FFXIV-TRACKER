require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// NOTE: the original hand-made sample rows 1-11 were RETIRED (see
// fix-hunt-duplicates.js): #6/7/8/11 were B-rank monsters mis-entered as A/S
// (duplicating their correct B-rank entries in the full roster), and #1-5/#9-10
// were placeholder/mis-ranked samples not present in the real Dawntrail roster.
// The authoritative roster lives in the DB (ids 12+). Ids start at 12 here.
const sql = `
INSERT INTO hunts (id, name, rank, type, bill_number, zone, area, coords, coords_note, targets, reward, authority, tips, status) VALUES
(12, 'Megamaguey', 'B', 'Beginner Dawn Hunt', '1/5', 'Urqopacha', 'Chabameki', 'X:18, Y:13', 'Northern Urqopacha — large group spawns here', 1, '1,000 Gil · 3 Sacks of Nuts · 465,696 EXP', 'Dawn Hunt', ARRAY['1 target — soloable.', 'Spawns in a large group at X:18 Y:13 — easy to find.', 'Level 91 mob — accessible early in Dawntrail.'], 'todo'),
(13, 'Bandercoeurl', 'B', 'Beginner Dawn Hunt', '2/5', 'Urqopacha', 'Chabameki', '~X:12, Y:11', 'Roams NW Chabameki area', 1, '1,000 Gil · 3 Sacks of Nuts · 465,696 EXP', 'Dawn Hunt', ARRAY['1 target — soloable.', 'Same general area as Megamaguey — efficient to do both together.', 'Beastkin-type enemy.'], 'todo'),
(14, 'Jungle Iguana', 'B', 'Beginner Dawn Hunt', '3/5', 'Kozama''uka', 'The Glostfired Bank', '~X:22, Y:18', 'Roams the Glostfired Bank jungle', 2, '1,000 Gil · 3 Sacks of Nuts · 465,696 EXP', 'Dawn Hunt', ARRAY['2 targets — kill both to complete.', 'Found in the Glostfired Bank area of Kozama''uka.', 'Common lizard mob — easy to spot.'], 'todo'),
(15, 'Hammerhead Crocodile', 'B', 'Beginner Dawn Hunt', '4/5', 'Kozama''uka', 'Uyuyub''', 'X:11, Y:9', 'NW of Ok''hanu', 1, '1,000 Gil · 3 Sacks of Nuts · 465,696 EXP', 'Dawn Hunt', ARRAY['1 target — soloable.', 'Common crocodilian in the Uyuyub'' area, NW of Ok''hanu.'], 'todo'),
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
