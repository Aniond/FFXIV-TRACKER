require('dotenv').config();
const pool = require('./db');
const cheerio = require('cheerio');

/**
 * seed-hunts-endwalker.js — adds the 30 Endwalker hunt marks (2 B / 2 A / 1 S
 * per zone) to the hunts table, mirroring the Dawntrail row conventions.
 *
 * Mark names are scraped live from each zone's consolegameswiki page (the
 * B/A/S Rank sections), so there's no hand-typed lore to get wrong. Rewards
 * and bill names follow the Endwalker "Guildship Hunt" structure (same Sacks
 * of Nuts economy as Dawntrail).
 *
 * Idempotent: upserts by (name) — re-running updates instead of duplicating.
 *
 * Run against prod (link the Postgres service — see migrate-overrides.js):
 *   railway run sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL NODE_ENV=production node seed-hunts-endwalker.js'
 */

const ZONES = ['Labyrinthos', 'Thavnair', 'Garlemald', 'Mare_Lamentorum', 'Elpis', 'Ultima_Thule'];
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; ffxivlog.com/1.0)' };

const RANK_META = {
  B: {
    type: 'Beginner Guildship Hunt', billNumber: 'Daily', reward: '10 Sacks of Nuts · 1,000 Gil',
    coordsNote: (z) => `Roams ${z} — no fixed spawn`,
    tips: (z) => [
      'B-rank Wanted mark on the daily Beginner Guildship Hunt bill.',
      `B-ranks wander the whole zone with no spawn timer — patrol ${z} to find it.`,
    ],
  },
  A: {
    type: 'Advanced Guildship Hunt', billNumber: 'Daily', reward: '40 Sacks of Nuts · 1,500 Gil',
    coordsNote: (z) => `Roams ${z} — set spawn points`,
    tips: () => [
      'A-rank Notorious mark on the daily Advanced Guildship Hunt bill.',
      'Respawns ~4-6 hours after a kill; use Faloop or a hunt Discord for live status.',
    ],
  },
  S: {
    type: 'Elite Guildship Hunt', billNumber: 'Weekly', reward: '100 Sacks of Nuts · 5,000 Gil',
    coordsNote: () => 'Weekly Elite mark — conditional spawn',
    tips: () => [
      'S-rank Elite mark — spawns on a long timer with a zone-specific trigger condition.',
      'Weekly Elite Guildship Hunt — coordinate via Faloop / a hunt Discord for the spawn.',
    ],
  },
};

async function scrapeZone(zoneSlug) {
  const html = await (await fetch(`https://ffxiv.consolegameswiki.com/wiki/${zoneSlug}`, { headers: UA })).text();
  const $ = cheerio.load(html);
  const out = {};
  for (const [rank, id] of [['B', 'B_Rank'], ['A', 'A_Rank'], ['S', 'S_Rank']]) {
    const h = $('#' + id).closest('h3');
    const names = [];
    let el = h.parent().next();
    while (el.length && !el.hasClass('mw-heading')) {
      el.find('a').each((i, a) => {
        const t = $(a).text().trim();
        if (t && !/^edit$/i.test(t)) names.push(t);
      });
      el = el.next();
    }
    out[rank] = [...new Set(names)];
  }
  return out;
}

async function seed() {
  const rows = [];
  for (const slug of ZONES) {
    const zone = slug.replace(/_/g, ' ');
    const ranks = await scrapeZone(slug);
    console.log(`${zone}: B[${ranks.B.join(', ')}] A[${ranks.A.join(', ')}] S[${ranks.S.join(', ')}]`);
    if (ranks.B.length !== 2 || ranks.A.length !== 2 || ranks.S.length !== 1) {
      throw new Error(`${zone}: unexpected mark counts — wiki layout changed? Aborting before touching the DB.`);
    }
    for (const [rank, names] of Object.entries(ranks)) {
      const meta = RANK_META[rank];
      for (const name of names) {
        rows.push({
          name, rank, zone, area: zone,
          type: meta.type, billNumber: meta.billNumber, reward: meta.reward,
          coords: null, coordsNote: meta.coordsNote(zone),
          targets: 1, authority: 'Guildship Hunt', tips: meta.tips(zone), status: 'todo',
        });
      }
    }
    await new Promise((r) => setTimeout(r, 400)); // be polite to the wiki
  }

  console.log(`\nUpserting ${rows.length} Endwalker marks…`);
  let inserted = 0, updated = 0;
  for (const h of rows) {
    const existing = await pool.query('SELECT id FROM hunts WHERE name = $1', [h.name]);
    if (existing.rows.length) {
      await pool.query(
        `UPDATE hunts SET rank=$2, type=$3, bill_number=$4, zone=$5, area=$6, coords=$7,
         coords_note=$8, targets=$9, reward=$10, authority=$11, tips=$12 WHERE name=$1`,
        [h.name, h.rank, h.type, h.billNumber, h.zone, h.area, h.coords, h.coordsNote, h.targets, h.reward, h.authority, h.tips]
      );
      updated++;
    } else {
      await pool.query(
        `INSERT INTO hunts (name, rank, type, bill_number, zone, area, coords, coords_note, targets, reward, authority, tips, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [h.name, h.rank, h.type, h.billNumber, h.zone, h.area, h.coords, h.coordsNote, h.targets, h.reward, h.authority, h.tips, h.status]
      );
      inserted++;
    }
  }
  const total = await pool.query('SELECT COUNT(*)::int AS n FROM hunts');
  console.log(`done: ${inserted} inserted, ${updated} updated — hunts table now ${total.rows[0].n} rows`);
  await pool.end();
}

seed().catch((err) => { console.error(err); process.exit(1); });
