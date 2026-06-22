/**
 * scrape-fishing-baits.js - spot-level fishing bait catalog for AI recommendations.
 *
 * Source: ffxiv.consolegameswiki.com Dawntrail + Endwalker fishing location pages.
 * Output: backend/ai/fishingBaits.json
 *
 * Run after patches when fishing locations change:
 *   node backend/scripts/scrape-fishing-baits.js
 */
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const BASE = 'https://ffxiv.consolegameswiki.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; ffxivlog.com/1.0 bait data collector)',
  Accept: 'text/html,application/xhtml+xml',
};

const PAGES = [
  { url: '/wiki/Dawntrail_Fishing_Locations', expansion: 'Dawntrail' },
  { url: '/wiki/Endwalker_Fishing_Locations', expansion: 'Endwalker' },
];

async function get(pagePath) {
  const res = await fetch(BASE + pagePath, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${BASE + pagePath}`);
  return res.text();
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const keyFor = (zone, spot) => `${clean(zone).toLowerCase()}|${clean(spot).toLowerCase()}`;
const splitList = (raw) => clean(raw).split(',').map(clean).filter(Boolean);
const parseSpotName = (raw) => clean(raw)
  .replace(/^\[/, '')
  .replace(/\]$/, '')
  .replace(/^Fishing Log:\s*/i, '');

async function scrapePage(page) {
  console.log(`Fetching ${page.url}...`);
  const $ = cheerio.load(await get(page.url));
  const rows = [];
  let currentZone = 'Unknown';

  for (const el of $('h3, h2, table.sortable').toArray()) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'h2' || tag === 'h3') {
      const text = clean($(el).text().replace(/\[.*?\]/g, ''));
      if (tag === 'h3') currentZone = text;
      continue;
    }

    const headers = $(el).find('tr').first().find('th')
      .map((_, th) => clean($(th).text())).get();
    if (!headers.includes('Fishing Log')) continue;

    $(el).find('tr').slice(1).each((_, row) => {
      const cells = $(row).find('td').map((__, td) => clean($(td).text())).get();
      if (cells.length < 6) return;
      const [spotRaw, , , , fishRaw, baitRaw] = cells;
      const spot = parseSpotName(spotRaw);
      const baits = splitList(baitRaw);
      if (!spot || !baits.length) return;
      rows.push({
        key: keyFor(currentZone, spot),
        zone: currentZone,
        spot,
        expansion: page.expansion,
        fish: splitList(fishRaw),
        baits,
      });
    });
  }
  console.log(`  ${page.expansion}: ${rows.length} bait rows`);
  return rows;
}

async function main() {
  const rows = [];
  for (const page of PAGES) rows.push(...await scrapePage(page));
  const byKey = {};
  for (const row of rows) byKey[row.key] = row;
  const out = {
    generatedFrom: PAGES.map((p) => p.url).join(', '),
    count: Object.keys(byKey).length,
    spots: byKey,
  };
  const dest = path.join(__dirname, '..', 'ai', 'fishingBaits.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${dest} (${out.count} spots)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
