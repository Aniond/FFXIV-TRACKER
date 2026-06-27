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
import { BAIT_TACKLE } from './baitTackleData.js'
import { CRAFTING_GEAR } from './craftingGearData.js'
import { API, fetchRecipes } from './api.js'
import { itemPath } from './itemCatalog.js'

const norm = (s) => String(s || '').trim().toLowerCase()
const compact = (s) => norm(s).replace(/[^a-z0-9]+/g, '')
const words = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean)

function typoBudget(s) {
  if (s.length <= 4) return 0
  if (s.length <= 8) return 1
  return 2
}

function editDistanceAtMost(a, b, max) {
  if (max < 0) return false
  if (Math.abs(a.length - b.length) > max) return false
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    let rowMin = curr[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const v = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      )
      curr[j] = v
      rowMin = Math.min(rowMin, v)
    }
    if (rowMin > max) return false
    prev = curr
  }
  return prev[b.length] <= max
}

function matchesInitialAndLastToken(q, labelWords) {
  if (q.length < 4 || labelWords.length < 2) return false
  const [first] = labelWords
  const last = labelWords[labelWords.length - 1]
  return q[0] === first[0] && last.startsWith(q.slice(1))
}

function fuzzyWordsMatch(queryWords, labelWords) {
  if (!queryWords.length || !labelWords.length) return false
  return queryWords.every((qw) => {
    const max = typoBudget(qw)
    return labelWords.some((lw) => (
      lw.startsWith(qw)
      || qw.startsWith(lw)
      || editDistanceAtMost(qw, lw, max)
    ))
  })
}

function matchScore(label, query) {
  const l = norm(label)
  const q = norm(query)
  if (l === q) return 0
  if (l.startsWith(q)) return 1
  if (l.includes(` ${q}`)) return 2
  if (l.includes(q)) return 3

  const cl = compact(label)
  const cq = compact(query)
  if (cq.length >= 3 && cl.includes(cq)) return 4

  const labelWords = words(label)
  if (matchesInitialAndLastToken(cq, labelWords)) return 5
  if (fuzzyWordsMatch(words(query), labelWords)) return 6

  return null
}

export function staticEntries() {
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
    for (const it of n.items) add(it.name, `Mining · ${n.name}, ${n.zone}${n.window ? ' · timed' : ''}`, 'mining', itemPath(it.name))
  }
  for (const n of BOTANY_NODES) {
    add(n.name, `Botany node · ${n.zone}`, 'botany', `/gathering/botany?highlight=${encodeURIComponent(n.name)}`)
    for (const it of n.items) add(it.name, `Botany · ${n.name}, ${n.zone}${n.window ? ' · timed' : ''}`, 'botany', itemPath(it.name))
  }
  for (const s of FISHING_SPOTS) {
    add(s.name, `Fishing spot · ${s.zone}`, 'fishing', `/gathering/fishing?highlight=${encodeURIComponent(s.name)}`)
    for (const f of s.fish) add(f.name, `Fish · ${s.name}, ${s.zone}`, 'fishing', itemPath(f.name))
  }
  for (const bait of BAIT_TACKLE) {
    const vendor = bait.vendor ? `${bait.vendor.npc}, ${bait.vendor.zone}` : null
    const scrip = bait.scrip ? `${bait.scrip.npc}, ${bait.scrip.zone}` : null
    add(bait.name, `Bait & tackle - ${vendor || scrip || 'Market Board'}`, 'fishing', itemPath(bait.name))
  }
  for (const gear of CRAFTING_GEAR) {
    const vendor = gear.vendor ? `${gear.vendor.npc}, ${gear.vendor.zone}` : null
    const scrip = gear.scrip ? `${gear.scrip.npc}, ${gear.scrip.zone}` : null
    const source = vendor || scrip || 'Market Board'
    add(gear.name, `${gear.slot || 'Crafting gear'} - Lv ${gear.level} - ${source}`, 'item', itemPath(gear.name))
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
    const recipes = await fetchRecipes({ job: null, expansion: null, includeSubcraft: true })
    out.push(...recipeEntries(recipes))
  } catch { /* ignore */ }
  return out
}

export function recipeEntries(recipes) {
  const out = []
  const seenIng = new Set()
  for (const rec of recipes || []) {
    out.push({
      label: rec.name,
      sub: `Recipe - ${rec.job || 'CUL'} - iLv ${rec.item_level}`,
      cat: 'recipe',
      href: `/crafting/cooking?recipe=${encodeURIComponent(rec.name)}`,
    })
    for (const ing of rec.ingredients || []) {
      if (seenIng.has(norm(ing.name))) continue
      seenIng.add(norm(ing.name))
      out.push({
        label: ing.name,
        sub: 'Ingredient - recipes that use it',
        cat: 'ingredient',
        href: itemPath(ing.name),
      })
    }
  }
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
 * Rank: exact > starts-with > word-boundary > substring > compact/abbrev >
 * typo-tolerant; gathering items (where to find it) sort above ingredient rows
 * (what uses it) on ties.
 */
export function searchIndex(entries, query, limit = 8) {
  const q = norm(query)
  if (q.length < 2) return []
  const scored = []
  for (const e of entries) {
    const score = matchScore(e.label, q)
    if (score === null) continue
    scored.push([score, e])
  }
  // On equal text-match quality: "where to find it" (gathering/hunt) beats
  // "what uses it" (ingredient/recipe), then shorter labels first.
  const CAT_PRIO = { hunt: 0, mining: 0, botany: 0, fishing: 0, item: 1, recipe: 2, ingredient: 3 }
  scored.sort((a, b) => a[0] - b[0]
    || (CAT_PRIO[a[1].cat] ?? 3) - (CAT_PRIO[b[1].cat] ?? 3)
    || a[1].label.length - b[1].label.length)
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
