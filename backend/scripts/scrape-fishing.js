/**
 * Fishing spot scraper — ffxiv.consolegameswiki.com
 *
 * Dry-run (prints JS to stdout):
 *   node backend/scripts/scrape-fishing.js
 *
 * Write fishingData.js directly:
 *   node backend/scripts/scrape-fishing.js --write
 */

const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const WRITE = process.argv.includes('--write');
const BASE = 'https://ffxiv.consolegameswiki.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; ffxivlog.com/1.0; fishing data collector)',
  'Accept': 'text/html,application/xhtml+xml',
};

const PAGES = [
  { url: '/wiki/Dawntrail_Fishing_Locations', expansion: 'Dawntrail' },
  { url: '/wiki/Endwalker_Fishing_Locations', expansion: 'Endwalker' },
];

async function get(path) {
  const res = await fetch(BASE + path, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${BASE + path}`);
  return res.text();
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

function slugify(name, zone) {
  return (zone.slice(0, 4) + '-' + name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function parseCoords(raw) {
  // "Tuliyollal (X:9, Y:10.5)" → "X:9, Y:10.5"
  const m = raw.match(/\(([^)]+)\)/);
  return m ? clean(m[1]) : clean(raw);
}

function parseSpotName(raw) {
  // "Fishing Log: Downripple" or "[Fishing Log: Scholar's Harbor]"
  return clean(raw)
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/^Fishing Log:\s*/i, '');
}

function splitList(raw) {
  return raw.split(',').map(clean).filter(Boolean);
}

// Bait → color mapping for known baits
const BAIT_COLORS = {
  'Versatile Lure':         '#74e3dc',
  'Popper Lure':            '#e87c4e',
  'Metal Spinner':          '#8fb6d6',
  'Glowworm':               '#d6a94e',
  'Rat Tail':               '#c98ee0',
  'Plump Worm':             '#6fae8f',
  'Butterworm':             '#6fae8f',
  'Sand Leech':             '#d6a94e',
  'Honeybee':               '#e8c84e',
  'Mayfly':                 '#74e3dc',
  'Leech':                  '#b07060',
  'Crimson Lugworm':        '#d65858',
  'Ghost Nipper':           '#8fb6d6',
  'Shucked Clam':           '#c4b8a0',
  'Mackerel Strip':         '#7bbfb8',
  'Shrimp Ball':            '#e8b090',
  'Gold Salmon Roe':        '#e8c84e',
  'Red Maggots':            '#d65858',
  'Stonefly Nymph':         '#8fb6d6',
  'Golden Stonefly Nymph':  '#e8c84e',
  'Goby Ball':              '#c4b8a0',
  'Midge Basket':           '#8fae8f',
  'Lugworm':                '#c47860',
  'Krill':                  '#8fb6d6',
  'Pill Bug':               '#a0906c',
  'Spoon Worm':             '#c47860',
  'Caddisfly Larva':        '#8fae8f',
  'Bloodworm':              '#d65858',
  'Raisins':                '#c98ee0',
  'Salmon Roe':             '#e8a060',
  'Yumizuno':               '#74e3dc',
  'Sinking Minnow':         '#5ea8e0',
  'Floating Minnow':        '#74e3dc',
  'Heavy Steel Jig':        '#8090a0',
  'Topwater Frog':          '#6fae8f',
  'Mythril Spoon Lure':     '#8fb6d6',
  'Halcyon Rod':            '#e8c84e',
  'Stem Borer':             '#c4b8a0',
};

function baitColor(name) {
  // Exact match first, then prefix/substring match
  if (BAIT_COLORS[name]) return BAIT_COLORS[name];
  for (const [k, v] of Object.entries(BAIT_COLORS)) {
    if (name.includes(k) || k.includes(name)) return v;
  }
  return '#74e3dc'; // default teal
}

// Fish that are known big/legendary based on wiki naming conventions
const LEGENDARY_KEYWORDS = [
  'legendary', 'aetheric', 'barreleye', 'crimson', "emperor's", 'endoceras',
  'lancetfish', 'navigator', 'thousand', 'comet', 'cloud', 'iceberg',
  'star', 'celestial', 'ancient', 'primal', 'eikon', 'gigant',
];
const RARE_KEYWORDS = [
  'king', 'queen', 'golden', 'giant', 'great', 'elder', 'massive',
  'greatsword', 'aetherolectric', 'purse of riches', "cabinkeep",
  'ghost', 'permit', 'reasonscale', 'goldfin', 'floating fife',
  'stardust', 'academician', 'swordspine', 'sunfish', 'raincaller',
  'gleamgill', 'prairie pike', 'goldsand', 'reflection', 'vyakarana',
  'magmamaw', 'future self', 'ice faerie',
];

function guessRarity(fishName) {
  const low = fishName.toLowerCase();
  if (LEGENDARY_KEYWORDS.some(k => low.includes(k))) return 'legendary';
  if (RARE_KEYWORDS.some(k => low.includes(k))) return 'rare';
  return 'common';
}

async function scrapePage(pageUrl, expansion) {
  console.error(`Fetching ${pageUrl} …`);
  const html = await get(pageUrl);
  const $ = cheerio.load(html);

  const spots = [];
  const seen = new Set();
  let currentZone = 'Unknown';

  // Walk all h3 and fishing tables in DOM order
  const elements = $('h3, h2, table.sortable').toArray();

  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'h2' || tag === 'h3') {
      const text = clean($(el).text().replace(/\[.*?\]/g, ''));
      // h2 = region, h3 = zone — use h3 as the zone name
      if (tag === 'h3') currentZone = text;
      continue;
    }

    // table.wikitable
    const headers = $(el).find('tr').first().find('th')
      .map((_, th) => clean($(th).text())).get();

    if (!headers.includes('Fishing Log')) continue;

    $(el).find('tr').slice(1).each((_, row) => {
      const cells = $(row).find('td').map((_, td) => clean($(td).text())).get();
      if (cells.length < 6) return;
      // Columns: [0]=Fishing Log name, [1]=Level, [2]=Type, [3]=Coordinates, [4]=Fish, [5]=Bait
      const [logRaw, , , coordsRaw, fishRaw, baitRaw] = cells;

      const name = parseSpotName(logRaw);
      if (!name) return;

      const id = slugify(name, currentZone);
      if (seen.has(id)) return;
      seen.add(id);

      const coords = parseCoords(coordsRaw);
      const fishNames = splitList(fishRaw);
      const baitNames = splitList(baitRaw);

      const fish = fishNames.map(f => ({
        name: f,
        rarity: guessRarity(f),
        note: '',
      }));

      const baits = baitNames.slice(0, 4).map(b => [b, baitColor(b)]);

      spots.push({
        id,
        name,
        zone: currentZone,
        expansion,
        coords,
        weather: null,
        time: 'Any',
        baits,
        fish,
      });
    });
  }

  return spots;
}

function renderJS(spots) {
  const lines = spots.map(s => {
    const baitStr = s.baits.map(([n, c]) => `['${n.replace(/'/g, "\\'")}', '${c}']`).join(', ');
    const fishStr = s.fish.map(f => {
      const note = f.note ? `'${f.note.replace(/'/g, "\\'")}'` : "''";
      const timed = f.timed ? ', timed: true' : '';
      return `      { name: '${f.name.replace(/'/g, "\\'")}', rarity: '${f.rarity}', note: ${note}${timed} }`;
    }).join(',\n');
    return `  {
    id: '${s.id}', name: '${s.name.replace(/'/g, "\\'")}', zone: '${s.zone.replace(/'/g, "\\'")}', expansion: '${s.expansion}',
    coords: '${s.coords}', weather: null, time: '${s.time}',
    baits: [${baitStr}],
    fish: [
${fishStr},
    ],
  }`;
  });

  return `/* ============================================================
   fishingData.js — fishing spot catalog (auto-generated).
   Sources: ffxiv.consolegameswiki.com Dawntrail + Endwalker
            fishing location pages.
   Weather, time windows, and timed flags are defaults — enrich
   individual entries as needed.
   ============================================================ */

export const FISHING_SPOTS = [
${lines.join(',\n')}
];

export const EXPANSIONS = [
  { key: 'All', dot: 'var(--teal)' },
  { key: 'Dawntrail', dot: '#c98ee0' },
  { key: 'Endwalker', dot: '#5ea8e0' },
];
`;
}

(async () => {
  const allSpots = [];
  for (const { url, expansion } of PAGES) {
    const spots = await scrapePage(url, expansion);
    console.error(`  ${expansion}: ${spots.length} spots`);
    allSpots.push(...spots);
    await sleep(1200);
  }

  console.error(`\nTotal: ${allSpots.length} spots`);
  const js = renderJS(allSpots);

  if (WRITE) {
    const out = path.join(__dirname, '../src/fishingData.js');
    fs.writeFileSync(out, js, 'utf8');
    console.error(`Written to ${out}`);
  } else {
    console.log(js);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
