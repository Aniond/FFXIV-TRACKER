import { useState, useEffect, useMemo, useRef } from 'react'
import ActivityNav from './ActivityNav'
import { RecipeCard } from './CraftingJob'
import { fetchRecipes, fetchPrices } from './api'
import { adaptRecipes } from './cookingData'
import { useSyncedState, SET_CODEC } from './syncedState'
import './CraftingJob.css'

const I = {
  bookmark: p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>,
  search:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>,
}

export default function SavedRecipes() {
  const [recipeList, setRecipeList] = useState([])
  const [loading, setLoading]       = useState(true)
  const [recipeByName, setRecipeByName] = useState(null)
  const [mbPrices, setMbPrices] = useState({})
  
  const [savedIds, setSavedIds] = useSyncedState('ffxiv-saved-recipes', [], SET_CODEC)
  const [q, setQ] = useState('')

  useEffect(() => {
    document.body.classList.add('crafting-page')
    return () => document.body.classList.remove('crafting-page')
  }, [])

  useEffect(() => {
    // Fetch all recipes without a job filter
    fetchRecipes({ job: null, expansion: null })
      .then((rs) => {
        const adapted = adaptRecipes(rs, false) // isFood=false for generic recipes
        setRecipeList(adapted)
        const ids = [...new Set(adapted.flatMap(r => r.ingredients || [])
          .filter(i => i.source === 'market' && !i.subcraft && i.itemId)
          .map(i => i.itemId))]
        fetchPrices(ids).then((p) => setMbPrices(p.prices || {})).catch(() => {})
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchRecipes({ job: null, expansion: null, includeSubcraft: true })
      .then((rs) => {
        if (!rs?.length) return
        const m = new Map()
        for (const r of rs) m.set(r.name.trim().toLowerCase(), r)
        setRecipeByName(m)
      })
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let result = recipeList.filter(r => savedIds.has(r.id))
    if (query) {
      result = result.filter(r => {
        const hay = [r.name, ...(r.ingredients || []).map(i => i.name)].join(' ').toLowerCase()
        return hay.includes(query)
      })
    }
    return result
  }, [q, recipeList, savedIds])

  function toggleSave(id) {
    setSavedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // We don't support shopping lists on the saved recipes page directly yet, so we pass noops.
  function toggleList() {}
  
  function handleNav(ing) {
    // Basic deep-link support; see CraftingJob.jsx
  }
  function copyCoords(text) {
    navigator.clipboard?.writeText(String(text).replace(/^~/, '')).catch(() => {})
  }

  return (
    <div className="ledger" style={{ '--theme-color': '#ffb04f' }}>
      <ActivityNav/>

      <header className="brand">
        <a href="/" className="brand__crest" title="Home" aria-label="Home" style={{ background: 'var(--theme-color)' }}><I.bookmark/></a>
        <div>
          <h1 className="brand__title" style={{ color: 'var(--theme-color)' }}>SAVED RECIPES</h1>
          <div className="brand__sub">Centurio Ledger · Bookmarks</div>
        </div>
      </header>

      <div className="controls">
        <div className="search">
          <I.search className="search__icon"/>
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search saved recipes…" aria-label="Search recipes"/>
        </div>
        <div className="filtrow">
          <span className="filtrow__count">
            <b>{filtered.length}</b> recipe{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty__ico" style={{ color: 'var(--theme-color)' }}><I.bookmark/></div>
          <h3>{loading ? 'Loading recipes…' : 'No saved recipes found'}</h3>
          {!loading && <p>Star a recipe on any crafting page to save it here.</p>}
        </div>
      ) : (
        <div className="recipes">
          {filtered.map(r => (
            <RecipeCard key={r.id} recipe={r} mbPrices={mbPrices}
              inList={false} isSaved={true}
              highlighted={false}
              recipeByName={recipeByName}
              onToggleList={toggleList} onToggleSave={toggleSave} onNav={handleNav} onCopy={copyCoords}/>
          ))}
        </div>
      )}
    </div>
  )
}
