/* ============================================================
   Cooking.jsx — Centurio Ledger Cooking Log (Crafting tab)
   Route: /crafting/cooking
   Recreated from design_handoff_cooking, wired to live data:
   fetches /api/recipes and adapts it (see cookingData.js).
   ============================================================ */
import { useState, useEffect, useMemo, useRef } from 'react'
import './Cooking.css'
import ActivityNav from './ActivityNav'
import { STAT_TYPES, STAT_ORDER, SRC, adaptRecipes } from './cookingData'
import { windowState, fmtDur } from './etWindow'
import { fetchRecipes } from './api'
import EorzeaClock from './EorzeaClock'

const winState = windowState // repo exports `windowState`; alias for brevity

const LIST_KEY  = 'ffxiv-cooking-list'
const SAVED_KEY = 'ffxiv-saved-recipes'

/* ── Icons ──────────────────────────────────────────────── */
const I = {
  search:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>,
  check:     p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  chevron:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
  knife:     p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 22 17.5 4"/><path d="M17.5 4c1.5 2.5 2 5 0 9s-2 6-1.5 9"/></svg>,
  leaf:      p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>,
  pick:      p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 21 13 11"/><path d="M4 9c4-4 12-5 16-2-3-1-7 0-9 2 3-1 6 0 7 2-4-3-11-2-14-2Z"/><path d="m12.5 11.5 2 2"/></svg>,
  fish:      p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12c3-5 8-6 12-6 3 0 5 2 6 6-1 4-3 6-6 6-4 0-9-1-12-6Z"/><path d="M3 12c-1 1.5-1 3 0 4.5M3 12c-1-1.5-1-3 0-4.5"/><circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/></svg>,
  cart:      p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  arrow:     p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 14 0M12 5l7 7-7 7"/></svg>,
  basket:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 11 7.5 4h9L19 11"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8Z"/><path d="M12 11v8M8 15h8"/></svg>,
  hourglass: p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/></svg>,
  bookmark:  p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>,
  clock:     p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>,
  sort:      p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M6 12h12M9 18h6"/></svg>,
  x:         p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
}

/* ── Timer Badge ─────────────────────────────────────────── */
function TimerBadge({ ing }) {
  if (ing.source === 'market') return null
  if (!ing.window) return (
    <span className="tbadge tbadge--avail"><span className="tbadge__dot"/>Always Available</span>
  )
  const ws = winState(ing.window)
  if (ws.state === 'up') return (
    <span className="tbadge tbadge--up"><span className="tbadge__dot"/>Closes in {fmtDur(ws.ms)}</span>
  )
  return (
    <span className="tbadge tbadge--closed"><span className="tbadge__dot"/>Opens in {fmtDur(ws.ms)}</span>
  )
}

/* ── Earliest Craft Time ─────────────────────────────────── */
function EarliestCraftTime({ ingredients }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const timed = ingredients.filter(i => i.window)
  if (!timed.length) return null

  const states = timed.map(i => ({ ing: i, ws: winState(i.window) }))
  const allUp = states.every(s => s.ws.state === 'up')

  if (allUp) {
    const minClose = Math.min(...states.map(s => s.ws.ms))
    return (
      <div className="ect ect--ready">
        <span className="ect__dot ect__dot--up"/>
        <span>All timed ingredients available · Closes in <strong>{fmtDur(minClose)}</strong></span>
      </div>
    )
  }

  const closed = states.filter(s => s.ws.state !== 'up')
  const neck = closed.reduce((a, b) => a.ws.ms > b.ws.ms ? a : b)
  return (
    <div className="ect ect--waiting">
      <I.clock className="ect__ico"/>
      <span>Earliest craft in <strong>{fmtDur(neck.ws.ms)}</strong> · waiting on {neck.ing.name}</span>
    </div>
  )
}

