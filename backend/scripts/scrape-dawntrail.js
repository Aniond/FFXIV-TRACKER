/**
 * Dawntrail hunt scraper — ffxiv.consolegameswiki.com
 *
 * Dry-run (inspect only):
 *   node backend/scripts/scrape-dawntrail.js
 *
 * Write to Railway DB:
 *   railway run node backend/scripts/scrape-dawntrail.js --import
 */

require('dotenv').config();
const cheerio = require('cheerio');
const { Pool } = require('pg');

const DRY_RUN = !process.argv.includes('--import');
const BASE    = 'https://ffxiv.consolegameswiki.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; ffxivlog.com/1.0; hunt data collector)',
  'Accept': 'text/html,application/xhtml+xml',
};

const pool = DRY_RUN ? null : new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function get(path) {
  const res = await fetch(BASE + path, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${BASE + path}`);
  return res.text();
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
function parseCoords(raw) {
  // "(X:29.0, Y:9.1)" → "X:29.0, Y:9.1"
  return clean(raw).replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
}

// ── Constants ─────────────────────────────────────────────────────────────
const DT_ZONES = ["Urqopacha", "Kozama'uka", "Yak T'el", "Shaaloani", "Heritage Found", "Living Memory"];

const BILL_TYPE  = { 1: 'Beginner Dawn Hunt', 2: 'Intermediate Dawn Hunt', 3: 'Advanced Dawn Hunt' };
const BILL_RANK  = { 1: 'B', 2: 'B', 3: 'A' };  // Beginner=B, Intermediate=B, Advanced=A
const BILL_REWARD = {
  1: '1,000 Gil · 3 Sacks of Nuts · 465,696 EXP',
  2: '1,000 Gil · 4 Sacks of Nuts · 471,744 EXP',
  3: '1,500 Gil · 15 Sacks of Nuts · 471,744 EXP',
};
const RANK_REWARD = {
  B: '10 Sacks of Nuts · 1,000 Gil',
  A: '40 Sacks of Nuts · 1,500 Gil',
  S: '100 Sacks of Nuts · 5,000 Gil',
};
const RANK_TYPE = { B: 'Wanted Mark', A: 'Notorious Mark', S: 'Elite Mark' };

// ── Parsers ───────────────────────────────────────────────────────────────
function parseBillTable($, table, zone) {
  const hunts = [];
  $(table).find('tr').slice(1).each((_, row) => {
    const cells = $(row).find('td').map((_, td) => clean($(td).text())).get();
    if (cells.length < 5) return;
    const [nameRaw, coordsRaw, , billLevelRaw, targetsRaw] = cells;
    const name      = clean(nameRaw.replace(/style="[^"]*"\|/g, ''));
    const coords    = parseCoords(coordsRaw);
    const billLevel = parseInt(billLevelRaw, 10);
    const targets   = parseInt(targetsRaw, 10) || 1;
    if (!name || isNaN(billLevel) || billLevel < 1 || billLevel > 3) return;
    hunts.push({ name, zone, coords, billLevel, targets });
  });
  return hunts;
}

function parseEliteTable($, table) {
  const hunts = [];
  $(table).find('tr').slice(1).each((_, row) => {
    const cells = $(row).find('td').map((_, td) => clean($(td).text())).get();
    if (cells.length < 4) return;
    const [name, rank, area, spawn] = cells;
    if (!['B', 'A', 'S'].includes(rank)) return;
    // Only Dawntrail zones
    const zone = DT_ZONES.find(z => area.includes(z));
    if (!zone) return;
    hunts.push({ name: clean(name), rank, zone, area: clean(area), spawn: clean(spawn) });
  });
  return hunts;
}

// ── Main scrape ───────────────────────────────────────────────────────────
async function scrape() {
  console.log('Fetching /wiki/Dawn_Hunt …');
  const html = await get('/wiki/Dawn_Hunt');
  const $    = cheerio.load(html);

  // Associate each table with the nearest preceding h2/h3/h4 section heading
  const allElements = $('h2, h3, h4, table.table').toArray();
  let currentHeading = '';
  const tableZoneMap = new Map(); // table element → zone name

  for (const el of allElements) {
    const tag = el.tagName.toLowerCase();
    if (['h2', 'h3', 'h4'].includes(tag)) {
      currentHeading = clean($(el).text().replace(/\[.*?\]/g, ''));
    } else if (tag === 'table') {
      // Check if heading matches a DT zone
      const zone = DT_ZONES.find(z => currentHeading.includes(z));
      if (zone) tableZoneMap.set(el, zone);
      else tableZoneMap.set(el, currentHeading);
    }
  }

  const billRaw   = [];
  const eliteRaw  = [];

  $('table.table').each((_, table) => {
    const headers = $(table).find('tr').first().find('th')
      .map((_, th) => clean($(th).text())).get();

    if (headers.includes('Clan Mark Bill Level') && headers.includes('Coordinates')) {
      const zone = tableZoneMap.get(table) || 'Unknown';
      const rows = parseBillTable($, table, zone);
      billRaw.push(...rows);
    } else if (headers.includes('Rank') && headers.includes('Area') && headers.includes('Spawn (Trigger)')) {
      const rows = parseEliteTable($, table);
      eliteRaw.push(...rows);
    }
  });

  console.log(`  Bill marks parsed: ${billRaw.length}`);
  console.log(`  Elite marks parsed: ${eliteRaw.length}`);

  // Group bill marks by type and number them
  const byType = { 1: [], 2: [], 3: [] };
  for (const b of billRaw) byType[b.billLevel].push(b);

  const hunts = [];

  // Bills → numbered within each type
  for (const [lvl, list] of Object.entries(byType)) {
    const total = list.length;
    list.forEach((b, i) => {
      hunts.push({
        name:        b.name,
        rank:        BILL_RANK[lvl],
        type:        BILL_TYPE[lvl],
        bill_number: `${i + 1}/${total}`,
        zone:        b.zone,
        area:        b.zone,
        coords:      b.coords,
        coords_note: '',
        targets:     b.targets,
        reward:      BILL_REWARD[lvl],
        authority:   'Dawn Hunt',
        tips:        [],
        status:      'todo',
      });
    });
  }

  // Elite marks
  const eliteSeen = new Set();
  for (const e of eliteRaw) {
    const key = `${e.name}|${e.rank}`;
    if (eliteSeen.has(key)) continue;
    eliteSeen.add(key);
    const tips = e.spawn && e.spawn !== 'None' ? [e.spawn] : [];
    hunts.push({
      name:        e.name,
      rank:        e.rank,
      type:        RANK_TYPE[e.rank],
      bill_number: e.rank === 'S' ? 'Weekly' : 'Daily',
      zone:        e.zone,
      area:        e.area,
      coords:      '',
      coords_note: e.spawn && e.spawn !== 'None' ? 'Check spawn trigger' : '',
      targets:     1,
      reward:      RANK_REWARD[e.rank],
      authority:   'Dawn Hunt',
      tips,
      status:      'todo',
    });
  }

  return hunts;
}

// ── Import ────────────────────────────────────────────────────────────────
async function importHunts(hunts) {
  const types = [...new Set(hunts.map(h => h.type))];
  console.log(`\nImporting ${hunts.length} hunts (${types.join(', ')})`);

  // Sync sequence to avoid PK collisions with manually-seeded rows
  await pool.query(`SELECT setval('hunts_id_seq', (SELECT COALESCE(MAX(id), 0) FROM hunts))`);

  let inserted = 0, updated = 0;
  for (const h of hunts) {
    const existing = await pool.query(
      `SELECT id FROM hunts WHERE name = $1 AND zone = $2 AND type = $3`,
      [h.name, h.zone, h.type]
    );
    if (existing.rows[0]) {
      await pool.query(
        `UPDATE hunts SET rank=$2, bill_number=$3, area=$4, coords=$5, coords_note=$6,
         targets=$7, reward=$8, authority=$9, tips=$10 WHERE id=$1`,
        [existing.rows[0].id, h.rank, h.bill_number, h.area, h.coords,
         h.coords_note, h.targets, h.reward, h.authority, h.tips]
      );
      updated++;
    } else {
      await pool.query(
        `INSERT INTO hunts (name, rank, type, bill_number, zone, area, coords, coords_note, targets, reward, authority, tips, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [h.name, h.rank, h.type, h.bill_number, h.zone, h.area, h.coords,
         h.coords_note, h.targets, h.reward, h.authority, h.tips, h.status]
      );
      inserted++;
    }
  }

  await pool.query(`SELECT setval('hunts_id_seq', (SELECT MAX(id) FROM hunts))`);
  console.log(`Done: ${inserted} inserted, ${updated} updated.`);
}

// ── Entry ─────────────────────────────────────────────────────────────────
(async () => {
  const hunts = await scrape();

  if (DRY_RUN) {
    console.log(`\n=== DRY RUN — ${hunts.length} hunts would be imported ===`);
    const byType = {};
    for (const h of hunts) {
      byType[h.type] = (byType[h.type] || 0) + 1;
    }
    Object.entries(byType).forEach(([type, n]) => console.log(`  ${type}: ${n}`));
    console.log('\nFirst 5 hunts:');
    hunts.slice(0, 5).forEach(h =>
      console.log(`  [${h.rank}] ${h.name} | ${h.zone} | ${h.coords} | x${h.targets} | bill: ${h.bill_number}`)
    );
    console.log('\nRun with --import to write to the database.');
  } else {
    await importHunts(hunts);
    await pool.end();
  }
})().catch(e => { console.error(e.message); process.exit(1); });
