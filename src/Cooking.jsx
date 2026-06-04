import { useState, useEffect, useMemo, useRef } from 'react'
import ActivityNav from './ActivityNav'
import { windowState, fmtDur } from './etWindow'
import { MINING_NODES } from './miningData'
import { BOTANY_NODES } from './botanyData'
import { FISHING_SPOTS } from './fishingData'
import { fetchRecipes } from './api'
import './Cooking.css'

/* ============================================================
   Cooking — Centurio Ledger Culinarian recipe book.
   Route: /crafting/cooking
   Search a recipe -> full "everything you need" breakdown
   (ingredients, where to gather each, subcrafts, food buff),
   built deterministically from /api/recipes cross-referenced
   against the gathering data. Click an ingredient -> every
   recipe that uses it.
   ============================================================ */

const COOK_LIST_KEY = 'ffxiv-cooking-list'
const norm = (s) => String(s || '').replace(/\s*\(.*?\)\s*$/, '').trim().toLowerCase()

const SRC = {
  FISHING: { label: 'Fishing', color: '#58c4e8' },
  MINING: { label: 'Mining', color: '#e0b252' },
  BOTANY: { label: 'Botany', color: '#5aaa72' },
  MARKET_BOARD: { label: 'Market Board', color: '#b9a4d0' },
}

// Index every gatherable item/fish -> its location, for ingredient cross-ref.
const GATHER = (() => {
  const m = new Map()
  const add = (nodes, source) => nodes.forEach((n) => (n.items || []).forEach((it) => {
    const k = norm(it.name)
    if (!m.has(k)) m.set(k, { source, zone: n.zone, coords: n.coords, level: n.level, time: n.time, window: n.window || null, type: n.type })
  }))
  add(MINING_NODES, 'MINING')
  add(BOTANY_NODES, 'BOTANY')
  FISHING_SPOTS.forEach((s) => (s.fish || []).forEach((f) => {
    const k = norm(f.name)
    if (!m.has(k)) m.set(k, { source: 'FISHING', zone: s.zone, coords: s.coords, time: s.time, weather: s.weather, window: null })
  }))
  return m
})()

const I = {
  search: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>),
  knife: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 22 17.5 4"/><path d="M17.5 4c1.5 2.5 2 5 0 9s-2 6-1.5 9"/></svg>),
  copy: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>),
  pin: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>),
  clock: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  back: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>),
  chevron: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>),
  star: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l2.6 6.2 6.4.5-4.9 4.1 1.5 6.2L12 16.9 6.4 20.2l1.5-6.2L3 9.7l6.4-.5L12 3Z"/></svg>),
  x: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>),
}

const Stars = ({ n }) => n > 0 ? <span className="ck-stars">{'★'.repeat(n)}</span> : null

function FoodBuff({ buff }) {
  if (!buff?.length) return null
  return (
    <div className="ck-buff">
      {buff.map((b) => (
        <span key={b.stat} className="ck-buff__chip" title={`HQ +${b.valueHQ}% up to ${b.maxHQ}`}>
          <b>{b.stat}</b>{b.relative ? ` +${b.valueHQ}%` : ` +${b.valueHQ}`}<i>≤{b.maxHQ}</i>
        </span>
      ))}
    </div>
  )
}

