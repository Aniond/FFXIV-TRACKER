/**
 * check-crosslinks.mjs — verifies every gathering-sourced recipe ingredient
 * resolves on a gathering page (?highlight= matches a node/spot/item name).
 *
 * Run from the repo root:  node backend/scripts/check-crosslinks.mjs
 * Prefers backend/gtmp/prod-recipes.json (a fresh prod dump; see
 * build-crosslink-nodes.js header) and falls back to the committed
 * backend/cooking-recipes.json seed (same ingredient shape) so it can run in
 * CI with no DB access. Writes backend/gtmp/missing-gather.json — the input
 * build-crosslink-nodes.js consumes.
 *
 * Exits 1 when anything is unresolved, so CI fails on broken deep links.
 */
import { MINING_NODES } from '../../src/miningData.js'
import { BOTANY_NODES } from '../../src/botanyData.js'
import { FISHING_SPOTS } from '../../src/fishingData.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const prodDump = path.join(here, '..', 'gtmp', 'prod-recipes.json')
const seed = path.join(here, 'cooking-recipes.json')
const src = fs.existsSync(prodDump) ? prodDump : seed
console.log(`checking against ${path.basename(src)}`)
const recipes = JSON.parse(fs.readFileSync(src))
const norm = s => String(s||'').trim().toLowerCase()
const mining = new Set(), botany = new Set(), fishing = new Set()
MINING_NODES.forEach(n => { mining.add(norm(n.name)); n.items.forEach(i => mining.add(norm(i.name))) })
BOTANY_NODES.forEach(n => { botany.add(norm(n.name)); n.items.forEach(i => botany.add(norm(i.name))) })
FISHING_SPOTS.forEach(s => { fishing.add(norm(s.name)); s.fish.forEach(f => fishing.add(norm(f.name))) })
const sets = { MINING: mining, BOTANY: botany, FISHING: fishing }
const out = [], seen = new Set()
for (const r of recipes) for (const ing of (r.ingredients||[])) {
  if (!sets[ing.source] || seen.has(ing.name)) continue
  if (!sets[ing.source].has(norm(ing.name))) { seen.add(ing.name); out.push(ing) }
}
fs.mkdirSync(path.join(here, '..', 'gtmp'), { recursive: true })
fs.writeFileSync(path.join(here, '..', 'gtmp', 'missing-gather.json'), JSON.stringify(out, null, 1))
console.log(out.length ? `${out.length} UNRESOLVED items — rerun build-crosslink-nodes.js:\n` +
  out.map(i => `  ${i.source} :: ${i.name}`).join('\n') : 'ALL gathering ingredients resolve ✓')
process.exit(out.length ? 1 : 0)
