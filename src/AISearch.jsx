import { useState, useEffect, useRef, useMemo } from 'react'
import ActivityNav from './ActivityNav'
import { windowState, fmtDur } from './etWindow.js'
import { useSyncedState, SET_CODEC, readState, writeState } from './syncedState'
import { navigate } from './router'
import { MINING_NODES } from './miningData'
import { BOTANY_NODES } from './botanyData'
import { FISHING_SPOTS } from './fishingData'
import { EXTRA_BOTANY_NODES, EXTRA_MINING_NODES, EXTRA_FISHING_SPOTS } from './crosslinkNodes'
import {
  API, getToken, fetchMe, fetchFlags, aiSearch, fetchSavedAiResults,
  saveAiResult, deleteSavedAiResult, fetchRecipes, fetchJobs, aiCraftGuide,
} from './api'
import { STAT_TYPES, STAT_KEY } from './cookingData'
import { SPECIAL_DELIVERIES_KEY, normalizeSpecialDeliveriesState } from './specialDeliveriesData'
import { isFav, addFav } from './favNodes'
import ShoppingListWidget from './ShoppingListWidget'
import { itemPath } from './itemCatalog'
import './AISearch.css'

/* ============================================================
   AISearch — Centurio assistant (Gathering/Hunt companion AI)
   Route: /ai
   Admin-only preview until the ENABLE_AI_PUBLIC flag is on.
   Natural-language query -> POST /api/ai/search -> structured
   results with coords copy + live timed-node windows.
   ============================================================ */

const SAMPLES = ['Where is Chupacabra?', 'Darksteel Ore', 'Rhotano Sea fishing', 'Unspoiled nodes open now']

const PAGE_LINK = {
  hunt: { href: '/', label: 'Hunt board' },
  fishing: { href: '/gathering/fishing', label: 'Fishing log' },
  mining: { href: '/gathering/mining', label: 'Mining log' },
  botany: { href: '/gathering/botany', label: 'Botany log' },
}

const I = {
  spark: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="2.4"/></svg>),
  search: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>),
  copy: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>),
  pin: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>),
  clock: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  bulb: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.2 1 2.5h6c0-1.3.3-1.8 1-2.5A6 6 0 0 0 12 3Z"/></svg>),
  arrow: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>),
  chevron: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>),
  ext: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>),
  leaf: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>),
  pick: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 21 13 11"/><path d="M4 9c4-4 12-5 16-2-3-1-7 0-9 2 3-1 6 0 7 2-4-3-11-2-14-2Z"/><path d="m12.5 11.5 2 2"/></svg>),
  fish: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12c3-5 8-6 12-6 3 0 5 2 6 6-1 4-3 6-6 6-4 0-9-1-12-6Z"/><path d="M3 12c-1 1.5-1 3 0 4.5M3 12c-1-1.5-1-3 0-4.5"/><circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/></svg>),
  cart: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>),
  save: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>),
  archive: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><path d="M23 3H1v5h22Z"/><path d="M10 12h4"/></svg>),
  trash: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>),
  coin: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/></svg>),
  scrip: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 16.5h5"/></svg>),
  gem: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m12 21-9-12 3-6h12l3 6-9 12Z"/><path d="M3 9h18M9 3 6 9l6 12 6-12-3-6"/></svg>),
  knife: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 22 17.5 4"/><path d="M17.5 4c1.5 2.5 2 5 0 9s-2 6-1.5 9"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>),
}

// ── Ingredient sourcing: badge / icon / colour / deep-link page per source ──
const norm = (s) => String(s || '').trim().toLowerCase()
// Source colours per the design brief (design_handoff_aisearch §1).
const SOURCE_META = {
  scrip:    { badge: 'Scrip',         icon: 'scrip', color: '#c9a35b', page: null },
  gemstone: { badge: 'Gemstone',      icon: 'gem',   color: '#c06ad4', page: null },
  market:   { badge: 'Market Board',  icon: 'cart',  color: '#7a7a8a', page: null },
  vendor:   { badge: 'Vendor',        icon: 'coin',  color: '#d4a84a', page: null },
  botany:   { badge: 'Botany',        icon: 'leaf',  color: '#6fc08a', page: '/gathering/botany' },
  mining:   { badge: 'Mining',        icon: 'pick',  color: '#a07848', page: '/gathering/mining' },
  fishing:  { badge: 'Fishing',       icon: 'fish',  color: '#38b8c0', page: '/gathering/fishing' },
}
const SRC_KEY = {
  SCRIP_EXCHANGE: 'scrip', GEMSTONE: 'gemstone', MARKET_BOARD: 'market', VENDOR: 'vendor',
  BOTANY: 'botany', MINING: 'mining', FISHING: 'fishing',
}
const API_SOURCE = {
  scrip: 'SCRIP_EXCHANGE',
  gemstone: 'GEMSTONE',
  market: 'MARKET_BOARD',
  vendor: 'VENDOR',
  botany: 'BOTANY',
  mining: 'MINING',
  fishing: 'FISHING',
}
const sourceKey = (source) => {
  const raw = String(source || '').trim()
  const upper = raw.toUpperCase()
  return SRC_KEY[upper] ? upper : (API_SOURCE[raw.toLowerCase()] || 'MARKET_BOARD')
}
const metaForSource = (source) => SOURCE_META[SRC_KEY[sourceKey(source)] || 'market']
const ingAmount = (ing) => ing.amount ?? ing.qty ?? 1
const ingItemId = (ing) => ing.id ?? ing.itemId ?? null
const isCraftableIng = (ing) => !!(ing.subcraft || ing.craftable)
const ingSource = (ing) => sourceKey(ing.source)

// Short tier note from the scrip/gemstone currency name (Orange = Lv 100, Purple = Lv 90).
function scripNote(currency) {
  if (!currency) return null
  if (/orange crafters/i.test(currency)) return 'Lv 100 Materials · Scrip Exchange'
  if (/purple crafters/i.test(currency)) return 'Lv 90 Materials · Scrip Exchange'
  if (/orange gatherers/i.test(currency)) return 'Lv 100 · Scrip Exchange'
  if (/purple gatherers/i.test(currency)) return 'Lv 90 · Scrip Exchange'
  if (/bicolor gemstone/i.test(currency)) return 'Bicolor Gemstone Trader'
  if (/scrip/i.test(currency)) return 'Scrip Exchange'
  return null
}
// One clean cost line from a recipe-ingredient record.
function costLabel(ing) {
  if (!ing) return null
  const source = ingSource(ing)
  if ((source === 'SCRIP_EXCHANGE' || source === 'GEMSTONE') && ing.currency) return `${ing.currency} x ${ing.price}`
  if (source === 'VENDOR' && ing.price != null) return `${ing.price} gil`
  if (source === 'MARKET_BOARD') return 'Market Board'
  return null
}

function formatSavedDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
// Build lookup maps from the full /api/recipes payload (dishes + subcrafts, all
// expansions). recipeByName resolves recipe + subcraft cards; ingredientIndex
// carries each ingredient's source/cost plus the Dawntrail dishes that use it.
function buildIndexes(recipes) {
  const recipeByName = new Map()
  const byName = {}
  const byId = {}
  const ingredientIndex = new Map()
  for (const r of recipes || []) {
    recipeByName.set(norm(r.name), r)
    byName[norm(r.name)] = r
    byId[String(r.id)] = r
  }
  for (const r of recipes || []) {
    for (const ing of (r.ingredients || [])) {
      const k = norm(ing.name)
      let e = ingredientIndex.get(k)
      if (!e) { e = { ...ing, usedIn: [] }; ingredientIndex.set(k, e) }
      if (!r.is_subcraft && r.expansion === 'Dawntrail') e.usedIn.push(r.name)
    }
  }
  return { recipeByName, ingredientIndex, byName, byId }
}

/* ── Actionable ingredient chip (used inside recipe cards) ────────────────── */
function IngredientRow({ ing, recipeByName, onCopy, onNav, depth = 0 }) {
  const [open, setOpen] = useState(false)
  const source = ingSource(ing)
  const m = metaForSource(source)
  const craftable = isCraftableIng(ing)
  const sub = craftable ? recipeByName?.get(norm(ing.name)) : null
  const canExpand = !!(craftable && sub && depth < 2)
  const canShowSource = ['VENDOR', 'SCRIP_EXCHANGE', 'GEMSTONE'].includes(source) || !!ing.notes || !!ing.coords
  const Ico = craftable ? I.knife : I[m.icon]
  const ws = ing.window ? windowState(ing.window) : null
  const accent = craftable ? '#7c93e8' : m.color
  const isMarket = !craftable && source === 'MARKET_BOARD'
  const cost = (source === 'SCRIP_EXCHANGE' || source === 'GEMSTONE') && ing.currency
    ? `${ing.currency} x ${ing.price}`
    : (source === 'VENDOR' && ing.price != null) ? `${ing.price} gil`
    : null

  function act() {
    if (canExpand) { setOpen((o) => !o); return }
    if (craftable || m.page || isMarket || canShowSource) { onNav(itemPath(ing.name)); return }
    if (canShowSource) setOpen((o) => !o)
  }

  const goGlyph = canExpand ? <I.chevron className={open ? 'is-open' : ''} />
    : (m.page || isMarket || canShowSource || craftable) ? <I.arrow />
    : null

  return (
    <div className="airow-wrap">
      <div className={`airow${isMarket ? ' airow--market' : ''}`} role="button" tabIndex={0} style={{ '--ic': accent }}
        onClick={act} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act() } }}>
        <span className="airow__ico"><Ico /></span>
        <span className="airow__name">{ing.name}<span className="airow__qty">x{ingAmount(ing)}</span></span>
        {craftable && <span className="airow__tag">Craft</span>}
        <div className="airow__meta">
          {!craftable && <span className="airow__src" style={{ '--ic': accent }}><Ico />{m.badge}</span>}
          {cost && <span className="airow__cost">{cost}</span>}
          {ws && <span className={`airow__timer is-${ws.state}`}>{ws.pre} {fmtDur(ws.ms)}</span>}
          {ing.coords && (
            <button type="button" className="airow__coords" title="Tap to copy"
              onClick={(e) => { e.stopPropagation(); onCopy(ing.coords) }}>{ing.coords}</button>
          )}
        </div>
        {goGlyph && <span className="airow__go">{goGlyph}</span>}
      </div>
      {open && canExpand && (
        <div className="airow__sub">
          {sub.ingredients.map((si, i) => (
            <IngredientRow key={i} ing={si} recipeByName={recipeByName} onCopy={onCopy} onNav={onNav} depth={depth + 1} />
          ))}
        </div>
      )}
      {open && !canExpand && canShowSource && (
        <div className="airow__tip">
          {[m.badge, ing.zone, ing.nodeName || ing.node_name, cost, ing.notes].filter(Boolean).join(' - ')}
          {ing.coords && (
            <button type="button" className="airow__coords" title="Tap to copy"
              onClick={(e) => { e.stopPropagation(); onCopy(ing.coords) }}>{ing.coords}</button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Recipe card (crest + name, CUL/ilvl/stars, buff chips, ingredient rows) ─ */
const formatGil = (value) => (
  Number.isFinite(Number(value)) && Number(value) > 0
    ? `${Math.round(Number(value)).toLocaleString()} gil`
    : 'Unknown'
)

function AdvisorPill({ label, value }) {
  return (
    <span className="aibuff" style={{ '--bc': 'var(--gold)' }}>
      {label}: {value}
    </span>
  )
}

function CraftAdvisorResult({ result }) {
  if (!result) return null
  if (typeof result === 'string') {
    return (
      <div className="aireply" style={{ marginTop: '12px', fontSize: '13px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
        {result}
      </div>
    )
  }

  const warnings = Array.isArray(result.warnings) ? result.warnings : []
  const missing = Array.isArray(result.missing) ? result.missing : []
  const ingredients = Array.isArray(result.ingredients) ? result.ingredients : []
  const macro = Array.isArray(result.macro) ? result.macro : []

  return (
    <div className="aireply" style={{ marginTop: '12px', fontSize: '13px' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <AdvisorPill label="Craftable" value={result.craftable ? 'Yes' : 'Risky'} />
        <AdvisorPill label="HQ" value={result.hq_confidence || 'unknown'} />
        <AdvisorPill label="Cost" value={formatGil(result.estimated_cost)} />
      </div>
      {result.summary && <p style={{ margin: '0 0 8px' }}>{result.summary}</p>}
      {result.best_path && <p style={{ margin: '0 0 8px' }}><b>Best path:</b> {result.best_path}</p>}
      {result.recommended_food && <p style={{ margin: '0 0 8px' }}><b>Food:</b> {result.recommended_food}</p>}
      {(warnings.length > 0 || missing.length > 0) && (
        <div style={{ marginBottom: 10 }}>
          {[...warnings, ...missing].map((w, i) => (
            <div key={i} style={{ color: 'var(--text-muted)', marginTop: 4 }}>- {w}</div>
          ))}
        </div>
      )}
      {ingredients.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <b>Ingredient plan</b>
          {ingredients.slice(0, 12).map((ing, i) => (
            <div key={i} style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              {ing.amount ? `${ing.amount}x ` : ''}{ing.name}: {ing.action || ing.source || 'Check source'}
              {ing.cost ? ` (${formatGil(ing.cost)})` : ''}{ing.note ? ` - ${ing.note}` : ''}
            </div>
          ))}
        </div>
      )}
      {macro.length > 0 && (
        <pre style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {macro.join('\n')}
        </pre>
      )}
      {result.advice && <p style={{ margin: '10px 0 0', color: 'var(--text-muted)' }}>{result.advice}</p>}
    </div>
  )
}

const PLAN_SOURCE = {
  BOTANY: { key: 'gather', label: 'Gather', icon: 'leaf', hint: 'Botany nodes' },
  MINING: { key: 'gather', label: 'Gather', icon: 'pick', hint: 'Mining nodes' },
  FISHING: { key: 'fish', label: 'Fish', icon: 'fish', hint: 'Fishing holes' },
  VENDOR: { key: 'buy', label: 'Buy', icon: 'coin', hint: 'Vendors' },
  SCRIP_EXCHANGE: { key: 'buy', label: 'Buy', icon: 'scrip', hint: 'Scrip exchange' },
  GEMSTONE: { key: 'buy', label: 'Buy', icon: 'gem', hint: 'Gemstone traders' },
  MARKET_BOARD: { key: 'market', label: 'Market fallback', icon: 'cart', hint: 'Market Board' },
}

const PLAN_ORDER = ['craft', 'gather', 'fish', 'buy', 'market']

function buildCraftPlan(recipe, recipeByName) {
  if (!recipe?.ingredients?.length) return null
  const buckets = new Map(PLAN_ORDER.map((key) => [key, []]))
  const totals = new Map()
  const seenCrafts = new Set()

  function addItem(bucket, ing, qty, source, extra = {}) {
    const key = `${bucket}:${norm(ing.name)}:${source}`
    const existing = totals.get(key)
    if (existing) {
      existing.qty += qty
      return
    }
    const entry = { ...ing, ...extra, qty, source, bucket }
    totals.set(key, entry)
    buckets.get(bucket)?.push(entry)
  }

  function walk(ingredients, mult = 1, depth = 0) {
    for (const ing of ingredients || []) {
      const qty = ingAmount(ing) * mult
      const source = ingSource(ing)
      const sub = isCraftableIng(ing) ? recipeByName?.get(norm(ing.name)) : null
      if (sub && depth < 4) {
        const craftKey = norm(ing.name)
        if (!seenCrafts.has(craftKey)) {
          seenCrafts.add(craftKey)
          addItem('craft', ing, qty, 'CRAFT', { recipe: sub })
        }
        walk(sub.ingredients, Math.ceil(qty / (sub.yields || 1)), depth + 1)
        continue
      }
      const meta = PLAN_SOURCE[source] || PLAN_SOURCE.MARKET_BOARD
      addItem(meta.key, ing, qty, source)
    }
  }

  walk(recipe.ingredients)
  const groups = PLAN_ORDER
    .map((key) => ({ key, items: buckets.get(key) || [] }))
    .filter((group) => group.items.length > 0)
  if (!groups.length) return null
  return {
    recipe,
    groups,
    craftCount: buckets.get('craft')?.length || 0,
    gatherCount: (buckets.get('gather')?.length || 0) + (buckets.get('fish')?.length || 0),
    buyCount: (buckets.get('buy')?.length || 0) + (buckets.get('market')?.length || 0),
    timedCount: [...totals.values()].filter((item) => item.window).length,
  }
}

function findCraftPlan(result, recipeData) {
  if (!result || !recipeData?.recipeByName) return null
  for (const r of result.results || []) {
    if (r.category !== 'recipe') continue
    const recipe = recipeData.recipeByName.get(norm(r.name))
    if (recipe) return buildCraftPlan(recipe, recipeData.recipeByName)
  }
  return null
}

function planSourceMeta(source) {
  if (source === 'CRAFT') return { label: 'Craft first', icon: 'knife', hint: 'Subcrafts' }
  const meta = PLAN_SOURCE[source] || PLAN_SOURCE.MARKET_BOARD
  return meta
}

function planItemDetail(item) {
  if (item.source === 'CRAFT') return 'Intermediate craft'
  if (item.source === 'MARKET_BOARD') return 'Buy or use market fallback'
  return [item.zone, item.nodeName || item.node_name, item.coords, costLabel(item), item.notes].filter(Boolean).join(' - ')
}

function planChecklist(plan) {
  const lines = [`${plan.recipe.name} craft plan`]
  for (const group of plan.groups) {
    const meta = planSourceMeta(group.items[0]?.source)
    lines.push('', meta.label)
    for (const item of group.items) {
      const detail = planItemDetail(item)
      lines.push(`- ${item.qty}x ${item.name}${detail ? ` (${detail})` : ''}`)
    }
  }
  return lines.join('\n')
}

function planItemPriority(item) {
  if (!item.window) return 4
  const state = windowState(item.window)?.state
  if (state === 'up') return 0
  if (state === 'soon') return 1
  if (state === 'closed') return 2
  return 3
}

function sortedPlanItems(items) {
  return [...items].sort((a, b) => planItemPriority(a) - planItemPriority(b) || a.name.localeCompare(b.name))
}

function CraftPlan({ plan, checkedIngs, onToggleItem, onNav, onAddRecipe, onCopy }) {
  if (!plan) return null
  const flatItems = plan.groups.flatMap((group) => group.items)
  const checkedCount = flatItems.filter((item) => checkedIngs?.has(item.name)).length
  const totalCount = flatItems.length
  const progress = totalCount ? Math.round((checkedCount / totalCount) * 100) : 0
  const ready = totalCount > 0 && checkedCount === totalCount
  return (
    <section className="aiplan">
      <div className="aiplan__head">
        <div>
          <p>AI Craft Plan</p>
          <h2>{plan.recipe.name}</h2>
          <div className={`aiplan__progress${ready ? ' is-ready' : ''}`}>
            <span>{ready ? 'Ready to craft' : `${checkedCount}/${totalCount} complete`}</span>
            <i><b style={{ width: `${progress}%` }} /></i>
          </div>
        </div>
        <div className="aiplan__stats">
          {plan.craftCount > 0 && <span>{plan.craftCount} craft</span>}
          {plan.gatherCount > 0 && <span>{plan.gatherCount} gather</span>}
          {plan.buyCount > 0 && <span>{plan.buyCount} buy</span>}
          {plan.timedCount > 0 && <span>{plan.timedCount} timed</span>}
        </div>
      </div>
      <div className="aiplan__actions">
        <button type="button" onClick={() => onAddRecipe(plan.recipe.id)}><I.cart />Add Plan</button>
        <button type="button" onClick={() => onCopy(planChecklist(plan))}><I.copy />Copy Checklist</button>
        <button type="button" onClick={() => onNav(`/crafting/cooking?recipe=${encodeURIComponent(plan.recipe.name)}`)}>Cooking Log<I.arrow /></button>
      </div>
      <div className="aiplan__groups">
        {plan.groups.map((group) => {
          const meta = group.key === 'craft'
            ? { label: 'Craft First', icon: 'knife', hint: 'Make these before the final recipe' }
            : group.key === 'gather'
              ? { label: 'Gather', icon: 'leaf', hint: 'Botany and mining items' }
              : group.key === 'fish'
                ? { label: 'Fish', icon: 'fish', hint: 'Fishing items' }
                : group.key === 'buy'
                  ? { label: 'Buy', icon: 'coin', hint: 'Vendor, scrip, and gemstone sources' }
                  : { label: 'Market Fallback', icon: 'cart', hint: 'Use market board if you want speed' }
          const Icon = I[meta.icon]
          return (
            <div className={`aiplan__group is-${group.key}`} key={group.key}>
              <div className="aiplan__group-hd"><Icon />{meta.label}<span>{meta.hint}</span></div>
              {sortedPlanItems(group.items).map((item) => {
                const checked = checkedIngs?.has(item.name)
                const ws = item.window ? windowState(item.window) : null
                return (
                <button type="button" className={`aiplan__item${checked ? ' is-checked' : ''}${ws ? ` is-${ws.state}` : ''}`} key={`${group.key}-${item.name}-${item.source}`} onClick={() => onNav(itemPath(item.name))}>
                  <span
                    className="aiplan__check"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={(e) => { e.stopPropagation(); onToggleItem(item.name) }}
                  >
                    {checked ? <I.check /> : null}
                  </span>
                  <span className="aiplan__qty">x{item.qty}</span>
                  <span className="aiplan__name">{item.name}</span>
                  <span className="aiplan__detail">
                    {ws ? `${ws.pre} ${fmtDur(ws.ms)} - ` : ''}{planItemDetail(item) || 'Open item page'}
                  </span>
                  <I.arrow />
                </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function RecipeCard({ recipe, recipeByName, onCopy, onNav }) {
  const [open, setOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideLoading, setGuideLoading] = useState(false)
  const [guideResult, setGuideResult] = useState(null)
  const [guideError, setGuideError] = useState(null)
  
  const [stats, setStats] = useSyncedState('ffxiv-crafter-stats', { level: 100, craft: 4000, control: 4000, cp: 600 })
  const [listIds, setListIds] = useSyncedState('ffxiv-shopping-list', [], SET_CODEC)
  const inList = listIds.has(recipe.id)

  // Auto-fetch the player's level for this specific crafting job if they open the guide.
  useEffect(() => {
    if (guideOpen && getToken()) {
      fetchJobs().then(jobs => {
        const targetJob = recipe.job || 'CUL';
        const job = jobs.find(j => j.job_abbr === targetJob);
        if (job && job.level) {
          setStats(prev => ({ ...prev, level: job.level }));
        }
      }).catch(() => {});
    }
  }, [guideOpen, recipe.job, setStats]);

  const handleGenerateGuide = async () => {
    if (!getToken()) return setGuideError("You must be logged in to use the AI crafting guide.")
    setGuideLoading(true)
    setGuideError(null)
    try {
      const specialDeliveries = normalizeSpecialDeliveriesState(readState(SPECIAL_DELIVERIES_KEY, null))
      const res = await aiCraftGuide(recipe, stats.level, stats.craft, stats.control, stats.cp, specialDeliveries)
      setGuideResult(res.advisor || res.guide)
    } catch (err) {
      setGuideError(err.message)
    } finally {
      setGuideLoading(false)
    }
  }

  const buffs = recipe.food_buff || recipe.buffs || []
  const accent = STAT_TYPES[STAT_KEY[buffs[0]?.stat]]?.color || 'var(--gold)'
  const hasTimed = recipe.ingredients.some((i) => i.window)
  // Timed gathering ingredients first (matches the cooking page ordering).
  const sorted = [...recipe.ingredients].sort((a, b) => (b.window ? 1 : 0) - (a.window ? 1 : 0))
  return (
    <article className={`aicard aicard--recipe airecipe${open ? ' is-open' : ''}`} style={{ '--cat': accent }}>
      <div className="airecipe__head" role="button" tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }}>
        <span className="airecipe__crest"><I.knife /></span>
        <div className="airecipe__info">
          <h3 className="airecipe__name">{recipe.name}</h3>
        </div>
        <button className="rc__act" style={{ marginLeft: 'auto', marginRight: '8px' }}
          onClick={(e) => {
            e.stopPropagation(); setOpen(true); setGuideOpen((o) => !o);
          }}>
          <I.bulb /> Guide
        </button>
        <button className={`rc__act${inList ? ' is-active' : ''}`} style={{ marginRight: '8px' }}
          onClick={(e) => {
            e.stopPropagation()
            setListIds(s => { const n = new Set(s); n.has(recipe.id) ? n.delete(recipe.id) : n.add(recipe.id); return n })
          }}>
          <I.cart /> {inList ? 'In List' : 'Add to List'}
        </button>
        <span className={`airecipe__chev${open ? ' is-open' : ''}`}><I.chevron /></span>
      </div>
      {open && (
        <div className="airecipe__body">
          <div className="airecipe__meta" style={{ marginBottom: 8 }}>
            <span className="airecipe__job">{recipe.job || 'CUL'}</span>
            <span>ilvl {recipe.item_level ?? recipe.ilvl ?? 0}</span>
            {recipe.stars > 0 && <><span className="airecipe__dot">·</span><span className="airecipe__stars">{'★'.repeat(recipe.stars)}</span></>}
          </div>
          {buffs.length > 0 && (
            <div className="aibuffs" style={{ marginBottom: 10 }}>
              {buffs.map((b, i) => {
                const color = STAT_TYPES[STAT_KEY[b.stat]]?.color || 'var(--gold)'
                const val = b.val || (b.relative ? `+${b.valueHQ}%` : `+${b.valueHQ}`)
                return <span key={i} className="aibuff" style={{ '--bc': color }}>{b.stat} {val}</span>
              })}
            </div>
          )}

          {guideOpen && (
            <div className="aiprompt__box" style={{ marginBottom: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text)' }}>AI Crafting Advisor</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Level
                  <input type="number" value={stats.level} onChange={e => setStats({...stats, level: parseInt(e.target.value)||1})} style={{ width: '60px', background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px', borderRadius: '4px' }}/>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Craftsmanship
                  <input type="number" value={stats.craft} onChange={e => setStats({...stats, craft: parseInt(e.target.value)||0})} style={{ width: '80px', background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px', borderRadius: '4px' }}/>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Control
                  <input type="number" value={stats.control} onChange={e => setStats({...stats, control: parseInt(e.target.value)||0})} style={{ width: '80px', background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px', borderRadius: '4px' }}/>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', color: 'var(--text-muted)' }}>
                  CP
                  <input type="number" value={stats.cp} onChange={e => setStats({...stats, cp: parseInt(e.target.value)||0})} style={{ width: '60px', background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px', borderRadius: '4px' }}/>
                </label>
              </div>
              <button className="rc__act is-active" style={{ width: '100%', justifyContent: 'center' }} onClick={handleGenerateGuide} disabled={guideLoading}>
                {guideLoading ? 'Analyzing...' : 'Analyze Craft'}
              </button>
              {guideError && <div style={{ color: 'var(--red)', marginTop: '8px', fontSize: '12px' }}>{guideError}</div>}
              <CraftAdvisorResult result={guideResult} />
            </div>
          )}

          <div className="airecipe__ing-hd">
            Ingredients ({recipe.ingredients.length})
            {hasTimed && <span className="airecipe__timed">⏱ timed</span>}
          </div>
          {sorted.map((ing, i) => (
            <IngredientRow key={i} ing={ing} recipeByName={recipeByName} onCopy={onCopy} onNav={onNav} />
          ))}
          <div className="aicard__foot">
            <button type="button" className="airing__used"
              onClick={(e) => { e.stopPropagation(); onNav(`/crafting/cooking?recipe=${encodeURIComponent(recipe.name)}`) }}>
              Open in Cooking Log<I.arrow />
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

const GATHER_PATH = { BOTANY: '/gathering/botany', MINING: '/gathering/mining', FISHING: '/gathering/fishing' }

function hrefForResult(r, ingredientIndex) {
  if (!r?.name) return null
  if (r.source_url) return r.source_url
  if (r.category === 'hunt') return `/hunts?hunt=${encodeURIComponent(r.name)}`
  if (r.category === 'recipe') return `/crafting/cooking?recipe=${encodeURIComponent(r.name)}`
  if (r.category === 'item' || r.category === 'scrip') return itemPath(r.name)
  return PAGE_LINK[r.category]?.href || null
}

function isTextBoundary(text, index) {
  if (index < 0 || index >= text.length) return true
  return !/[a-z0-9']/i.test(text[index])
}

function findNextLink(text, links, from) {
  const lower = text.toLowerCase()
  let best = null
  for (const link of links) {
    const needle = link.name.toLowerCase()
    let index = lower.indexOf(needle, from)
    while (index !== -1) {
      if (isTextBoundary(text, index - 1) && isTextBoundary(text, index + needle.length)) {
        if (!best || index < best.index || (index === best.index && needle.length > best.name.length)) {
          best = { ...link, index, length: needle.length }
        }
        break
      }
      index = lower.indexOf(needle, index + 1)
    }
  }
  return best
}

function LinkedText({ text, links }) {
  if (!text || !links?.length) return text
  const parts = []
  let pos = 0
  let key = 0
  while (pos < text.length) {
    const match = findNextLink(text, links, pos)
    if (!match) break
    if (match.index > pos) parts.push(text.slice(pos, match.index))
    const label = text.slice(match.index, match.index + match.length)
    parts.push(
      <button key={`${match.href}-${key++}`} type="button" className="ai-text-link" onClick={() => navigate(match.href)}>
        {label}
      </button>
    )
    pos = match.index + match.length
  }
  if (pos < text.length) parts.push(text.slice(pos))
  return <>{parts}</>
}

function buildTextLinks(result, recipeData) {
  const links = new Map()
  for (const r of result?.results || []) {
    const href = hrefForResult(r, recipeData?.ingredientIndex)
    if (href && r.name) links.set(norm(r.name), { name: r.name, href })
  }
  for (const recipe of recipeData?.recipeByName?.values?.() || []) {
    if (links.has(norm(recipe.name))) continue
    links.set(norm(recipe.name), { name: recipe.name, href: `/crafting/cooking?recipe=${encodeURIComponent(recipe.name)}` })
  }
  for (const [key, ing] of recipeData?.ingredientIndex?.entries?.() || []) {
    if (links.has(key)) continue
    links.set(key, {
      name: ing.name,
      href: itemPath(ing.name),
    })
  }
  return [...links.values()].filter((link) => link.name.length > 2).sort((a, b) => b.name.length - a.name.length)
}

/* ── Ingredient / scrip card (Flint Corn etc.) — collapsible ─────────────── */
function IngredientCard({ r, meta, onCopy, onNav }) {
  const [open, setOpen] = useState(false)
  const source = ingSource(meta || { source: r.category === 'scrip' ? 'SCRIP_EXCHANGE' : 'MARKET_BOARD' })
  const m = metaForSource(source)
  const Ico = I[m.icon]
  const cost = costLabel(meta)
  const note = scripNote(meta?.currency)
  const usedIn = meta?.usedIn || []
  const detail = cleanDetail(r.detail)
  const gatherPath = GATHER_PATH[source]

  return (
    <article className={`aicard airing${open ? ' is-open' : ''}`} style={{ '--cat': m.color }}>
      <div className="airing__head" role="button" tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }}>
        <div className="airing__head-main">
          <h3 className="aicard__name airing__name">{r.name}</h3>
        </div>
        <div className="airing__head-right">
          <span className={`airing__chev${open ? ' is-open' : ''}`}><I.chevron /></span>
        </div>
      </div>

      {open && (
        <div className="airing__body">
          <span className="aicard__cat" style={{ color: m.color, borderColor: m.color }}>{m.badge}</span>
          {cost
            ? <div className="airing__cost"><span className="airing__cost-ico"><Ico /></span>{cost}</div>
            : (detail && <p className="aicard__detail">{detail}</p>)}
          {note && <div className="airing__note">{note}</div>}
          <div className="aicard__foot">
            {source === 'MARKET_BOARD' && ingItemId(meta || {}) && (
              <button type="button" className="airing__link"
                onClick={(e) => { e.stopPropagation(); window.open(`https://universalis.app/market/${ingItemId(meta)}`, '_blank', 'noopener') }}>
                Universalis<I.ext />
              </button>
            )}
            <button type="button" className="airing__link"
              onClick={(e) => { e.stopPropagation(); onNav(itemPath(r.name)) }}>
              Item page<I.arrow />
            </button>
            {gatherPath && (
              <button type="button" className="airing__link"
                onClick={(e) => { e.stopPropagation(); onNav(`${gatherPath}?highlight=${encodeURIComponent(r.name)}`) }}>
                View in log<I.arrow />
              </button>
            )}
            {usedIn.length > 0 && (
              <button type="button" className="airing__used"
                onClick={(e) => { e.stopPropagation(); onNav(`/crafting/cooking?ingredient=${encodeURIComponent(r.name)}`) }}>
                Used in {usedIn.length} recipe{usedIn.length !== 1 ? 's' : ''}<I.arrow />
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

const normCoords = (c) => String(c || '').replace(/~/g, '').replace(/\s+/g, '').toLowerCase()

const GATHER_CATS = new Set(['mining', 'botany', 'fishing'])

// Strip every "where to find it" hint the model sometimes tacks on — we never
// suggest external tools or explain a missing location. Any clause mentioning
// one of these is dropped; if that empties the detail, the card just shows the
// category badge + "Location not yet mapped".
const LOCATION_HINT = /(garland\s*tools?|gathering\s*(?:site|database|log)|explicit\s+node\s+coords?|not\s+(?:individually\s+)?listed|node\s+(?:location|coords?)|current\s+data|not\s+yet\s+mapped|third-?party)/i
function cleanDetail(text) {
  if (!text) return ''
  // Split into clauses on sentence enders, dashes, and newlines; drop hint clauses.
  const clauses = String(text).split(/(?<=[.;!?])\s+|\s*[—–-]\s+|\n+/)
  let t = clauses.filter((c) => c.trim() && !LOCATION_HINT.test(c)).join(' ')
  // Drop a now-redundant "Source: <Category>" lead-in (the badge already shows it).
  t = t.replace(/\bSource:\s*[A-Za-z _/]+?(?=$|[.;,])/gi, '')
  return t.replace(/\s{2,}/g, ' ').replace(/\s+([.,;!?])/g, '$1').replace(/^[\s.,;:—–-]+|[\s—–:-]+$/g, '').trim()
}

// Recent-search history powers the dashboard's "Recent" chips.
const HISTORY_KEY = 'ffxiv-search-history'
function pushHistory(text) {
  const cur = readState(HISTORY_KEY, [])
  const next = [text, ...(Array.isArray(cur) ? cur : []).filter((x) => x.toLowerCase() !== text.toLowerCase())].slice(0, 8)
  writeState(HISTORY_KEY, next) // account-synced for logged-in users
}

// Map verbatim coords -> source node, but only for TIMED nodes (those carry a
// spawn window). Lets us recover the precise window object the AI can't reliably
// echo, and render a live "Active/Soon/Closed" countdown.
const TIMED_BY_COORDS = (() => {
  const m = new Map()
  ;[...MINING_NODES, ...BOTANY_NODES].forEach((n) => { if (n.window) m.set(normCoords(n.coords), n) })
  return m
})()

const GATHER_PAGE_ITEMS = (() => {
  const make = () => new Set()
  const sets = { MINING: make(), BOTANY: make(), FISHING: make() }
  const addNode = (set, n) => { set.add(norm(n.name)); (n.items || []).forEach((i) => set.add(norm(i.name))) }
  const addSpot = (set, s) => { set.add(norm(s.name)); (s.fish || []).forEach((f) => set.add(norm(f.name))) }
  ;[...MINING_NODES, ...EXTRA_MINING_NODES].forEach((n) => addNode(sets.MINING, n))
  ;[...BOTANY_NODES, ...EXTRA_BOTANY_NODES].forEach((n) => addNode(sets.BOTANY, n))
  ;[...FISHING_SPOTS, ...EXTRA_FISHING_SPOTS].forEach((s) => addSpot(sets.FISHING, s))
  return sets
})()

const hasGatherPageTarget = (source, name) => !!GATHER_PAGE_ITEMS[source]?.has(norm(name))

// Dispatcher: rich Recipe / Ingredient cards when we have the data, else the
// standard gather/hunt card.
function ResultCard({ r, recipeByName, ingredientIndex, onCopy, onNav }) {
  if (r.category === 'recipe' && recipeByName) {
    const recipe = recipeByName.get(norm(r.name))
    if (recipe) return <RecipeCard recipe={recipe} recipeByName={recipeByName} onCopy={onCopy} onNav={onNav} />
  }
  if (r.category === 'scrip' || r.category === 'item') {
    return <IngredientCard r={r} meta={ingredientIndex?.get(norm(r.name))} onCopy={onCopy} onNav={onNav} />
  }
  return <GatherCard r={r} onCopy={onCopy} />
}

function GatherCard({ r, onCopy }) {
  const link = PAGE_LINK[r.category]
  const node = (r.category === 'mining' || r.category === 'botany') ? TIMED_BY_COORDS.get(normCoords(r.coords)) : null
  const win = node ? windowState(node.window) : null
  // Live badge if we matched a source node; static window text from the AI otherwise.
  const badge = win
    ? { state: win.state, head: win.state === 'up' ? 'Active' : win.state === 'soon' ? 'Soon' : 'Closed', sub: `${win.pre} ${fmtDur(win.ms)}`, title: node.time }
    : (r.timed && r.window ? { state: 'timed', head: 'Timed', sub: r.window, title: r.window } : null)

  const detail = cleanDetail(r.detail)
  const zone = r.zone && r.zone.trim().toLowerCase() !== 'unknown' ? r.zone : null
  const isGather = GATHER_CATS.has(r.category)
  // Deep-link straight to the highlighted item/node in the gathering log when the
  // API provided one; otherwise fall back to the plain gathering-log landing page.
  // Hunts have no source_url — focus the mark on the board via /hunts?hunt=<name>
  // (/hunts always renders the board; "/" shows the personal dashboard when signed in).
  const href = r.source_url
    || (r.category === 'hunt' ? `/hunts?hunt=${encodeURIComponent(r.name)}` : link?.href)

  return (
    <article className={`aicard aicard--${r.category}`}>
      <div className="aicard__head">
        <h3 className="aicard__name">{r.name}</h3>
        <span className={`aicard__cat aicard__cat--${r.category}`}>{r.category}</span>
      </div>
      {zone
        ? <div className="aicard__zone"><I.pin />{zone}</div>
        : (isGather && !r.coords && <div className="aicard__zone aicard__zone--unknown"><I.pin />Location not yet mapped</div>)}
      {detail && <p className="aicard__detail">{detail}</p>}

      <div className="aicard__foot">
        {r.coords && (
          <button className="aicard__coords" onClick={() => onCopy(r.coords)} title="Tap to copy">
            <I.copy />{r.coords}
          </button>
        )}
        {badge && (
          <span className={`aicard__timer is-${badge.state}`} title={badge.title}>
            <I.clock /><b>{badge.head}</b><span className="aicard__timer-sub">{badge.sub}</span>
          </span>
        )}
        {link && (
          <button type="button" className="aicard__link" onClick={() => navigate(href)}
            title={`Open ${link.label}`}>
            {link.label}<I.arrow />
          </button>
        )}
      </div>
    </article>
  )
}

export default function AISearch() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)
  const [publicOn, setPublicOn] = useState(false)

  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [resultQuery, setResultQuery] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [savedResults, setSavedResults] = useState([])
  const [savedOpen, setSavedOpen] = useState(false)
  const [savedLoading, setSavedLoading] = useState(false)
  const [savingResult, setSavingResult] = useState(false)
  const [savedResultId, setSavedResultId] = useState(null)
  const [recipeData, setRecipeData] = useState(null) // { recipeByName, ingredientIndex }
  const [listIds, setListIds] = useSyncedState('ffxiv-shopping-list', [], SET_CODEC)
  const [checkedIngs, setCheckedIngs] = useSyncedState('ffxiv-shopping-checked', [], SET_CODEC)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [, setTick] = useState(0)
  const toastTimer = useRef(null)
  const didAuto = useRef(false)

  useEffect(() => {
    document.body.classList.add('ai-page')
    return () => document.body.classList.remove('ai-page')
  }, [])

  // Gate: who can use it. Admin always (preview); everyone once the flag is on.
  useEffect(() => {
    Promise.all([getToken() ? fetchMe().catch(() => null) : Promise.resolve(null), fetchFlags()])
      .then(([me, flags]) => { setUser(me); setPublicOn(!!flags.ENABLE_AI_PUBLIC); setReady(true) })
      .catch(() => setReady(true))
  }, [])

  const craftPlan = useMemo(() => findCraftPlan(result, recipeData), [result, recipeData])

  // Keep timed-node countdowns ticking once there are results or plan rows to show.
  const hasTimed = useMemo(() => (
    (result?.results || []).some((r) => r.category === 'mining' || r.category === 'botany')
    || (craftPlan?.timedCount || 0) > 0
  ), [result, craftPlan])
  useEffect(() => {
    if (!hasTimed) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [hasTimed])

  const isAdmin = !!user?.is_admin
  const canUse = isAdmin || publicOn
  const textLinks = useMemo(() => buildTextLinks(result, recipeData), [result, recipeData])

  // Auto-run a query passed via ?q= (e.g. from the dashboard's AI hero / chips).
  useEffect(() => {
    if (!ready || !canUse || didAuto.current) return
    const params = new URLSearchParams(window.location.search)
    const recipe = params.get('recipe')
    const ingredient = params.get('ingredient')
    const iq = params.get('q')
      || (recipe ? `How do I make ${recipe}?` : null)
      || (ingredient ? `Where do I get ${ingredient}?` : null)
    if (iq && iq.trim()) { didAuto.current = true; setQ(iq.trim()); run(iq.trim()) }
  }, [ready, canUse])

  // Pull the full recipe catalog (dishes + subcrafts) once the page is usable so
  // recipe / ingredient result cards can render their rich detail client-side.
  useEffect(() => {
    if (!canUse || recipeData) return
    fetchRecipes({ expansion: null, includeSubcraft: true })
      .then((rs) => { if (rs?.length) setRecipeData(buildIndexes(rs)) })
      .catch(() => {})
  }, [canUse, recipeData])

  useEffect(() => {
    if (!canUse || !user) return
    setSavedLoading(true)
    fetchSavedAiResults()
      .then(setSavedResults)
      .catch(() => {})
      .finally(() => setSavedLoading(false))
  }, [canUse, user])

  const shoppingListData = useMemo(() => {
    if (!listIds.size || !recipeData?.byId || !recipeData?.byName) return {}
    const totals = {}
    for (const id of listIds) {
      const r = recipeData.byId[id]
      if (!r) continue
      const add = (ings, mult = 1) => {
        for (const i of ings) {
          const qty = ingAmount(i) * mult
          const normalized = {
            ...i,
            source: SRC_KEY[ingSource(i)] || 'market',
            craftable: isCraftableIng(i),
            itemId: ingItemId(i),
            qty,
          }
          if (totals[i.name]) totals[i.name].qty += qty
          else totals[i.name] = normalized
          
          if (isCraftableIng(i)) {
            const sub = recipeData.byName[i.name.trim().toLowerCase()]
            if (sub && sub.ingredients) add(sub.ingredients, Math.ceil(qty / (sub.yields || 1)))
          }
        }
      }
      add(r.ingredients)
    }
    return totals
  }, [listIds, recipeData])

  function showToast(m) { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1500) }
  function copyCoords(text) { navigator.clipboard?.writeText(String(text).replace(/^~/, '')).catch(() => {}); showToast(`Copied ${text}`) }
  function copyText(text, message = 'Copied checklist') { navigator.clipboard?.writeText(String(text)).catch(() => {}); showToast(message) }
  function navTo(url) { navigate(url) }
  function addRecipeToList(id) {
    setListIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    showToast('Added plan to shopping list')
    setSheetOpen(true)
  }

  async function saveCurrentResult() {
    if (!result || !resultQuery || savingResult || savedResultId) return
    setSavingResult(true)
    try {
      const saved = await saveAiResult(resultQuery, result)
      setSavedResults((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)])
      setSavedResultId(saved.id)
      showToast('Saved to outbox')
    } catch (err) {
      showToast(err.message || 'Could not save result')
    } finally {
      setSavingResult(false)
    }
  }

  async function deleteSavedResult(id) {
    if (!id) return
    try {
      await deleteSavedAiResult(id)
      setSavedResults((prev) => prev.filter((item) => item.id !== id))
      if (savedResultId === id) setSavedResultId(null)
      showToast('Deleted from outbox')
    } catch (err) {
      showToast(err.message || 'Could not delete result')
    }
  }

  function openSavedResult(saved) {
    setResult(saved.response)
    setResultQuery(saved.query_text)
    setSavedResultId(saved.id)
    setError(null)
    setLoading(false)
    setQ(saved.query_text)
    setSavedOpen(false)
  }

  async function run(query) {
    const text = (query ?? q).trim()
    if (!text || loading) return
    setQ(text)
    setLoading(true); setError(null); setResult(null); setSavedResultId(null)
    try {
      // Pass the current shopping list recipe names to the AI
      const currentListNames = Array.from(listIds).map(id => recipeData?.byId[id]?.name).filter(Boolean);
      const gatheringStats = readState('ffxiv-gathering-stats', null)
      const craftingStats = readState('ffxiv-crafter-stats', null)
      const specialDeliveries = normalizeSpecialDeliveriesState(readState(SPECIAL_DELIVERIES_KEY, null))
      const data = await aiSearch(text, chatHistory, currentListNames, gatheringStats, craftingStats, specialDeliveries)
      
      setResult(data)
      setResultQuery(text)
      setChatHistory(prev => [...prev, { q: text, a: data.summary }])
      pushHistory(text)

      // Handle autonomous list actions
      if (data.actions) {
        setListIds(prev => {
          let updated = new Set(prev);
          if (data.actions.clear_list) updated = new Set();
          
          if (data.actions.remove_from_list && recipeData?.byName) {
            for (const name of data.actions.remove_from_list) {
              const recipe = recipeData.byName[name];
              if (recipe) updated.delete(recipe.id);
            }
          }

          if (data.actions.add_to_list && recipeData?.byName) {
            for (const name of data.actions.add_to_list) {
              const recipe = recipeData.byName[name];
              if (recipe) updated.add(recipe.id);
            }
          }
          return updated;
        });
      }

      // Auto-pin check
      const pinnedNames = []
      for (const r of data.results || []) {
        if (r.auto_pin && (r.category === 'mining' || r.category === 'botany')) {
          const node = TIMED_BY_COORDS.get(normCoords(r.coords))
          if (node && node.id && !isFav(node.id)) {
            addFav(node.id)
            pinnedNames.push(r.name)
          }
        }
      }
      if (pinnedNames.length > 0) {
        showToast(`Pinned ${pinnedNames.join(', ')} to dashboard!`)
      }
    } catch (err) {
      if (err.status === 401) setError('Please sign in with Discord to use AI search.')
      else if (err.status === 403) setError('AI search is in admin preview right now.')
      else if (err.status === 429) setError('Rate limit reached (20/hour). Try again later.')
      else setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ledger ai">
      <ActivityNav />
      <header className="brand">
        <a href="/" className="brand__crest" title="Home" aria-label="Home"><I.spark /></a>
        <div>
          <h1 className="brand__title">CENTURIO AI</h1>
          <div className="brand__sub">
            Gathering &amp; hunt companion
            {isAdmin && !publicOn && <span className="ai-preview-badge">AI Search — Admin Preview</span>}
          </div>
        </div>
      </header>

      {!ready ? (
        <div className="ai-note">Loading…</div>
      ) : !canUse ? (
        <div className="ai-locked">
          <div className="ai-locked__ico"><I.spark /></div>
          <h3>Admin preview</h3>
          <p>Centurio AI search is being tested by admins and isn’t open yet. Check back soon.</p>
          {!user && (
            <a href={`${API}/auth/discord`} className="discord-btn"><I.spark />Sign in</a>
          )}
        </div>
      ) : (
        <>
          <form className="controls" onSubmit={(e) => { e.preventDefault(); run() }}>
            <div className="search">
              <I.search className="search__icon" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ask about a mark, fish, ore, herb, or node…"
                aria-label="Ask Centurio"
                autoFocus
              />
              {q && <button type="button" className="search__clear" onClick={() => setQ('')} aria-label="Clear">×</button>}
            </div>
            <button className="ai-go" type="submit" disabled={loading || !q.trim()}>
              {loading ? 'Asking…' : <>Ask<I.arrow /></>}
            </button>
          </form>

          <div className="ai-samples">
            {SAMPLES.map((s) => (
              <button key={s} className="ai-sample" onClick={() => run(s)} disabled={loading}>{s}</button>
            ))}
          </div>

          {error && <div className="ai-error">{error}</div>}

          {loading && (
            <div className="ai-thinking"><span className="ai-dots"><i /><i /><i /></span>Centurio is consulting the ledger…</div>
          )}

          {result && !loading && (
            <section className="ai-result ai-outbox">
              <div className="ai-outbox__head">
                <div className="ai-outbox__request">
                  <span>Request</span>
                  <h2>{resultQuery || q}</h2>
                </div>
                <div className="ai-outbox__actions">
                  {result.cached && <span className="ai-cached">Cached</span>}
                  <button
                    type="button"
                    className="ai-outbox__btn"
                    onClick={saveCurrentResult}
                    disabled={savingResult || !!savedResultId}
                    title={savedResultId ? 'Saved to outbox' : 'Save this result'}
                  >
                    {savedResultId ? <I.check /> : <I.save />}
                    {savedResultId ? 'Saved' : (savingResult ? 'Saving' : 'Save')}
                  </button>
                  {savedResultId && (
                    <button
                      type="button"
                      className="ai-outbox__btn ai-outbox__btn--danger"
                      onClick={() => deleteSavedResult(savedResultId)}
                      title="Delete this saved result"
                    >
                      <I.trash />Delete
                    </button>
                  )}
                  <button
                    type="button"
                    className="ai-outbox__btn"
                    onClick={() => setSavedOpen((open) => !open)}
                    title="Open saved AI results"
                  >
                    <I.archive />Outbox
                    {savedResults.length > 0 && <b>{savedResults.length}</b>}
                  </button>
                </div>
              </div>

              {savedOpen && (
                <div className="ai-outbox__archive">
                  <div className="ai-outbox__archive-hd">
                    <span>Saved results</span>
                    {savedLoading && <em>Loading...</em>}
                  </div>
                  {!savedLoading && savedResults.length === 0 ? (
                    <p>No saved AI results yet.</p>
                  ) : (
                    <div className="ai-outbox__saved-list">
                      {savedResults.map((saved) => (
                        <div className="ai-outbox__saved" key={saved.id}>
                          <button type="button" onClick={() => openSavedResult(saved)}>
                            <strong>{saved.query_text}</strong>
                            <span>{formatSavedDate(saved.created_at)}</span>
                          </button>
                          <button
                            type="button"
                            className="ai-outbox__delete"
                            onClick={() => deleteSavedResult(saved.id)}
                            aria-label={`Delete saved result for ${saved.query_text}`}
                            title="Delete saved result"
                          >
                            <I.trash />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="ai-summary">
                <I.spark className="ai-summary__ico" />
                <div>
                  <span className="ai-summary__label">Answer</span>
                  <span><LinkedText text={result.summary} links={textLinks} /></span>
                </div>
              </div>

              <CraftPlan
                plan={craftPlan}
                checkedIngs={checkedIngs}
                onToggleItem={(name) => {
                  setCheckedIngs((prev) => {
                    const next = new Set(prev)
                    if (next.has(name)) next.delete(name)
                    else next.add(name)
                    return next
                  })
                }}
                onNav={navTo}
                onAddRecipe={addRecipeToList}
                onCopy={(text) => copyText(text)}
              />

              {result.results?.length > 0 && (
                <div className="ai-cards">
                  {result.results.map((r, i) => (
                    <ResultCard key={`${r.name}-${i}`} r={r}
                      recipeByName={recipeData?.recipeByName} ingredientIndex={recipeData?.ingredientIndex}
                      onCopy={copyCoords} onNav={navTo} />
                  ))}
                </div>
              )}

              {result.tips?.length > 0 && (
                <div className="ai-tips">
                  <div className="ai-tips__hd"><I.bulb />Tips</div>
                  <ul>{result.tips.map((t, i) => <li key={i}><LinkedText text={t} links={textLinks} /></li>)}</ul>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <ShoppingListWidget 
        list={shoppingListData}
        isOpen={sheetOpen}
        onNavigate={navTo}
        onOpen={() => setSheetOpen(true)}
        onClose={() => setSheetOpen(false)}
        onClear={() => { setListIds(new Set()); setCheckedIngs(new Set()) }}
        checkedIngs={checkedIngs}
        onCheckIng={(name) => {
          setCheckedIngs(prev => {
            const next = new Set(prev)
            if (next.has(name)) next.delete(name)
            else next.add(name)
            return next
          })
        }}
      />

      <div className={`toast${toast ? ' show is-show' : ''}`}><I.copy />{toast}</div>
    </div>
  )
}