function IngredientRow({ ing, recipesByName, onPick, onCopy, depth = 0 }) {
  const [open, setOpen] = useState(false)
  const loc = (ing.source !== 'MARKET_BOARD') ? GATHER.get(norm(ing.name)) : null
  const sub = ing.subcraft ? recipesByName.get(norm(ing.name)) : null
  const win = loc?.window ? windowState(loc.window) : null
  const src = SRC[ing.source] || SRC.MARKET_BOARD

  return (
    <div className={`ck-ing depth-${depth}`} style={{ '--sc': src.color }}>
      <div className="ck-ing__main">
        <span className="ck-ing__amt">{ing.amount}×</span>
        <button className="ck-ing__name" onClick={() => onPick(ing.name)} title="Show recipes using this">{ing.name}</button>
        <span className="ck-ing__src">{src.label}</span>
        {ing.subcraft && <span className="ck-ing__sub">Subcraft</span>}
      </div>

      <div className="ck-ing__where">
        {loc ? (
          <>
            <span className="ck-ing__pin"><I.pin />{loc.zone}</span>
            {loc.coords && <button className="ck-ing__coords" onClick={() => onCopy(loc.coords)} title="Tap to copy"><I.copy />{loc.coords}</button>}
            {win && (
              <span className={`ck-ing__win is-${win.state}`}><I.clock />{win.state === 'up' ? 'Active' : win.pre} {fmtDur(win.ms)}</span>
            )}
          </>
        ) : ing.source === 'MARKET_BOARD' ? (
          <span className="ck-ing__market">Buy on the Market Board{ing.subcraft ? ' — or craft it' : ''}</span>
        ) : (
          <span className="ck-ing__market">Gatherable ({src.label})</span>
        )}
        {sub && (
          <button className={`ck-ing__expand${open ? ' is-open' : ''}`} onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide' : 'Show'} sub-recipe<I.chevron />
          </button>
        )}
      </div>

      {sub && open && (
        <div className="ck-ing__nested">
          <div className="ck-ing__nested-hd">{sub.name} needs:</div>
          {sub.ingredients.map((si, i) => (
            <IngredientRow key={`${si.name}-${i}`} ing={si} recipesByName={recipesByName} onPick={onPick} onCopy={onCopy} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function RecipeDetail({ recipe, recipesByName, usedInCount, onPick, onCopy, onBack, saved, onToggleSave }) {
  // Tick for live spawn windows on gatherable ingredients.
  const [, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id) }, [])
  return (
    <div className="ck-detail">
      <button className="ck-back" onClick={onBack}><I.back />All recipes</button>

      <div className="ck-detail__hd">
        <div className="ck-detail__title">
          <h2>{recipe.name}</h2>
          <div className="ck-detail__meta">
            Item Level {recipe.item_level} · {recipe.job} <Stars n={recipe.stars} />
            {usedInCount > 0 && <span className="ck-detail__usedin"> · used in {usedInCount} recipe{usedInCount > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <button className={`ck-save${saved ? ' is-on' : ''}`} onClick={() => onToggleSave(recipe)} title={saved ? 'Saved' : 'Save to list'}>
          <I.star />
        </button>
      </div>

      <FoodBuff buff={recipe.food_buff} />

      <div className="ck-field-lbl">Ingredients ({recipe.ingredients.length})</div>
      <div className="ck-ings">
        {recipe.ingredients.map((ing, i) => (
          <IngredientRow key={`${ing.name}-${i}`} ing={ing} recipesByName={recipesByName} onPick={onPick} onCopy={onCopy} />
        ))}
      </div>
    </div>
  )
}

export default function Cooking() {
  const [recipes, setRecipes] = useState(null) // null = loading
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [ingredientFilter, setIngredientFilter] = useState(null)
  const [saved, setSaved] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(COOK_LIST_KEY)) || []) } catch { return new Set() } })
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  useEffect(() => {
    document.body.classList.add('cooking-page')
    return () => document.body.classList.remove('cooking-page')
  }, [])

  useEffect(() => {
    fetchRecipes({ job: 'CUL', expansion: 'Dawntrail' }).then((rs) => {
      setRecipes(rs)
      // Deep link: ?recipe=<id|name>
      const param = new URLSearchParams(window.location.search).get('recipe')
      if (param) {
        const hit = rs.find((r) => String(r.id) === param || norm(r.name) === norm(param))
        if (hit) setSelected(hit)
      }
    })
  }, [])

  const recipesByName = useMemo(() => {
    const m = new Map()
    ;(recipes || []).forEach((r) => m.set(norm(r.name), r))
    return m
  }, [recipes])

  // How many recipes use a given result as a subcraft ingredient.
  const usedInCount = useMemo(() => {
    if (!selected) return 0
    const target = norm(selected.name)
    return (recipes || []).filter((r) => r.ingredients.some((i) => norm(i.name) === target)).length
  }, [selected, recipes])

  const filtered = useMemo(() => {
    const list = recipes || []
    if (ingredientFilter) {
      const t = norm(ingredientFilter)
      return list.filter((r) => r.ingredients.some((i) => norm(i.name) === t))
    }
    const query = q.trim().toLowerCase()
    if (!query) return list
    return list.filter((r) =>
      r.name.toLowerCase().includes(query) ||
      (r.food_buff || []).some((b) => b.stat.toLowerCase().includes(query)) ||
      r.ingredients.some((i) => i.name.toLowerCase().includes(query))
    )
  }, [recipes, q, ingredientFilter])

  function showToast(m) { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1500) }
  function copyCoords(text) { navigator.clipboard?.writeText(String(text).replace(/^~/, '')).catch(() => {}); showToast(`Copied ${text}`) }
  function pickIngredient(name) { setSelected(null); setIngredientFilter(name); setQ(''); window.scrollTo({ top: 0 }) }
  function openRecipe(r) { setSelected(r); window.scrollTo({ top: 0 }) }
  function toggleSave(r) {
    setSaved((prev) => {
      const next = new Set(prev)
      next.has(r.id) ? next.delete(r.id) : next.add(r.id)
      localStorage.setItem(COOK_LIST_KEY, JSON.stringify([...next]))
      return next
    })
  }

  return (
    <div className="ledger cooking">
      <ActivityNav />
      <header className="brand">
        <a href="/" className="brand__crest" title="Home" aria-label="Home"><I.knife /></a>
        <div>
          <h1 className="brand__title">COOKING LOG</h1>
          <div className="brand__sub">Centurio Ledger · Dawntrail Culinarian{recipes ? ` · ${recipes.length} recipes` : ''}</div>
        </div>
      </header>

      {selected ? (
        <RecipeDetail
          recipe={selected}
          recipesByName={recipesByName}
          usedInCount={usedInCount}
          onPick={pickIngredient}
          onCopy={copyCoords}
          onBack={() => setSelected(null)}
          saved={saved.has(selected.id)}
          onToggleSave={toggleSave}
        />
      ) : (
        <>
          <div className="controls">
            <div className="search">
              <I.search className="search__icon" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setIngredientFilter(null) }} placeholder="Search recipes, ingredients, or buffs…" aria-label="Search recipes" />
              {q && <button className="search__clear" onClick={() => setQ('')} aria-label="Clear">×</button>}
            </div>
          </div>

          {ingredientFilter && (
            <div className="ck-filterbar">
              Recipes using <b>{ingredientFilter}</b>
              <button onClick={() => setIngredientFilter(null)} aria-label="Clear"><I.x /></button>
            </div>
          )}

          {recipes === null ? (
            <div className="ck-note">Loading recipes…</div>
          ) : filtered.length === 0 ? (
            <div className="ck-note">No recipes match “{ingredientFilter || q}”.</div>
          ) : (
            <div className="ck-list">
              {filtered.map((r) => (
                <button key={r.id} className="ck-card" onClick={() => openRecipe(r)}>
                  <div className="ck-card__top">
                    <span className="ck-card__name">{r.name}</span>
                    {saved.has(r.id) && <I.star className="ck-card__saved" />}
                  </div>
                  <div className="ck-card__meta">
                    iLvl {r.item_level} <Stars n={r.stars} /> · {r.ingredients.length} ingredients
                  </div>
                  {r.food_buff?.length > 0 && (
                    <div className="ck-card__buffs">
                      {r.food_buff.map((b) => <span key={b.stat} className="ck-card__buff">{b.stat}</span>)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className={`toast${toast ? ' show is-show' : ''}`}><I.copy />{toast}</div>
    </div>
  )
}