/* ── Ingredient Chip ─────────────────────────────────────── */
function IngredientChip({ ing, onNav, checked, onCheck }) {
  const ws = ing.window ? winState(ing.window) : null
  const canNav = !!ing.nodeId
  const SrcIco = I[SRC[ing.source].icon]

  let dc
  if (ing.source === 'market')  dc = 'var(--dot-market)'
  else if (!ing.window)         dc = 'var(--dot-avail)'
  else if (ws.state === 'up')   dc = 'var(--dot-avail)'
  else if (ws.state === 'soon') dc = 'var(--dot-soon)'
  else                          dc = 'var(--dot-closed)'

  return (
    <div className={`chip${checked ? ' is-checked' : ''}`} style={{ '--dc': dc }}
      onClick={() => onCheck && onCheck(ing.name)}>
      <span className="chip__cb">
        {checked
          ? <span className="chip__cb-check"><I.check/></span>
          : <span className="chip__cb-ring"/>
        }
      </span>
      <span className="chip__dot"/>
      <span className="chip__src"><SrcIco/></span>
      <span className="chip__main">
        <span className="chip__name">{ing.name}</span>
        <TimerBadge ing={ing}/>
      </span>
      <span className="chip__qty">×{ing.qty}</span>
      {canNav && (
        <button className="chip__nav" title={`Go to ${ing.nodeName}`}
          onClick={e => { e.stopPropagation(); onNav(ing) }}>
          <I.arrow/>
        </button>
      )}
    </div>
  )
}

