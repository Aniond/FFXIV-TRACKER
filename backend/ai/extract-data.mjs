/**
 * extract-data.mjs — snapshot the frontend gathering data into the backend.
 *
 * Fishing / mining / botany data live as static ESM modules in the frontend
 * (../../src/*.js). The Railway backend deploy does not reliably include the
 * frontend src/, and the backend is CommonJS, so we snapshot those modules into
 * a single committed JSON file that the AI search endpoint loads at startup.
 *
 * Re-run this whenever the scrapers (scrape-fishing.js / scrape-mining.js /
 * build-data.js) regenerate the frontend data:
 *
 *   node backend/ai/extract-data.mjs
 *
 * Output: backend/ai/gameData.json  (compacted — UI-only fields like colors and
 * icons are dropped to keep the Claude prompt lean).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', '..', 'src');
const mod = (f) => pathToFileURL(join(SRC, f)).href; // Windows-safe ESM import

const { FISHING_SPOTS } = await import(mod('fishingData.js'));
const { MINING_NODES } = await import(mod('miningData.js'));
const { BOTANY_NODES } = await import(mod('botanyData.js'));

const fishing = FISHING_SPOTS.map((s) => ({
  name: s.name,
  zone: s.zone,
  expansion: s.expansion,
  coords: s.coords,
  weather: s.weather || 'Any',
  time: s.time || 'Any',
  baits: (s.baits || []).map((b) => (Array.isArray(b) ? b[0] : b)),
  fish: (s.fish || []).map((f) => (f.rarity && f.rarity !== 'common' ? `${f.name} (${f.rarity})` : f.name)),
}));

const gatherer = (nodes) =>
  nodes.map((n) => ({
    zone: n.zone,
    gatherType: n.gatherType,
    expansion: n.expansion,
    type: n.type,
    coords: n.coords,
    level: n.level,
    time: n.time || 'Any',
    window: n.window || null,
    items: (n.items || []).map((i) => (i.tag && i.tag !== 'common' ? `${i.name} (${i.tag})` : i.name)),
  }));

const out = {
  generatedFrom: 'src/fishingData.js, src/miningData.js, src/botanyData.js',
  counts: { fishing: fishing.length, mining: MINING_NODES.length, botany: BOTANY_NODES.length },
  fishing,
  mining: gatherer(MINING_NODES),
  botany: gatherer(BOTANY_NODES),
};

const dest = join(__dirname, 'gameData.json');
writeFileSync(dest, JSON.stringify(out), 'utf8');
console.log(`Wrote ${dest}`);
console.log(`  fishing: ${out.counts.fishing} spots`);
console.log(`  mining:  ${out.counts.mining} nodes`);
console.log(`  botany:  ${out.counts.botany} nodes`);
