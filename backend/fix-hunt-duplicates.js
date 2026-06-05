require('dotenv').config();
const { Pool } = require('pg');

/**
 * fix-hunt-duplicates.js — retire the original hand-made seed (hunts 1-11),
 * which is superseded by the accurate full Dawntrail roster (rows 17+).
 *
 *  DUPLICATE_IDS — B-rank monsters the seed mis-entered as A/S; each duplicates
 *  its correct B-rank entry in the full roster (verified vs the authoritative
 *  Dawntrail A/S-rank list). Deleted only if that B-rank keeper still exists:
 *    #6  Hammerhead Crocodile (A) -> dup of #15 (B)
 *    #7  Yak T'el Squib       (A) -> dup of #66 (B)
 *    #8  Turali Hawksbill     (A) -> dup of #76 (B)
 *    #11 Chupacabra           (S) -> dup of #118 (B);  Urqopacha S = Kirlirger #141
 *
 *  RETIRE_IDS — early placeholder samples not present in the real roster
 *  (#1-5) and seed rows mis-marked A-rank that aren't real A-ranks (#9-10).
 *
 * Read-only by default. Set APPLY=1 to delete.
 *   railway run --service Postgres node fix-hunt-duplicates.js                  # dry run
 *   railway run --service Postgres sh -c 'APPLY=1 node fix-hunt-duplicates.js'  # delete
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DUPLICATE_IDS = [6, 7, 8, 11];
const RETIRE_IDS = [1, 2, 3, 4, 5, 9, 10];

(async () => {
  const apply = process.env.APPLY === '1';
  const all = (await pool.query('SELECT id, name, rank, zone, type FROM hunts')).rows;
  const byId = new Map(all.map((h) => [h.id, h]));

  const toDelete = [];
  let safe = true;

  console.log('Duplicates (delete only if a B-rank keeper survives):');
  for (const id of DUPLICATE_IDS) {
    const h = byId.get(id);
    if (!h) { console.log(`  #${id}: already absent`); continue; }
    const keeper = all.find((x) => x.id !== id && x.name === h.name && x.rank === 'B');
    if (!keeper) safe = false;
    console.log(`  ${keeper ? '✓' : '✗ NO KEEPER'} #${h.id} ${h.name} [${h.rank}/${h.type}]` +
      (keeper ? `  -> keep #${keeper.id} [${keeper.type}]` : '  <-- SKIP'));
    if (keeper) toDelete.push(h);
  }

  console.log('\nPlaceholders / mis-ranked seed rows (retire):');
  for (const id of RETIRE_IDS) {
    const h = byId.get(id);
    if (!h) { console.log(`  #${id}: already absent`); continue; }
    console.log(`  • #${h.id} ${h.name} [${h.rank}/${h.type}] @ ${h.zone}`);
    toDelete.push(h);
  }

  console.log(`\nTotal to delete: ${toDelete.length}  (table currently ${all.length} rows)`);

  if (!apply) { console.log('\nDRY RUN — nothing deleted. Re-run with APPLY=1.'); await pool.end(); return; }
  if (!safe) { console.log('\nAborting: a duplicate had no surviving keeper.'); await pool.end(); process.exit(1); }

  const ids = toDelete.map((h) => h.id);
  const res = await pool.query('DELETE FROM hunts WHERE id = ANY($1)', [ids]);
  console.log(`\n✓ Deleted ${res.rowCount} rows.`);

  const total = (await pool.query('SELECT COUNT(*)::int n FROM hunts')).rows[0].n;
  const dupNames = (await pool.query('SELECT name, COUNT(*) c FROM hunts GROUP BY name HAVING COUNT(*) > 1 ORDER BY name')).rows;
  const types = (await pool.query('SELECT DISTINCT type FROM hunts ORDER BY type')).rows.map((r) => r.type);
  console.log(`Rows now: ${total}`);
  console.log('Duplicate names now:', dupNames.length ? JSON.stringify(dupNames) : 'none ✓');
  console.log('Distinct types:', JSON.stringify(types));
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
