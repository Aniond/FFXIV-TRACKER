/* ============================================================
   universalIndex.js — instant client-side search over everything.

   Builds one flat index of every searchable entity with a deep
   link: gathering items + nodes (mining/botany), fish + spots,
   hunt marks (live from /api/hunts), recipes + ingredients (live
   from /api/recipes). Powers the home-page universal search bar:
   substring matches resolve instantly and for free; only natural-
   language questions need the (login-gated) AI.

   Entry shape: { label, sub, cat, href }
     cat ∈ hunt | mining | botany | fishing | recipe | ingredient
   ============================================================ */
import { MINING_NODES } from './miningData.js'
import { BOTANY_NODES } from './botanyData.js'
import { FISHING_SPOTS } from './fishingData.js'
import { API, fetchRecipes } from './api.js'

const norm = (s) => String(s || '').trim().toLowerCase()

function staticEntries() {
  const out = []
  const seen = new Set()
  const add = (label, sub, cat, href) => {
    const k = `${cat}:${norm(label)}`
    if (seen.has(k)) return
    seen.add(k)
    out.push({ label, sub, cat, href })
  }
  for (const n of MINING_NODES) {
    add(n.name, `Mining node · ${n.zone}`, 'mining', `/gathering/mining?highlight=${encodeURIComponent(n.name)}`)
    for (const it of n.items) add(it.name, `Mining · ${n.name}, ${n.zone}${n.window ? ' · timed' : ''}`, 'mining', `/gathering/mining?highlight=${encodeURIComponent(it.name)}`)
  }
  for (const n of BOTANY_NODES) {
    add(n.name, `Botany node · ${n.zone}`, 'botany', `/gathering/botany?highlight=${encodeURIComponent(n.name)}`)
    for (const it of n.items) add(it.name, `Botany · ${n.name}, ${n.zone}${n.window ? ' · timed' : ''}`, 'botany', `/gathering/botany?highlight=${encodeURIComponent(it.name)}`)
  }
  for (const s of FISHING_SPOTS) {
    add(s.name, `Fishing spot · ${s.zone}`, 'fishing', `/gathering/fishing?highlight=${encodeURIComponent(s.name)}`)
    for (const f of s.fish) add(f.name, `Fish · ${s.name}, ${s.zone}`, 'fishing', `/gathering/fishing?highlight=${encodeURIComponent(f.name)}`)
  }
  return out
}

async function liveEntries() {
  const out = []
  // Hunts — public endpoint, small payload.
  try {
    const r = await fetch(`${API}/api/hunts`)
    if (r.ok) {
      for (const h of await r.json()) {
        out.push({
          label: h.name,
          sub: `Hunt · ${h.rank ? `Rank ${h.rank} · ` : ''}${h.zone || ''}`,
          cat: 'hunt',
          href: `/hunts?hunt=${encodeURIComponent(h.name)}`,
        })
      }
    }
  } catch { /* offline — static entries still work */ }
  // Recipes + their ingredients (browser-cached via Cache-Control).
  try {
    const recipes = await fetchRecipes({ job: 'CUL', expansion: 'Dawntrail' })
    const seenIng = new Set()
    for (const rec of recipes) {
      out.push({
        label: rec.name,
        sub: `Recipe · CUL · iLv ${rec.item_level}`,
        cat: 'recipe',
        href: `/crafting/cooking?recipe=${encodeURIComponent(rec.name)}`,
      })
      for (const ing of rec.ingredients || []) {
        if (seenIng.has(norm(ing.name))) continue
        seenIng.add(norm(ing.name))
        out.push({
          label: ing.name,
          sub: 'Ingredient · recipes that use it',
          cat: 'ingredient',
          href: `/crafting/cooking?ingredient=${encodeURIComponent(ing.name)}`,
        })
      }
    }
  } catch { /* ignore */ }
  return out
}

let indexPromise = null
/** Build once per page load (static catalogs + hunts + recipes). */
export function getUniversalIndex() {
  if (!indexPromise) {
    indexPromise = liveEntries()
      .then((live) => [...live, ...staticEntries()])
      .catch(() => staticEntries())
  }
  return indexPromise
}

/**
 * Rank: exact > starts-with > word-boundary > substring; gathering items
 * (where to find it) sort above ingredient rows (what uses it) on ties.
 */
export function searchIndex(entries, query, limit = 8) {
  const q = norm(query)
  if (q.length < 2) return []
  const scored = []
  for (const e of entries) {
    const l = norm(e.label)
    let score
    if (l === q) score = 0
    else if (l.startsWith(q)) score = 1
    else if (l.includes(` ${q}`)) score = 2
    else if (l.includes(q)) score = 3
    else continue
    scored.push([score, e])
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].label.length - b[1].label.length)
  // One row per label+cat is already guaranteed; also collapse identical
  // labels across categories down to the top 2 (e.g. item + ingredient view).
  const byLabel = new Map()
  const out = []
  for (const [, e] of scored) {
    const n = byLabel.get(norm(e.label)) || 0
    if (n >= 2) continue
    byLabel.set(norm(e.label), n + 1)
    out.push(e)
    if (out.length >= limit) break
  }
  return out
}
