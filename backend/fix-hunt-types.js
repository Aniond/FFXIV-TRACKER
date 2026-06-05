require('dotenv').config();
const { Pool } = require('pg');

/**
 * fix-hunt-types.js — normalize hunts.type to the official Dawntrail
 * "Dawn Hunt" tiers and retire legacy generic mark-type values
 * (Wanted/Notorious/Elite Mark) found in prod.
 *
 * Valid type values (Clan Hunt Board / Dawn Mark Bills, Dawntrail 7.0):
 *   Beginner Dawn Hunt      (B-rank, lower zones)
 *   Intermediate Dawn Hunt  (B-rank, higher zones)
 *   Advanced Dawn Hunt      (A-rank)
 *   Elite Dawn Hunt         (S-rank)
 *
 * Mapping of the legacy values:
 *   Elite Mark      (S) -> Elite Dawn Hunt        [unambiguous]
 *   Notorious Mark  (A) -> Advanced Dawn Hunt     [unambiguous]
 *   Wanted Mark     (B) -> Beginner | Intermediate, decided by ZONE (below),
 *                          because all B-rank marks share the same reward so
 *                          reward alone can't disambiguate the two B tiers.
 *
 * The Beginner/Intermediate zone split is not well documented externally; this
 * mirrors the convention already present in the seed data. Adjust the two sets
 * below if the intended split differs.
 *
 * Read-only by default. Set APPLY=1 to write.
 *   railway run --service Postgres node fix-hunt-types.js                    # dry run
 *   railway run --service Postgres sh -c 'APPLY=1 node fix-hunt-types.js'    # write
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const VALID = new Set([
  'Beginner Dawn Hunt', 'Intermediate Dawn Hunt', 'Advanced Dawn Hunt', 'Elite Dawn Hunt',
]);

// B-rank zone -> tier. Default mirrors the existing seed (Urqopacha/Kozama'uka
// = Beginner; the remaining DT zones = Intermediate).
const BEGINNER_ZONES = new Set(['Urqopacha', "Kozama'uka"]);
const INTERMEDIATE_ZONES = new Set(["Yak T'el", 'Shaaloani', 'Heritage Found', 'Living Memory']);

function correctType(h) {
  const t = (h.type || '').trim();
  if (VALID.has(t)) return t; // already a valid Dawn Hunt tier — leave untouched
  const rank = (h.rank || '').trim().toUpperCase();
  const zone = (h.zone || '').trim();
  if (rank === 'S') return 'Elite Dawn Hunt';
  if (rank === 'A') return 'Advanced Dawn Hunt';
  if (rank === 'B') {
    if (BEGINNER_ZONES.has(zone)) return 'Beginner Dawn Hunt';
    if (INTERMEDIATE_ZONES.has(zone)) return 'Intermediate Dawn Hunt';
    return null; // unknown zone — don't guess
  }
  return null; // unknown rank — don't guess
}

(async () => {
  const apply = process.env.APPLY === '1';
  const { rows } = await pool.query('SELECT id, name, rank, zone, type, reward FROM hunts ORDER BY id');

  const fixes = [];
  const unmappable = [];
  for (const h of rows) {
    const want = correctType(h);
    if (want === null) { unmappable.push(h); continue; }
    if (want !== (h.type || '').trim()) fixes.push({ ...h, want });
  }

  console.log(`Total hunts: ${rows.length}   Rows needing a type fix: ${fixes.length}\n`);
  for (const f of fixes) {
    console.log(`  #${String(f.id).padStart(3)} ${String(f.name).padEnd(24)} [${f.rank}] ${String(f.zone || '?').padEnd(15)} "${f.type}" -> "${f.want}"`);
  }
  if (unmappable.length) {
    console.log('\n⚠ NOT MAPPED (unknown rank/zone — left as-is for manual review):');
    unmappable.forEach((h) => console.log(`  #${h.id} ${h.name} rank="${h.rank}" zone="${h.zone}" type="${h.type}"`));
  }

  if (!apply) {
    console.log('\nDRY RUN — no rows written. Re-run with APPLY=1 to apply.');
    await pool.end();
    return;
  }

  let n = 0;
  for (const f of fixes) { await pool.query('UPDATE hunts SET type = $1 WHERE id = $2', [f.want, f.id]); n++; }
  console.log(`\n✓ Applied ${n} updates.`);
  const after = await pool.query('SELECT DISTINCT type FROM hunts ORDER BY type');
  const types = after.rows.map((r) => r.type);
  console.log('Distinct types now:', JSON.stringify(types));
  const extra = types.filter((t) => !VALID.has(t));
  console.log(extra.length ? `⚠ Still-invalid: ${JSON.stringify(extra)}` : '✓ Exactly the 4 valid Dawn Hunt tiers.');
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
