import { useState, useEffect, useRef, useMemo } from 'react'
import ActivityNav from './ActivityNav'
import { windowState, fmtDur } from './etWindow'
import { readState, writeState } from './syncedState'
import { navigate } from './router'
import { MINING_NODES } from './miningData'
import { BOTANY_NODES } from './botanyData'
import { API, getToken, fetchMe, fetchFlags, aiSearch, fetchRecipes } from './api'
import { STAT_TYPES, STAT_KEY } from './cookingData'
import { isFav, addFav } from './favNodes'
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
  coin: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/></svg>),
  scrip: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 16.5h5"/></svg>),
  gem: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m12 21-9-12 3-6h12l3 6-9 12Z"/><path d="M3 9h18M9 3 6 9l6 12 6-12-3-6"/></svg>),
  knife: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 22 17.5 4"/><path d="M17.5 4c1.5 2.5 2 5 0 9s-2 6-1.5 9"/></svg>),
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
const metaForSource = (source) => SOURCE_META[SRC_KEY[source] || 'market']

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
  if ((ing.source === 'SCRIP_EXCHANGE' || ing.source === 'GEMSTONE') && ing.currency) return `${ing.currency} × ${ing.price}`
  if (ing.source === 'VENDOR' && ing.price != null) return `${ing.price} gil`
  if (ing.source === 'MARKET_BOARD') return 'Market Board'
  return null
}

// Build lookup maps from the full /api/recipes payload (dishes + subcrafts, all
// expansions). recipeByName resolves recipe + subcraft cards; ingredientIndex
// carries each ingredient's source/cost plus the Dawntrail dishes that use it.
function buildIndexes(recipes) {
  const recipeByName = new Map()
  const ingredientIndex = new Map()
  for (const r of recipes || []) recipeByName.set(norm(r.name), r)
  for (const r of recipes || []) {
    for (const ing of (r.ingredients || [])) {
      const k = norm(ing.name)
      let e = ingredientIndex.get(k)
      if (!e) { e = { ...ing, usedIn: [] }; ingredientIndex.set(k, e) }
      if (!r.is_subcraft && r.expansion === 'Dawntrail') e.usedIn.push(r.name)
    }
  }
  return { recipeByName, ingredientIndex }
}

/* ── Actionable ingredient chip (used inside recipe cards) ────────────────── */
function IngredientRow({ ing, recipeByName, onCopy, onNav, depth = 0 }) {
  const [open, setOpen] = useState(false)
  const m = metaForSource(ing.source)
  const sub = ing.subcraft ? recipeByName?.get(norm(ing.name)) : null
  const canExpand = !!(ing.subcraft && sub && depth < 2)
  const Ico = ing.subcraft ? I.knife : I[m.icon]
  const ws = ing.window ? windowState(ing.window) : null
  const accent = ing.subcraft ? '#7c93e8' : m.color
  const isMarket = !ing.subcraft && ing.source === 'MARKET_BOARD'
  // Scrip / gemstone / vendor show their cost inline.
  const cost = (ing.source === 'SCRIP_EXCHANGE' || ing.source === 'GEMSTONE') && ing.currency
      ? `${ing.currency} × ${ing.price}`
    : (ing.source === 'VENDOR' && ing.price != null) ? `${ing.price} gil`
    : null

  // Where tapping the row goes.
  function act() {
    if (canExpand) { setOpen((o) => !o); return }
    if (ing.subcraft) return // craftable but no sub-recipe to expand
    if (m.page) { onNav(`${m.page}?highlight=${encodeURIComponent(ing.name)}`); return }
    if (isMarket && ing.id) window.open(`https://universalis.app/market/${ing.id}`, '_blank', 'noopener')
  }
  // Market rows read as "buy it" — dim, no nav glyph (per brief).
  const goGlyph = canExpand ? <I.chevron className={open ? 'is-open' : ''} />
    : (m.page && !ing.subcraft) ? <I.arrow />
    : null

  return (
    <div className="airow-wrap">
      <div className={`airow${isMarket ? ' airow--market' : ''}`} role="button" tabIndex={0} style={{ '--ic': accent }}
        onClick={act} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act() } }}>
        <span className="airow__ico"><Ico /></span>
        <span className="airow__name">{ing.name}<span className="airow__qty">×{ing.amount}</span></span>
        {ing.subcraft && <span className="airow__tag">Craft</span>}
        <div className="airow__meta">
          {!ing.subcraft && <span className="airow__src" style={{ '--ic': accent }}><Ico />{m.badge}</span>}
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
    </div>
  )
}

