require('dotenv').config();
const { Pool } = require('pg');

/**
 * trim-hunts-to-marks.js — reduce the hunts table to the 30 real Dawntrail
 * hunt marks (2 B-rank + 2 A-rank + 1 S-rank per zone, ids 116-145, verified
 * vs consolegameswiki + Destructoid). Everything else (ids < 116) is normal
 * open-world enemies that were mislabeled as Dawn Hunt marks by a bad import.
 *
 * Refuses to run unless the survivor set is exactly the expected 30 marks.
 *
 * Read-only by default. Set APPLY=1 to delete.
 *   railway run --service Postgres node trim-hunts-to-marks.js                  # dry run
 *   railway run --service Postgres sh -c 'APPLY=1 node trim-hunts-to-marks.js'  # delete
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ZONES = ["Urqopacha", "Kozama'uka", "Yak T'el", 'Shaaloani', 'Heritage Found', 'Living Memory'];

(async () => {
  const apply = process.env.APPLY === '1';
  const all = (await pool.query('SELECT id, name, rank, zone, type FROM hunts ORDER BY id')).rows;

  const keep = all.filter((h) => h.id >= 116 && h.id <= 145);
  const drop = all.filter((h) => h.id < 116);

  // ---- safety invariant: the survivors must be exactly the 30 real marks ----
  const bad = [];
  for (const z of ZONES) {
    const b = keep.filter((h) => h.zone === z && h.rank === 'B').length;
    const a = keep.filter((h) => h.zone === z && h.rank === 'A').length;
    const s = keep.filter((h) => h.zone === z && h.rank === 'S').length;
    if (b !== 2 || a !== 2 || s !== 1) bad.push(`${z}: B${b}/A${a}/S${s} (want B2/A2/S1)`);
  }
  const ok = keep.length === 30 && bad.length === 0;

  console.log(`Survivors (ids 116-145): ${keep.length}   |   To delete (ids < 116): ${drop.length}`);
  console.log('Per-zone survivor check:', bad.length ? '✗ ' + bad.join('; ') : '✓ every zone has exactly 2 B, 2 A, 1 S');
  console.log('\nSurvivors (the 30 real marks):');
  for (const z of ZONES) {
    const marks = keep.filter((h) => h.zone === z).sort((x, y) => 'BAS'.indexOf(x.rank) - 'BAS'.indexOf(y.rank));
    console.log(`  ${z}: ` + marks.map((h) => `${h.name}[${h.rank}]`).join(', '));
  }
  console.log(`\nSample of rows to delete: ${drop.slice(0, 12).map((h) => h.name).join(', ')} … (+${Math.max(0, drop.length - 12)} more)`);

  if (!ok) { console.log('\n✗ Survivor set is not the expected 30 marks — ABORTING (no changes).'); await pool.end(); process.exit(1); }
  if (!apply) { console.log('\nDRY RUN — nothing deleted. Re-run with APPLY=1.'); await pool.end(); return; }

  const res = await pool.query('DELETE FROM hunts WHERE id < 116');
  console.log(`\n✓ Deleted ${res.rowCount} mislabeled rows.`);
  const total = (await pool.query('SELECT COUNT(*)::int n FROM hunts')).rows[0].n;
  const types = (await pool.query('SELECT DISTINCT type FROM hunts ORDER BY type')).rows.map((r) => r.type);
  console.log(`Rows now: ${total}`);
  console.log('Distinct types:', JSON.stringify(types));
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
