/**
 * build-data.js — generates miningData.js and fishingData.js from XIVAPI.
 *
 * Run once after each FFXIV patch, commit the output files.
 * No wiki dependency. Source: xivapi.com (game data files).
 *
 * Dry-run:  node backend/scripts/build-data.js
 * Write:    node backend/scripts/build-data.js --write
 *
 * Expected runtime: ~3-5 minutes (rate-limited API calls)
 */

const fs   = require('fs');
const path = require('path');

const WRITE      = process.argv.includes('--write');
const BASE       = 'https://xivapi.com';
const RATE_MS    = 350; // ms between requests — be polite
const PAGE_LIMIT = 500; // max per page

// ── Expansions ──────────────────────────────────────────────────────────────
const DT_ZONES = new Set([
  'Tuliyollal', 'Urqopacha', "Kozama'uka", "Yak T'el",
  'Shaaloani', 'Heritage Found', 'Living Memory', 'Solution Nine',
]);
const EW_ZONES = new Set([
  'Old Sharlayan', 'Labyrinthos', 'Thavnair', 'Radz-at-Han',
  'Garlemald', 'Mare Lamentorum', 'Ultima Thule', 'Elysion', 'Elpis',
]);
function expansionForZone(z) {
  if (DT_ZONES.has(z)) return 'Dawntrail';
  if (EW_ZONES.has(z)) return 'Endwalker';
  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function get(endpoint) {
  const res = await fetch(BASE + endpoint, { headers: { 'User-Agent': 'ffxivlog.com/1.0 build-data' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${BASE + endpoint}`);
  return res.json();
}

// Map coordinate formulas (verified against wiki):
// FishingSpot/GatheringPoint.X uses unsigned 0-2048 map coords
function mapCoord(raw, sizeFactor) {
  if (raw == null || sizeFactor == null || sizeFactor === 0) return null;
  return Math.round((1 + 40 * raw * (100 / sizeFactor) / 2048) * 10) / 10;
}
// ExportedGatheringPoint.X/Y uses signed 3D world coords
function worldCoord(worldRaw, sizeFactor, offset = 0) {
  if (worldRaw == null || sizeFactor == null || sizeFactor === 0) return null;
  const scale = sizeFactor / 100.0;
  return Math.round((1 + 40 * (parseFloat(worldRaw) / scale + offset + 1024) / 2048) * 10) / 10;
}
function fmtCoords(x, y) {
  const xv = x != null ? `X:${x}` : null;
  const yv = y != null ? `Y:${y}` : null;
  return [xv, yv].filter(Boolean).join(', ');
}

// Ephemeral start/end times are encoded as ET HHMM (e.g. 2000 = 20:00), NOT
// minutes-of-day — decoding as minutes produced impossible windows like 33:20.
// → [h, m]; 65535 = not applicable
function etTimeToHm(v) {
  if (v == null || v >= 65000) return null;
  return [Math.floor(v / 100), v % 100];
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

// Paginate a list endpoint; yields each result row
async function* paginate(endpoint, extraCols) {
  let page = 1;
  let total = Infinity;
  let seen = 0;
  while (seen < total) {
    const url = `${endpoint}&limit=${PAGE_LIMIT}&page=${page}&columns=${extraCols}`;
    const data = await get(url);
    total = data.Pagination.ResultsTotal;
    for (const row of data.Results) yield row;
    seen += data.Results.length;
    process.stderr.write(`  page ${page}/${data.Pagination.PageTotal} (${seen}/${total})\r`);
    page++;
    if (data.Pagination.PageNext) await sleep(RATE_MS);
    else break;
  }
  process.stderr.write('\n');
}

// ── Mining ───────────────────────────────────────────────────────────────────
// GatheringType IDs: 0=Mining, 1=Quarrying, 2=Logging, 3=Harvesting
const MINER_TYPE_IDS = new Set([0, 1]);
const ITEM_SLOTS = ['Item0','Item1','Item2','Item3','Item4','Item5','Item6','Item7'];

async function buildMining() {
  console.error('\n── Mining ──────────────────────────────────────────');

  // Pass 1: identify DT/EW Miner gathering point IDs
  console.error('Pass 1: identifying DT/EW mining point IDs…');
  const miningIds = [];
  for await (const row of paginate(
    '/GatheringPoint?',
    'ID,GatheringPointBase.GatheringLevel,GatheringPointBase.GatheringType.ID,TerritoryType.PlaceName.Name'
  )) {
    const lvl  = row.GatheringPointBase?.GatheringLevel;
    const tid  = row.GatheringPointBase?.GatheringType?.ID;
    const zone = row.TerritoryType?.PlaceName?.Name;
    if (lvl == null || lvl < 80) continue;
    if (!MINER_TYPE_IDS.has(tid)) continue;
    if (!expansionForZone(zone)) continue;
    miningIds.push(row.ID);
  }
  console.error(`  Found ${miningIds.length} DT/EW mining points`);

  // Pass 2: fetch each individually for full coords + items + transient
  console.error('Pass 2: fetching individual mining points…');
  const nodes = [];
  const seen  = new Set();
  const ITEM_COLS = ITEM_SLOTS.map(s => `GatheringPointBase.${s}.Item.Name`).join(',');
  const cols = [
    'GatheringPointBase.GatheringLevel',
    'GatheringPointBase.GatheringType.Name',
    ITEM_COLS,
    'GatheringPointTransient.EphemeralStartTime',
    'GatheringPointTransient.EphemeralEndTime',
    'GatheringPointTransient.GatheringRarePopTimeTableTargetID',
    'TerritoryType.PlaceName.Name',
    'TerritoryType.Map.SizeFactor',
    'TerritoryType.Map.OffsetX',
    'TerritoryType.Map.OffsetY',
    'ExportedGatheringPoint.X',
    'ExportedGatheringPoint.Y',
  ].join(',');

  for (let i = 0; i < miningIds.length; i++) {
    const id  = miningIds[i];
    const row = await get(`/GatheringPoint/${id}?columns=${cols}`);
    await sleep(RATE_MS);
    process.stderr.write(`  ${i+1}/${miningIds.length} id:${id}\r`);

    const zone = row.TerritoryType?.PlaceName?.Name;
    const sf   = row.TerritoryType?.Map?.SizeFactor;
    const offX = row.TerritoryType?.Map?.OffsetX || 0;
    const offY = row.TerritoryType?.Map?.OffsetY || 0;
    const expansion = expansionForZone(zone);
    if (!expansion) continue;

    const level = row.GatheringPointBase?.GatheringLevel;
    const typeName = row.GatheringPointBase?.GatheringType?.Name || 'Mining';

    // Collect items — strip quest/event filler that has no in-game yield value
    const items = ITEM_SLOTS.map(s => row.GatheringPointBase?.[s]?.Item?.Name)
      .filter(Boolean)
      .filter(n => !/\(Level \d+ Gathering Quest\)|Quest Item|Package Materials|Ring Material$/i.test(n))
      .map(name => ({
        name: name.trim(),
        tag: name.toLowerCase().startsWith('rarefied') ? 'collectable' :
             /aetherial|crystal|shard|cluster/i.test(name) ? 'aetherial' : 'common',
        icon: /ore|salt|alumen|soot|coal|bauxite|stone|rock|sand|soil|ash|flint/i.test(name) ? 'ore' : 'gem',
      }));
    if (!items.length) continue;

    // Spawn window
    const ephStart = row.GatheringPointTransient?.EphemeralStartTime;
    const ephEnd   = row.GatheringPointTransient?.EphemeralEndTime;
    const rareId   = row.GatheringPointTransient?.GatheringRarePopTimeTableTargetID;
    const openHm   = etTimeToHm(ephStart);
    const closeHm  = etTimeToHm(ephEnd);

    let nodeType = 'Regular';
    let window   = null;
    let timeLabel = 'Any';

    if (openHm && closeHm) {
      // Ephemeral node
      nodeType  = 'Ephemeral';
      window    = { open: openHm, close: closeHm };
      timeLabel = `ET ${openHm[0]}:00–${closeHm[0]}:00`;
    } else if (rareId > 0) {
      // Unspoiled node — need to fetch GatheringRarePopTimeTable for the window
      // Common pattern: rare pop tables use fixed 4-ET-hour windows every 8 ET hours
      // We'll mark as Unspoiled with null window for now; enrich separately if needed
      nodeType  = 'Unspoiled';
      timeLabel = 'See Unspoiled Nodes list';
    }

    // Coords — GatheringPoint uses 3D world coords in ExportedGatheringPoint
    const ex = row.ExportedGatheringPoint;
    const x = worldCoord(ex?.X, sf, offX);
    const y = worldCoord(ex?.Y, sf, offY);
    const coords = fmtCoords(x, y);

    // Node name: "<Zone> <Type>" — deduplicate by zone+type+first item
    const dedupeKey = slugify(`${zone}-${typeName}-${items[0].name}`);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const levelStr = level ? `${level}${rareId > 0 ? '★' : ''}` : '?';
    nodes.push({
      id:         slugify(`${typeName}-${zone}-${items[0].name}`),
      name:       zone,
      gatherType: typeName,  // 'Mining' | 'Quarrying'
      zone,
      expansion,
      type:       nodeType,
      coords,
      level:     levelStr,
      time:      timeLabel,
      window,
      items,
    });
  }
  process.stderr.write('\n');
  return nodes;
}

// ── Fishing ──────────────────────────────────────────────────────────────────
const FISH_SLOTS = ['Item0','Item1','Item2','Item3','Item4','Item5','Item6','Item7','Item8','Item9'];

// Fish rarity heuristics (same as before)
const LEGENDARY_KEYWORDS = ['legendary','comet','star','celestial','ancient','primal','aetheric','lancetfish','barrelfish'];
const RARE_KEYWORDS = ['king','queen','golden','giant','great','elder','swordspine','greatsword','stardust',
  'reasonscale','goldfin','cabinkeep','ghostfish','raincaller','gleamgill','purse of riches','floating fife',
  'vyakarana','magmamaw','future self','ice faerie','alpamayo'];
function guessRarity(name) {
  const l = name.toLowerCase();
  if (LEGENDARY_KEYWORDS.some(k => l.includes(k))) return 'legendary';
  if (RARE_KEYWORDS.some(k => l.includes(k))) return 'rare';
  return 'common';
}

async function buildFishing() {
  console.error('\n── Fishing ─────────────────────────────────────────');

  // Pass 1: identify DT/EW fishing spot IDs
  console.error('Pass 1: identifying DT/EW fishing spot IDs…');
  const fishIds = [];
  for await (const row of paginate(
    '/FishingSpot?',
    'ID,GatheringLevel,TerritoryType.PlaceName.Name,PlaceName.Name'
  )) {
    const lvl  = row.GatheringLevel;
    const zone = row.TerritoryType?.PlaceName?.Name || row.PlaceName?.Name;
    if (lvl == null || lvl < 80) continue;
    if (!expansionForZone(zone)) continue;
    fishIds.push(row.ID);
  }
  console.error(`  Found ${fishIds.length} DT/EW fishing spots`);

  // Pass 2: fetch each individually
  console.error('Pass 2: fetching individual fishing spots…');
  const spots  = [];
  const ITEM_COLS = FISH_SLOTS.map(s => `${s}.Name`).join(',');
  const cols = [
    'GatheringLevel',
    'PlaceName.Name',
    'TerritoryType.PlaceName.Name',
    'TerritoryType.Map.SizeFactor',
    'X','Y',
    ITEM_COLS,
  ].join(',');

  for (let i = 0; i < fishIds.length; i++) {
    const id  = fishIds[i];
    const row = await get(`/FishingSpot/${id}?columns=${cols}`);
    await sleep(RATE_MS);
    process.stderr.write(`  ${i+1}/${fishIds.length} id:${id}\r`);

    const zone = row.TerritoryType?.PlaceName?.Name;
    const expansion = expansionForZone(zone);
    if (!expansion) continue;

    const sf = row.TerritoryType?.Map?.SizeFactor;
    const x  = mapCoord(row.X, sf);
    const y  = mapCoord(row.Y, sf); // Y is null in XIVAPI — only X is available for fishing spots

    const subZone    = row.PlaceName?.Name || zone;
    const fish = FISH_SLOTS.map(s => row[s]?.Name).filter(Boolean).map(name => ({
      name: name.trim(),
      rarity: guessRarity(name),
      note: '',
    }));
    if (!fish.length) continue;

    spots.push({
      id:        slugify(`${id}-${subZone}`),
      name:      subZone,
      zone,
      expansion,
      coords:    fmtCoords(x, y),
      weather:   null,
      time:      'Any',
      baits:     [['Versatile Lure', '#74e3dc']], // default; enrich per-spot if needed
      fish,
    });
  }
  process.stderr.write('\n');
  return spots;
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderMiningJS(nodes) {
  const esc = s => (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const lines = nodes.map(n => {
    const items = n.items.map(it =>
      `      { name: '${esc(it.name)}', tag: '${it.tag}', icon: '${it.icon}' }`
    ).join(',\n');
    const win = n.window
      ? `{ open: [${n.window.open}], close: [${n.window.close}] }`
      : 'null';
    return `  { id: '${esc(n.id)}', name: '${esc(n.name)}', gatherType: '${esc(n.gatherType||'')}', zone: '${esc(n.zone)}', expansion: '${n.expansion}',
    type: '${n.type}', coords: '${esc(n.coords)}', level: '${esc(n.level)}', time: '${esc(n.time)}', window: ${win},
    items: [\n${items},\n    ] }`;
  });
  return `/* Auto-generated by build-data.js — source: xivapi.com */

export const NODE_TYPES = {
  Regular:   { gem: 'var(--topaz)',    word: 'Regular' },
  Unspoiled: { gem: 'var(--sapphire)', word: 'Unspoiled' },
  Ephemeral: { gem: 'var(--amethyst)', word: 'Ephemeral' },
  Legendary: { gem: 'var(--diamond)',  word: 'Legendary' },
}
export const TYPE_ORDER = ['All', 'Regular', 'Unspoiled', 'Ephemeral', 'Legendary']
export const ITEM_TAG   = { common: 'Common', collectable: 'Collectable', aetherial: 'Aetherial', legendary: 'Legendary' }
export const ITEM_COLOR = { common: 'var(--topaz)', collectable: 'var(--sapphire)', aetherial: 'var(--amethyst)', legendary: 'var(--diamond)' }

export const MINING_NODES = [
${lines.join(',\n')}
];
`;
}

function renderFishingJS(spots) {
  const esc = s => (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const lines = spots.map(s => {
    const fish  = s.fish.map(f =>
      `      { name: '${esc(f.name)}', rarity: '${f.rarity}', note: '${esc(f.note)}' }`
    ).join(',\n');
    const baits = s.baits.map(([n,c]) => `['${esc(n)}', '${c}']`).join(', ');
    return `  {
    id: '${esc(s.id)}', name: '${esc(s.name)}', zone: '${esc(s.zone)}', expansion: '${s.expansion}',
    coords: '${esc(s.coords)}', weather: null, time: '${s.time}',
    baits: [${baits}],
    fish: [\n${fish},\n    ],
  }`;
  });
  return `/* Auto-generated by build-data.js — source: xivapi.com */

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

// ── Entry ─────────────────────────────────────────────────────────────────────
(async () => {
  console.error('build-data.js — XIVAPI → miningData.js + fishingData.js');
  console.error(`Mode: ${WRITE ? 'WRITE' : 'DRY RUN (add --write to save)'}\n`);

  const [miningNodes, fishingSpots] = await Promise.all([
    buildMining().catch(e => { console.error('Mining failed:', e.message); return []; }),
    // Run fishing sequentially after mining to avoid hammering the API
    Promise.resolve([]),
  ]);

  // Run fishing after mining to avoid concurrent rate-limit issues
  const fishingSpotsFinal = await buildFishing().catch(e => {
    console.error('Fishing failed:', e.message); return [];
  });

  console.error(`\n── Summary ─────────────────────────────────────────`);
  console.error(`Mining nodes : ${miningNodes.length}`);
  console.error(`Fishing spots: ${fishingSpotsFinal.length}`);

  const miningJS  = renderMiningJS(miningNodes);
  const fishingJS = renderFishingJS(fishingSpotsFinal);

  if (WRITE) {
    const srcDir = path.join(__dirname, '../src');
    fs.writeFileSync(path.join(srcDir, 'miningData.js'),  miningJS,  'utf8');
    fs.writeFileSync(path.join(srcDir, 'fishingData.js'), fishingJS, 'utf8');
    console.error(`Written: src/miningData.js, src/fishingData.js`);
  } else {
    console.error('\n── miningData.js preview (first 40 lines) ─────────');
    console.error(miningJS.split('\n').slice(0, 40).join('\n'));
    console.error('\n── fishingData.js preview (first 20 lines) ────────');
    console.error(fishingJS.split('\n').slice(0, 20).join('\n'));
  }
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