/* ── Recipe Card ─────────────────────────────────────────── */
function RecipeCard({ recipe, inList, isSaved, onToggleList, onToggleSave, onNav }) {
  const [expanded, setExpanded] = useState(false)
  const [checked, setChecked] = useState(() => new Set())

  const st = STAT_TYPES[recipe.primaryStat]
  const primaryBuff = recipe.buffs.find(b => b.stat === st.statName) || recipe.buffs[0]
  const hasTimed = recipe.ingredients.some(i => i.window)
  const sorted = [...recipe.ingredients].sort((a, b) => (b.window ? 1 : 0) - (a.window ? 1 : 0))
  const checkedCount = checked.size
  const allChecked = checkedCount === recipe.ingredients.length

  function toggleCheck(name) {
    setChecked(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  return (
    <article
      className={`recipe${expanded ? ' is-open' : ''}${inList ? ' is-listed' : ''}${isSaved ? ' is-saved' : ''}`}
      style={{ '--rc': st.color }}
    >
      <div className="recipe__head" onClick={() => setExpanded(o => !o)} style={{ cursor: 'pointer' }}>
        <span className="recipe__crest"><I.knife/></span>
        <div className="recipe__info">
          <h2 className="recipe__name">{recipe.name}</h2>
          <div className="recipe__meta">
            <span>ilvl {recipe.ilvl}</span>
            <span className="recipe__stars">{'★'.repeat(recipe.stars)}</span>
            <span>CUL {recipe.rlevel}</span>
          </div>
          <div className="recipe__preview">
            <span className="recipe__statbadge">{st.label} +{primaryBuff.cap}</span>
            <span className="recipe__buffline">
              {recipe.buffs.map(b => `${b.stat.slice(0,4)} ${b.val}`).join(' · ')}
            </span>
          </div>
        </div>
        <div className="recipe__actions">
          <button className={`save-btn${isSaved ? ' is-active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleSave(recipe.id) }} title={isSaved ? 'Unsave' : 'Save recipe'}>
            <I.bookmark/>
          </button>
          <button className={`list-btn${inList ? ' is-active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleList(recipe.id) }} title={inList ? 'Remove from list' : 'Add to list'}>
            {inList ? <I.check/> : <I.basket/>}
          </button>
          <button className="expand-btn" onClick={(e) => { e.stopPropagation(); setExpanded(o => !o) }}
            aria-label={expanded ? 'Collapse' : 'Expand'}>
            <I.chevron style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}/>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="recipe__body">
          <div className="recipe__section">
            <div className="field-lbl">
              Food Buff · {recipe.buffDur} min
              <span className="hq-note">(HQ: {recipe.buffDur * 1.5} min)</span>
            </div>
            <div className="bufftable">
              {recipe.buffs.map(b => (
                <div className="bufftable__row" key={b.stat}>
                  <span className="bufftable__stat" style={{ color: st.color }}>{b.stat}</span>
                  <span className="bufftable__val">{b.val}</span>
                  <span className="bufftable__cap">cap {b.cap}</span>
                </div>
              ))}
            </div>
          </div>

          {hasTimed && (
            <div className="recipe__section recipe__section--ect">
              <EarliestCraftTime ingredients={recipe.ingredients}/>
            </div>
          )}

          <div className="recipe__section">
            <div className="field-lbl">
              Ingredients ({recipe.ingredients.length})
              {checkedCount > 0 && (
                <span className="check-progress">{checkedCount}/{recipe.ingredients.length}</span>
              )}
              {hasTimed && <span className="timed-flag">⏱ timed</span>}
            </div>

            {allChecked && (
              <div className="all-checked"><I.check/> All gathered — ready to craft!</div>
            )}

            <div className="chips">
              {sorted.map(ing => (
                <IngredientChip key={ing.name + ing.source} ing={ing}
                  onNav={onNav} checked={checked.has(ing.name)} onCheck={toggleCheck}/>
              ))}
            </div>

            {checkedCount > 0 && !allChecked && (
              <button className="clear-checks" onClick={() => setChecked(new Set())}>
                Clear checklist
              </button>
            )}
          </div>

          <div className="recipe__footer">
            <button className={`addlist-btn${inList ? ' is-active' : ''}`}
              onClick={() => onToggleList(recipe.id)}>
              {inList ? <><I.check/> In List — Remove</> : <><I.basket/> Add to List</>}
            </button>
            <button className={`savefull-btn${isSaved ? ' is-active' : ''}`}
              onClick={() => onToggleSave(recipe.id)}>
              {isSaved ? <><I.check/> Saved</> : <><I.bookmark/> Save Recipe</>}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

/* ── Shopping List panel ─────────────────────────────────── */
function ShoppingList({ list, isOpen, onOpen, onClose, onClear }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isOpen) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [isOpen])

  const count = Object.keys(list).length

  const groups = useMemo(() => {
    const timed=[], botany=[], mining=[], fishing=[], market=[]
    for (const item of Object.values(list)) {
      if (item.window)               timed.push(item)
      else if (item.source==='botany')  botany.push(item)
      else if (item.source==='mining')  mining.push(item)
      else if (item.source==='fishing') fishing.push(item)
      else                              market.push(item)
    }
    const ord = { up:0, soon:1, closed:2 }
    timed.sort((a, b) => {
      const wa=winState(a.window), wb=winState(b.window)
      return (ord[wa?.state]??3) - (ord[wb?.state]??3)
    })
    return { timed, botany, mining, fishing, market }
  }, [list])

  function ShopGroup({ label, iconName, items, isTimed=false }) {
    const IcoEl = I[iconName]
    return (
      <div>
        <div className={`slist__group-hd${isTimed ? ' is-timed' : ''}`}><IcoEl/>{label}</div>
        {items.map(item => {
          const ws = item.window ? winState(item.window) : null
          let dc = item.source==='market' ? 'var(--dot-market)' : 'var(--dot-avail)'
          if (ws) dc = ws.state==='up' ? 'var(--dot-avail)' : ws.state==='soon' ? 'var(--dot-soon)' : 'var(--dot-closed)'
          return (
            <div className="slist__item" key={item.name}>
              <span className="slist__item-dot" style={{ background:dc, boxShadow:`0 0 5px ${dc}` }}/>
              <span className="slist__item-name">{item.name}</span>
              {ws && <span className="slist__item-cd">{ws.pre} {fmtDur(ws.ms)}</span>}
              <span className="slist__item-qty">×{item.qty}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {count > 0 && !isOpen && (
        <div className="slist__fab" onClick={onOpen}>
          <I.basket/>
          <span className="slist__fab-label">Shopping List</span>
          <span className="slist__fab-count">{count}</span>
          <I.chevron className="slist__fab-arrow" style={{ transform:'rotate(180deg)' }}/>
        </div>
      )}
      {isOpen && (
        <div className="slist__overlay" onClick={e => { if (e.target===e.currentTarget) onClose() }}>
          <div className="slist__sheet">
            <div className="slist__hd">
              <span className="slist__title"><I.basket/> Shopping List</span>
              <button className="slist__clear" onClick={onClear}>Clear all</button>
              <button className="slist__close" onClick={onClose}><I.x/></button>
            </div>
            <div className="slist__body">
              {count === 0 ? (
                <div className="slist__empty">Add recipes using the basket button on any card.</div>
              ) : (
                <>
                  {groups.timed.length   > 0 && <ShopGroup label="Timed — Gather First" iconName="hourglass" items={groups.timed}  isTimed/>}
                  {groups.botany.length  > 0 && <ShopGroup label="Botany"               iconName="leaf"      items={groups.botany}/>}
                  {groups.mining.length  > 0 && <ShopGroup label="Mining"               iconName="pick"      items={groups.mining}/>}
                  {groups.fishing.length > 0 && <ShopGroup label="Fishing"              iconName="fish"      items={groups.fishing}/>}
                  {groups.market.length  > 0 && <ShopGroup label="Market Board"         iconName="cart"      items={groups.market}/>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Cooking (page root) ─────────────────────────────────── */
export default function Cooking() {
  const [recipeList, setRecipeList] = useState([])
  const [loading, setLoading]       = useState(true)

  const [listIds, setListIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LIST_KEY)) || []) } catch { return new Set() }
  })
  const [savedIds, setSavedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY)) || []) } catch { return new Set() }
  })
  const [q, setQ]                   = useState('')
  const [statFilter, setStatFilter] = useState('all')
  const [diffFilter, setDiffFilter] = useState(0)
  const [sortBy, setSortBy]         = useState('ilvl')
  const [sheetOpen, setSheetOpen]   = useState(false)
  const [toast, setToast]           = useState(null)
  const [, setTick]                 = useState(0)
  const toastTimer = useRef(null)

  useEffect(() => {
    document.body.classList.add('cooking-page')
    return () => document.body.classList.remove('cooking-page')
  }, [])

  useEffect(() => {
    fetchRecipes({ job: 'CUL', expansion: 'Dawntrail' })
      .then((rs) => setRecipeList(adaptRecipes(rs)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { localStorage.setItem(LIST_KEY,  JSON.stringify([...listIds]))  }, [listIds])
  useEffect(() => { localStorage.setItem(SAVED_KEY, JSON.stringify([...savedIds])) }, [savedIds])
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let result = recipeList.filter(r => {
      if (statFilter !== 'all' && r.primaryStat !== statFilter) return false
      if (diffFilter !== 0     && r.stars !== diffFilter)       return false
      if (query) {
        const hay = [r.name, STAT_TYPES[r.primaryStat]?.label, ...r.ingredients.map(i => i.name)]
          .join(' ').toLowerCase()
        if (!hay.includes(query)) return false
      }
      return true
    })
    if (sortBy === 'ilvl')  result = [...result].sort((a, b) => b.ilvl - a.ilvl)
    if (sortBy === 'alpha') result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'stat')  result = [...result].sort((a, b) =>
      STAT_ORDER.indexOf(a.primaryStat) - STAT_ORDER.indexOf(b.primaryStat))
    return result
  }, [q, statFilter, diffFilter, sortBy, recipeList])

  const shoppingList = useMemo(() => {
    const items = {}
    for (const id of listIds) {
      const r = recipeList.find(x => x.id === id)
      if (!r) continue
      for (const ing of r.ingredients) {
        if (items[ing.name]) { items[ing.name].qty += ing.qty; items[ing.name].from.push(id) }
        else items[ing.name] = { ...ing, from: [id] }
      }
    }
    return items
  }, [listIds, recipeList])

  function toggleList(id) {
    setListIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSave(id) {
    const removing = savedIds.has(id)
    setSavedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
    showToast(removing ? 'Recipe removed' : '★ Recipe saved')
  }
  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }
  function handleNav(ing) {
    const src = SRC[ing.source]
    if (!src.path) return
    window.location.href = ing.nodeId ? `${src.path}?node=${encodeURIComponent(ing.nodeId)}` : src.path
  }

  return (
    <div className="ledger">
      <ActivityNav/>

      <header className="brand">
        <a href="/" className="brand__crest" title="Home" aria-label="Home"><I.knife/></a>
        <div>
          <h1 className="brand__title">COOKING LOG</h1>
          <div className="brand__sub">Centurio Ledger · Culinarian · Dawntrail</div>
        </div>
      </header>

      <EorzeaClock/>

      <div className="controls">
        <div className="search">
          <I.search className="search__icon"/>
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search dishes, ingredients…" aria-label="Search recipes"/>
        </div>

        <div className="filter-row">
          <span className="filter-row__lbl">Buff</span>
          <div className="types">
            {STAT_ORDER.map(k => {
              const gc = k === 'all' ? 'var(--hearth)' : STAT_TYPES[k].color
              const label = k === 'all' ? 'All' : STAT_TYPES[k].label
              return (
                <button key={k} className={`tchip${statFilter === k ? ' is-active' : ''}`}
                  style={{ '--gc': gc }} onClick={() => setStatFilter(k)}>
                  <span className="tchip__pip" style={{ '--gc': gc }}/>{label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="diff-sort-row">
          <div className="diff-btns">
            <button className={`dchip${diffFilter === 0 ? ' is-active' : ''}`}
              onClick={() => setDiffFilter(0)}>All</button>
            {[1,2,3,4,5].map(n => (
              <button key={n} className={`dchip${diffFilter === n ? ' is-active' : ''}`}
                onClick={() => setDiffFilter(n)}>{'★'.repeat(n)}</button>
            ))}
          </div>
          <div className="sort-bar">
            <I.sort className="sort-bar__ico"/>
            {[['ilvl','ilvl'],['alpha','A–Z'],['stat','Stat']].map(([val,lbl]) => (
              <button key={val} className={`sort-btn${sortBy === val ? ' is-active' : ''}`}
                onClick={() => setSortBy(val)}>{lbl}</button>
            ))}
          </div>
        </div>

        <div className="filtrow">
          <span className="filtrow__count">
            <b>{filtered.length}</b> recipe{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty__ico"><I.knife/></div>
          <h3>{loading ? 'Loading recipes…' : 'No recipes found'}</h3>
          {!loading && <p>Try a different filter or search term.</p>}
        </div>
      ) : (
        <div className="recipes">
          {filtered.map(r => (
            <RecipeCard key={r.id} recipe={r}
              inList={listIds.has(r.id)} isSaved={savedIds.has(r.id)}
              onToggleList={toggleList} onToggleSave={toggleSave} onNav={handleNav}/>
          ))}
        </div>
      )}

      <div className={`toast${toast ? ' show' : ''}`}><I.arrow/>{toast}</div>

      <ShoppingList list={shoppingList} isOpen={sheetOpen}
        onOpen={() => setSheetOpen(true)}
        onClose={() => setSheetOpen(false)}
        onClear={() => { setListIds(new Set()); setSheetOpen(false) }}/>
    </div>
  )
}