/* ── Recipe card (crest + name, CUL/ilvl/stars, buff chips, ingredient rows) ─ */
function RecipeCard({ recipe, recipeByName, onCopy, onNav }) {
  const [open, setOpen] = useState(false)
  const buffs = recipe.food_buff || []
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
        <span className={`airecipe__chev${open ? ' is-open' : ''}`}><I.chevron /></span>
      </div>
      {open && (
        <div className="airecipe__body">
          <div className="airecipe__meta" style={{ marginBottom: 8 }}>
            <span className="airecipe__job">CUL</span>
            <span>ilvl {recipe.item_level}</span>
            {recipe.stars > 0 && <><span className="airecipe__dot">·</span><span className="airecipe__stars">{'★'.repeat(recipe.stars)}</span></>}
          </div>
          {buffs.length > 0 && (
            <div className="aibuffs" style={{ marginBottom: 10 }}>
              {buffs.map((b, i) => {
                const color = STAT_TYPES[STAT_KEY[b.stat]]?.color || 'var(--gold)'
                const val = b.relative ? `+${b.valueHQ}%` : `+${b.valueHQ}`
                return <span key={i} className="aibuff" style={{ '--bc': color }}>{b.stat} {val}</span>
              })}
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

/* ── Ingredient / scrip card (Flint Corn etc.) — collapsible ─────────────── */
function IngredientCard({ r, meta, onCopy, onNav }) {
  const [open, setOpen] = useState(false)
  const source = meta?.source || (r.category === 'scrip' ? 'SCRIP_EXCHANGE' : 'MARKET_BOARD')
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
            {source === 'MARKET_BOARD' && meta?.id && (
              <button type="button" className="airing__link"
                onClick={(e) => { e.stopPropagation(); window.open(`https://universalis.app/market/${meta.id}`, '_blank', 'noopener') }}>
                Universalis<I.ext />
              </button>
            )}
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
  const [chatHistory, setChatHistory] = useState([])
  const [recipeData, setRecipeData] = useState(null) // { recipeByName, ingredientIndex }
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

  // Keep timed-node countdowns ticking once there are results to show.
  const hasTimed = useMemo(() => (result?.results || []).some((r) => r.category === 'mining' || r.category === 'botany'), [result])
  useEffect(() => {
    if (!hasTimed) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [hasTimed])

  const isAdmin = !!user?.is_admin
  const canUse = isAdmin || publicOn

  // Auto-run a query passed via ?q= (e.g. from the dashboard's AI hero / chips).
  useEffect(() => {
    if (!ready || !canUse || didAuto.current) return
    const iq = new URLSearchParams(window.location.search).get('q')
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

  function showToast(m) { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1500) }
  function copyCoords(text) { navigator.clipboard?.writeText(String(text).replace(/^~/, '')).catch(() => {}); showToast(`Copied ${text}`) }
  function navTo(url) { navigate(url) }

  async function run(query) {
    const text = (query ?? q).trim()
    if (!text || loading) return
    setQ(text)
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await aiSearch(text, chatHistory)
      setResult(data)
      setChatHistory(prev => [...prev, { q: text, a: data.summary }])
      pushHistory(text)

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
            <div className="ai-result">
              {result.cached && <div className="ai-cached">Cached result</div>}
              <div className="ai-summary"><I.spark className="ai-summary__ico" />{result.summary}</div>

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
                  <ul>{result.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className={`toast${toast ? ' show is-show' : ''}`}><I.copy />{toast}</div>
    </div>
  )
}
