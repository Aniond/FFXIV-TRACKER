/**
 * Mining node scraper — ffxiv.consolegameswiki.com
 *
 * Dry-run:   node backend/scrape-mining.js
 * Write:     node backend/scrape-mining.js --write
 *
 * Sources:
 *   Miner_Node_Locations  → Regular nodes (levels 80+)
 *   Unspoiled_Nodes       → Unspoiled + Ephemeral nodes (Miner section, DT + EW)
 */

const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const WRITE = process.argv.includes('--write');
const BASE  = 'https://ffxiv.consolegameswiki.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; ffxivlog.com/1.0; mining data collector)',
  'Accept': 'text/html,application/xhtml+xml',
};

async function get(p) {
  const res = await fetch(BASE + p, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${BASE + p}`);
  return res.text();
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

function parseCoords(raw) {
  const m = clean(raw).match(/[xX]:?\s*([\d.]+)\s*,?\s*[yY]:?\s*([\d.]+)/);
  if (m) return `X:${m[1]}, Y:${m[2]}`;
  return clean(raw).replace(/[()]/g, '').trim();
}

function splitItems(raw) {
  return clean(raw).split(',').map(s => clean(s)).filter(Boolean);
}

// Level → expansion
function expansionForLevel(lvl) {
  if (lvl >= 90) return 'Dawntrail';
  if (lvl >= 80) return 'Endwalker';
  return null; // skip older content
}

// Known Dawntrail zones (for regular node page where we match by zone name)
const DT_ZONES = new Set([
  'Tuliyollal', 'Urqopacha', "Kozama'uka", "Yak T'el",
  'Shaaloani', 'Heritage Found', 'Living Memory', 'Solution Nine',
]);
const EW_ZONES = new Set([
  'Old Sharlayan', 'Labyrinthos', 'Thavnair', 'Radz-at-Han',
  'Garlemald', 'Mare Lamentorum', 'Ultima Thule', 'Elysion', 'Elpis',
]);

function expansionForZone(zone) {
  if (DT_ZONES.has(zone)) return 'Dawntrail';
  if (EW_ZONES.has(zone)) return 'Endwalker';
  return null;
}

// Parse "12:00 AM/PM" → ET hour pair [amH, pmH], window open/close
// Unspoiled nodes open for 4 ET hours (confirmed FFXIV mechanic)
const WINDOW_DUR = 4; // ET hours
function parseTime(raw) {
  const m = clean(raw).match(/(\d+):(\d+)\s*(AM|PM)?\/?(PM)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  const isAmPm = raw.toLowerCase().includes('am/pm') || raw.toLowerCase().includes('pm');
  // AM/PM in this context means the node spawns twice: once at that ET hour, once 12h later
  const openH = h === 12 ? 0 : h; // "12:00 AM" = ET 0:00
  return {
    label: `ET ${openH}:00 / ${openH + 12}:00`,
    window: { open: [openH, mins], close: [(openH + WINDOW_DUR) % 24, mins] },
  }
}

// ── Regular nodes from Miner_Node_Locations ────────────────────────────────
async function scrapeRegular() {
  console.error('Fetching /wiki/Miner_Node_Locations …');
  const html = await get('/wiki/Miner_Node_Locations');
  const $ = cheerio.load(html);

  const nodes = [];
  const seen = new Set();

  $('table.sortable').each((_, table) => {
    const headers = $(table).find('tr').first().find('th')
      .map((_, th) => clean($(th).text())).get();
    if (!headers.includes('Level') || !headers.includes('Zone') || !headers.includes('Items')) return;

    // Col indices: Level=0, Type=1, Zone=2, Coordinate=3, Items=4
    $(table).find('tr').slice(1).each((_, row) => {
      const cells = $(row).find('td').map((_, td) => clean($(td).text())).get();
      if (cells.length < 5) return;
      const [levelRaw, typeRaw, zoneRaw, coordRaw, itemsRaw] = cells;

      const level = parseInt(levelRaw, 10);
      if (isNaN(level) || level < 80) return; // EW+ only

      const zone = clean(zoneRaw);
      // Only include known DT/EW zones — level alone can't distinguish (e.g. ShB is also 80)
      const expansion = expansionForZone(zone);
      if (!expansion) return;

      const nodeType = typeRaw.includes('Rocky') ? 'Rocky Outcrop' : 'Mineral Deposit';
      const coords = parseCoords(coordRaw);
      const items = splitItems(itemsRaw)
        .filter(name => !name.includes('Quest)') && !name.includes('Quest Item')) // strip gather-quest filler
        .map(name => ({
          name, tag: 'common',
          icon: /shard|crystal|cluster|gem|quartz|amber|obsidian|alumen|salt/i.test(name) ? 'gem' : 'ore',
        }));
      if (!items.length) return;

      // Deduplicate by zone + type + first item name
      const key = slugify(`${zone}-${nodeType}-${items[0]?.name || ''}`);
      if (seen.has(key)) return;
      seen.add(key);

      const name = `${zone} ${nodeType}`;
      nodes.push({
        id: slugify(`reg-${zone}-${nodeType}-${level}`),
        name,
        zone,
        expansion,
        type: 'Regular',
        coords,
        level: String(level),
        time: 'Any',
        window: null,
        items,
      });
    });
  });

  return nodes;
}

// ── Unspoiled / Ephemeral nodes from Unspoiled_Nodes ──────────────────────
async function scrapeUnspoiled() {
  console.error('Fetching /wiki/Unspoiled_Nodes …');
  const html = await get('/wiki/Unspoiled_Nodes');
  const $ = cheerio.load(html);

  const nodes = [];
  const seen = new Set();
  let inMiner = false;
  let currentExp = null;

  const elements = $('h2, h3, table.sortable').toArray();

  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'h2') {
      const text = clean($(el).text().replace(/\[.*?\]/g, ''));
      inMiner = text === 'Miner';
      currentExp = null;
      continue;
    }
    if (tag === 'h3') {
      const text = clean($(el).text().replace(/\[.*?\]/g, ''));
      currentExp = (text === 'Dawntrail' || text === 'Endwalker') ? text : null;
      continue;
    }
    if (!inMiner || !currentExp) continue;

    // table.sortable under Miner → Dawntrail / Endwalker
    const headers = $(el).find('tr').first().find('th')
      .map((_, th) => clean($(th).text())).get();
    if (!headers.includes('Time') || !headers.includes('Item')) continue;

    // Cols: Time=0, Item=1, Slot#=2, Location=3, Coordinate=4, Level=5, Star=6, Additional=7
    $(el).find('tr').slice(1).each((_, row) => {
      const cells = $(row).find('td').map((_, td) => clean($(td).text())).get();
      if (cells.length < 6) return;
      const [timeRaw, itemRaw, , locationRaw, coordRaw, levelRaw, starRaw] = cells;

      const itemName = clean(itemRaw).replace(/\s+$/, '');
      if (!itemName) return;

      const zone = clean(locationRaw);
      const level = parseInt(levelRaw, 10);
      const coords = parseCoords(coordRaw);
      const stars = (starRaw || '').trim().length;
      const timeInfo = parseTime(timeRaw);

      // Determine node type — items with "Aetherial" in name → Ephemeral, else Unspoiled
      const isEphemeral = itemName.toLowerCase().includes('aetherial') ||
                          itemName.toLowerCase().includes('aether');
      const nodeType = isEphemeral ? 'Ephemeral' : 'Unspoiled';

      const tag = itemName.toLowerCase().startsWith('rarefied') ? 'collectable' : 'aetherial';
      const icon = itemName.toLowerCase().includes('ore') || itemName.toLowerCase().includes('rock') ||
                   itemName.toLowerCase().includes('sand') || itemName.toLowerCase().includes('alumen') ||
                   itemName.toLowerCase().includes('soot') ? 'ore' : 'gem';

      const id = slugify(`${nodeType}-${zone}-${itemName}`);
      if (seen.has(id)) return;
      seen.add(id);

      const levelStr = stars > 0 ? `${level}${'★'.repeat(Math.min(stars, 2))}` : String(level);

      nodes.push({
        id,
        name: `${zone} ${nodeType} Node`,
        zone,
        expansion: currentExp,
        type: nodeType,
        coords,
        level: levelStr,
        time: timeInfo ? timeInfo.label : timeRaw,
        window: timeInfo ? timeInfo.window : null,
        items: [{ name: itemName, tag, icon }],
      });
    });
  }

  return nodes;
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderJS(nodes) {
  const lines = nodes.map(n => {
    const esc = s => s.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const itemStr = n.items.map(it =>
      `      { name: '${esc(it.name)}', tag: '${it.tag}', icon: '${it.icon}' }`
    ).join(',\n');
    const win = n.window
      ? `{ open: [${n.window.open}], close: [${n.window.close}] }`
      : 'null';
    return `  { id: '${esc(n.id)}', name: '${esc(n.name)}', zone: '${esc(n.zone)}', expansion: '${n.expansion}',
    type: '${n.type}', coords: '${esc(n.coords)}', level: '${esc(n.level)}', time: '${esc(n.time)}', window: ${win},
    items: [
${itemStr},
    ] }`;
  });

  return `/* ============================================================
   miningData.js — mining node catalog (auto-generated).
   Sources: consolegameswiki.com Miner_Node_Locations + Unspoiled_Nodes
   Weather defaults to null; enrich timed entries as needed.
   ============================================================ */

export const NODE_TYPES = {
  Regular:   { gem: 'var(--topaz)',    word: 'Regular' },
  Unspoiled: { gem: 'var(--sapphire)', word: 'Unspoiled' },
  Ephemeral: { gem: 'var(--amethyst)', word: 'Ephemeral' },
  Legendary: { gem: 'var(--diamond)',  word: 'Legendary' },
}
export const TYPE_ORDER = ['All', 'Regular', 'Unspoiled', 'Ephemeral', 'Legendary']

export const ITEM_TAG = { common: 'Common', collectable: 'Collectable', aetherial: 'Aetherial', legendary: 'Legendary' }
export const ITEM_COLOR = { common: 'var(--topaz)', collectable: 'var(--sapphire)', aetherial: 'var(--amethyst)', legendary: 'var(--diamond)' }

export const MINING_NODES = [
${lines.join(',\n')}
];
`;
}

(async () => {
  const regular   = await scrapeRegular();
  console.error(`  Regular: ${regular.length} nodes`);
  await sleep(1200);
  const unspoiled = await scrapeUnspoiled();
  console.error(`  Unspoiled/Ephemeral: ${unspoiled.length} nodes`);

  // Sort: Dawntrail first, then by type priority
  const TYPE_PRI = { Regular: 0, Unspoiled: 1, Ephemeral: 2, Legendary: 3 };
  const EXP_PRI  = { Dawntrail: 0, Endwalker: 1 };
  const all = [...regular, ...unspoiled].sort((a, b) =>
    (EXP_PRI[a.expansion] - EXP_PRI[b.expansion]) ||
    (TYPE_PRI[a.type] - TYPE_PRI[b.type])
  );

  console.error(`\nTotal: ${all.length} nodes`);
  const js = renderJS(all);

  if (WRITE) {
    const out = path.join(__dirname, '../src/miningData.js');
    fs.writeFileSync(out, js, 'utf8');
    console.error(`Written to ${out}`);
  } else {
    process.stdout.write(js);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
