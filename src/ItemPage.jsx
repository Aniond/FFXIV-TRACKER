import { useEffect, useMemo, useState } from 'react'
import ActivityNav from './ActivityNav'
import { fetchMe, fetchPrices, fetchRecipes, getToken } from './api'
import { navigate } from './router'
import { buildItemCatalog, sourceLabel, SOURCE_PATH } from './itemCatalog'
import { readState } from './syncedState'
import './ItemPage.css'

const I = {
  spark: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="2.4"/></svg>),
  arrow: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>),
  copy: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>),
  cart: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>),
  pin: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>),
  knife: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 22 17.5 4"/><path d="M17.5 4c1.5 2.5 2 5 0 9s-2 6-1.5 9"/></svg>),
}

function sourceClass(source) {
  return String(source || '').toLowerCase().replace(/_/g, '-')
}

const formatGil = (value) => (
  Number.isFinite(Number(value)) && Number(value) > 0
    ? `${Math.round(Number(value)).toLocaleString()} gil`
    : null
)

function marketPriceLabel(price) {
  if (!price) return null
  const parts = []
  if (price.nq != null) parts.push(`NQ ${formatGil(price.nq)}`)
  if (price.hq != null) parts.push(`HQ ${formatGil(price.hq)}`)
  return parts.filter(Boolean).join(' / ') || null
}

function priceLabel(source, marketPrice = null) {
  if ((source.source === 'SCRIP_EXCHANGE' || source.source === 'GEMSTONE') && source.currency && source.price != null) {
    return `${source.price} ${source.currency}`
  }
  if (source.source === 'VENDOR' && source.price != null) return `${source.price} gil`
  if (source.source === 'MARKET_BOARD') return marketPriceLabel(marketPrice) || 'Market Board'
  return null
}

function sourceSummary(source, marketPrice = null) {
  const parts = [
    source.zone,
    source.nodeName,
    source.nodeType,
    source.coords,
    source.time && source.time !== 'Any' ? source.time : null,
    source.bait ? `Bait: ${source.bait}` : null,
    priceLabel(source, marketPrice),
    source.notes,
  ].filter(Boolean)
  return parts.join(' - ')
}

function openSource(source, item) {
  if (source.source === 'MARKET_BOARD' && (source.itemId || item.itemId)) {
    window.open(`https://universalis.app/market/${source.itemId || item.itemId}`, '_blank', 'noopener')
    return
  }
  if (source.source === 'CRAFTED') {
    navigate(`/crafting/cooking?recipe=${encodeURIComponent(source.recipeName || item.name)}`)
    return
  }
  const path = SOURCE_PATH[source.source]
  if (path) navigate(`${path}?highlight=${encodeURIComponent(item.name)}`)
}

function ItemPage({ slug }) {
  const [recipes, setRecipes] = useState(null)
  const [toast, setToast] = useState(null)
  const [mbPrices, setMbPrices] = useState({})
  const [marketDc, setMarketDc] = useState(null)

  useEffect(() => {
    document.body.classList.add('item-page')
    return () => document.body.classList.remove('item-page')
  }, [])

  useEffect(() => {
    let alive = true
    fetchRecipes({ job: null, expansion: null, includeSubcraft: true })
      .then((rows) => { if (alive) setRecipes(rows) })
      .catch(() => { if (alive) setRecipes([]) })
    return () => { alive = false }
  }, [])

  const catalog = useMemo(() => recipes ? buildItemCatalog(recipes) : null, [recipes])
  const item = catalog?.bySlug.get(slug)

  useEffect(() => {
    const marketIds = [...new Set((item?.sources || [])
      .filter((source) => source.source === 'MARKET_BOARD' && (source.itemId || item.itemId))
      .map((source) => source.itemId || item.itemId))]
    if (!marketIds.length) {
      setMbPrices({})
      return
    }
    let alive = true
    const profilePromise = getToken() ? fetchMe().catch(() => null) : Promise.resolve(null)
    profilePromise
      .then((me) => {
        const dc = readState('ffxiv-market-server', null) || me?.world || me?.dc || null
        if (alive) setMarketDc(dc)
        return fetchPrices(marketIds, dc)
      })
      .then((p) => { if (alive) setMbPrices(p.prices || {}) })
      .catch(() => { if (alive) setMbPrices({}) })
    return () => { alive = false }
  }, [item])

  function copyCoords(coords) {
    navigator.clipboard?.writeText(String(coords).replace(/^~/, '')).catch(() => {})
    setToast(`Copied ${coords}`)
    setTimeout(() => setToast(null), 1400)
  }

  if (!catalog) {
    return (
      <div className="ledger item-ledger">
        <ActivityNav />
        <div className="item-state">Loading item...</div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="ledger item-ledger">
        <ActivityNav />
        <header className="item-hero">
          <a href="/" className="brand__crest" title="Home" aria-label="Home"><I.spark /></a>
          <div>
            <p className="item-kicker">Item not found</p>
            <h1>Unknown Item</h1>
          </div>
        </header>
        <div className="item-state">This item is not in the current recipe or gathering catalog yet.</div>
      </div>
    )
  }

  const mainSources = item.sources.filter((s) => s.source !== 'CRAFTED')
  const crafted = item.sources.find((s) => s.source === 'CRAFTED')

  return (
    <div className="ledger item-ledger">
      <ActivityNav />
      <header className="item-hero">
        <a href="/" className="brand__crest" title="Home" aria-label="Home"><I.spark /></a>
        <div className="item-hero__body">
          <p className="item-kicker">Canonical item page</p>
          <h1>{item.name}</h1>
          <div className="item-tags">
            {crafted && <span>Craftable</span>}
            {mainSources.slice(0, 3).map((source) => <span key={`${source.source}-${source.zone}-${source.nodeName}`}>{sourceLabel(source.source)}</span>)}
            {item.usedIn.length > 0 && <span>Used in {item.usedIn.length} recipes</span>}
          </div>
        </div>
      </header>

      <main className="item-grid">
        <section className="item-panel">
          <div className="item-panel__hd">
            <h2>Where To Get It</h2>
          </div>
          {mainSources.length ? (
            <div className="source-list">
              {mainSources.map((source, index) => {
                const canOpen = source.source === 'MARKET_BOARD' || source.source === 'CRAFTED' || SOURCE_PATH[source.source]
                return (
                  <article className={`source-card source-card--${sourceClass(source.source)}`} key={`${source.source}-${source.zone}-${source.nodeName}-${index}`}>
                    <div className="source-card__top">
                      <span className="source-card__badge">{sourceLabel(source.source)}</span>
                      {source.amount && <span className="source-card__qty">Recipe qty x{source.amount}</span>}
                    </div>
                    <h3>{source.nodeName || source.zone || sourceLabel(source.source)}</h3>
                    <p>{sourceSummary(source, mbPrices[source.itemId || item.itemId]) || 'Available from this source.'}</p>
                    <div className="source-card__actions">
                      {source.coords && (
                        <button type="button" onClick={() => copyCoords(source.coords)}><I.copy />{source.coords}</button>
                      )}
                      {canOpen && (
                        <button type="button" onClick={() => openSource(source, item)}>
                          {source.source === 'MARKET_BOARD' ? <I.cart /> : source.source === 'CRAFTED' ? <I.knife /> : <I.pin />}
                          {source.source === 'MARKET_BOARD' ? (marketDc ? `Universalis ${marketDc}` : 'Universalis') : source.source === 'CRAFTED' ? 'Open Recipe' : 'Open Log'}
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="item-empty">No mapped source yet.</div>
          )}
        </section>

        <section className="item-panel">
          <div className="item-panel__hd">
            <h2>Recipe Links</h2>
          </div>
          {crafted && (
            <button type="button" className="item-link-row" onClick={() => navigate(`/crafting/cooking?recipe=${encodeURIComponent(item.name)}`)}>
              <span><I.knife />Craft {item.name}</span>
              <I.arrow />
            </button>
          )}
          {item.usedIn.length ? (
            <div className="recipe-list">
              {item.usedIn.map((recipe) => (
                <button type="button" className="item-link-row" key={recipe.id} onClick={() => navigate(`/crafting/cooking?recipe=${encodeURIComponent(recipe.name)}`)}>
                  <span>{recipe.name}<small>iLv {recipe.itemLevel || 0}</small></span>
                  <I.arrow />
                </button>
              ))}
            </div>
          ) : !crafted ? (
            <div className="item-empty">No recipe usage mapped yet.</div>
          ) : null}
        </section>
      </main>

      <div className={`toast${toast ? ' show is-show' : ''}`}><I.copy />{toast}</div>
    </div>
  )
}

export default ItemPage
