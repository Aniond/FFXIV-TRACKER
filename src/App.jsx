import { useState, useEffect, useMemo, useRef } from 'react'
import './App.css'
import { Icon, RankSeal, BillCard, HuntTable, Highlight, rankVars } from './components'
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor } from './TweaksPanel'
import { API, getToken, clearToken, consumeUrlToken, fetchMe, loadProgress, saveProgress, resetProgress, savePreferences } from './api'
import Dashboard, { DIcon } from './Dashboard'
import Banner from './Banner'
import ActivityNav from './ActivityNav'

const DONE_KEY = 'ffxiv-hunt-done'

// Initial paint only — App fetches /api/hunts on mount (see effect below) and
// replaces this. Empty so an unreachable API never shows stale/retired hunts.
const SEED = {
  hunts: [],
}

const CATEGORIES = [
  { id:'hunts',     label:'Hunts',     icon:'crest',    soon:false },
  { id:'fates',     label:'FATEs',     icon:'fate',     soon:true  },
  { id:'gathering', label:'Gathering', icon:'gather',   soon:true  },
  { id:'crafting',  label:'Crafting',  icon:'craft',    soon:true  },
  { id:'treasure',  label:'Treasure',  icon:'treasure', soon:true  },
]

const ACCENTS = {
  '#c9a35b': { bright:'#ecca82', dim:'#8a7038' },
  '#8fb6d6': { bright:'#bcd8ef', dim:'#5a7894' },
  '#cf6b4b': { bright:'#e89875', dim:'#92452d' },
  '#7bbf9e': { bright:'#a9e0c5', dim:'#4a7d63' },
}

const TWEAK_DEFAULTS = {
  "view": "cards",
  "accent": "#8fb6d6",
  "density": "regular"
}

function loadDoneOverrides() {
  try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {} }
  catch { return {} }
}

function seedDoneMap(hunts) {
  const m = {}
  hunts.forEach((h) => { if (h.status === 'done') m[h.id] = true })
  return { ...m, ...loadDoneOverrides() }
}

function searchText(h) {
  return [
    h.name, h.rank, `${h.rank}-rank`, h.type, h.billNumber, h.zone, h.area,
    h.coords, h.coordsNote, h.reward, h.authority, ...(h.tips || []),
  ].join(' ').toLowerCase()
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS)
  const [hunts, setHunts] = useState(SEED.hunts)
  const [doneMap, setDoneMap] = useState(() => seedDoneMap(SEED.hunts))
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('hunts')
  const [rank, setRank] = useState('all')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [toast, setToast] = useState(null)
  const [user, setUser] = useState(null)
  // Deep-link from Centurio AI (/hunts?hunt=Forgall): open the board on that mark.
  const [highlightHunt] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('hunt') || '' } catch { return '' }
  })
  const [page, setPage] = useState(highlightHunt ? 'board' : 'overview')
  const toastTimer = useRef(null)
  const prefsSynced = useRef(false)

  // Handle OAuth redirect token in URL, then load user profile
  useEffect(() => {
    consumeUrlToken()
    if (getToken()) {
      fetchMe().then((u) => {
        if (!u) return
        setUser(u)
        setTweak({
          ...(u.pref_view    && { view:    u.pref_view }),
          ...(u.pref_accent  && { accent:  u.pref_accent }),
          ...(u.pref_density && { density: u.pref_density }),
        })
        prefsSynced.current = true
      }).catch(() => {})
    }
  }, [])

  // Fetch hunt data, then overlay API progress if authenticated
  useEffect(() => {
    fetch('https://api.ffxivlog.com/api/hunts')
      .then((r) => r.ok ? r.json() : null)
      .then(async (d) => {
        if (!d || !Array.isArray(d) || !d.length) return
        setHunts(d)
        setType('all') // reset filter when fresh data loads so no stale selection
        const base = seedDoneMap(d)
        if (getToken()) {
          const apiMap = await loadProgress().catch(() => null)
          setDoneMap(apiMap ? { ...base, ...apiMap } : base)
        } else {
          setDoneMap(base)
        }
      })
      .catch(() => {})
  }, [])

  // Persist to localStorage as fallback for unauthenticated users
  useEffect(() => {
    localStorage.setItem(DONE_KEY, JSON.stringify(doneMap))
  }, [doneMap])

  // Save view/accent/density to backend when logged in and prefs have been loaded
  useEffect(() => {
    if (!prefsSynced.current || !user) return
    savePreferences({ view: t.view, accent: t.accent, density: t.density }).catch(() => {})
  }, [t])

  useEffect(() => {
    const a = ACCENTS[t.accent] || ACCENTS['#c9a35b']
    const r = document.documentElement
    r.style.setProperty('--gold', t.accent)
    r.style.setProperty('--gold-bright', a.bright)
    r.style.setProperty('--gold-dim', a.dim)
    r.style.setProperty('--gold-faint', `${t.accent}24`)
  }, [t.accent])

  const q = query.trim()

  const filtered = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
    return hunts.filter((h) => {
      const done = !!doneMap[h.id]
      if (rank !== 'all' && h.rank !== rank) return false
      if (type !== 'all' && (h.type ?? '').trim() !== type) return false
      if (status === 'open' && done) return false
      if (status === 'done' && !done) return false
      if (tokens.length) {
        const txt = searchText(h)
        if (!tokens.every((tok) => txt.includes(tok))) return false
      }
      return true
    })
  }, [hunts, doneMap, rank, type, status, q])

  const typesPresent = useMemo(
    () => [...new Set(hunts.map((h) => h.type?.trim()).filter(Boolean))],
    [hunts]
  )
  const doneCount = hunts.filter((h) => doneMap[h.id]).length
  // Resolve the deep-linked hunt name to an id once the data has loaded.
  const highlightId = useMemo(() => {
    if (!highlightHunt) return null
    const needle = highlightHunt.trim().toLowerCase()
    return hunts.find((h) => h.name.toLowerCase() === needle)?.id ?? null
  }, [hunts, highlightHunt])

  function toggle(id) {
    const newDone = !doneMap[id]
    setDoneMap((m) => ({ ...m, [id]: newDone }))
    if (user) saveProgress(id, newDone ? 'done' : 'todo').catch(() => {})
  }
  function copyCoords(text) {
    const clean = String(text).replace(/^~/, '')
    navigator.clipboard?.writeText(clean).catch(() => {})
    showToast(`Copied ${clean}`)
  }
  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1600)
  }
  function signOut() {
    clearToken()
    setUser(null)
  }
  function resetAll() {
    if (!window.confirm('Reset all hunt progress? This cannot be undone.')) return
    setDoneMap({})
    localStorage.removeItem(DONE_KEY)
    if (user) resetProgress().catch(() => {})
  }

  const counts = { hunts: hunts.length }
  const huntsActive = cat === 'hunts'

  return (
    <>
    <Banner />
    <div className={`ledger${t.density === 'compact' ? ' is-compact' : ''}`}>
      <ActivityNav />
      <header className="brand">
        <a href="/" className="brand__crest" title="Home" aria-label="Home"><Icon.crest /></a>
        <div className="brand__info">
          <h1 className="brand__title">CENTURIO LEDGER</h1>
          <div className="brand__sub">Hunt Board · {doneCount}/{hunts.length} cleared</div>
        </div>
        {user ? (
          <div className="brand__user">
            <a href={`/profile/${user.username.toLowerCase()}`} className="brand__profile-link">
              {user.avatar && (
                <img
                  src={`https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png?size=32`}
                  alt={user.username}
                  className="brand__avatar"
                />
              )}
              <span className="brand__username">{user.username}</span>
            </a>
            {user.is_admin && <a href="/admin" className="brand__admin-pip">Admin</a>}
            <button className="brand__logout" onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <>
            <a href="/profile/aniond" className="brand__demo-link">Demo Profile</a>
            <a href={`${API}/auth/discord`} className="discord-btn">
              <Icon.discord />
              Sign in
            </a>
          </>
        )}
      </header>

      <div className="pagenav">
        <button className={page === 'overview' ? 'is-active' : ''} onClick={() => setPage('overview')}>
          <DIcon.trophy /> Overview
        </button>
        <button className={page === 'board' ? 'is-active' : ''} onClick={() => setPage('board')}>
          <Icon.crest /> Hunt Board
        </button>
      </div>

      {page === 'overview' ? (
        <Dashboard hunts={hunts} doneMap={doneMap} user={user} onOpenBoard={() => setPage('board')} />
      ) : (
      <>
      <div className="controls">
        <div className="search">
          <Icon.search className="search__icon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search marks, zones, coords, notes…"
            aria-label="Search the ledger"
          />
          {query && <button className="search__clear" onClick={() => setQuery('')} aria-label="Clear">×</button>}
        </div>

        <nav className="tabs" aria-label="Content types">
          {CATEGORIES.map((c) => {
            const I = Icon[c.icon]
            return (
              <button
                key={c.id}
                className={`tab${cat === c.id ? ' is-active' : ''}${c.soon ? ' is-soon' : ''}`}
                onClick={() => !c.soon && setCat(c.id)}
                disabled={c.soon}
              >
                <I className="tab__ico" />
                {c.label}
                <span className="tab__count">{c.soon ? '·' : counts[c.id] ?? 0}</span>
              </button>
            )
          })}
        </nav>

        {huntsActive && (
          <div className="filters">
            <div className="filters__row filters__row--top">
              <select
                className="type-select"
                value={rank}
                onChange={(e) => setRank(e.target.value.replace('-rank', ''))}
                aria-label="Filter by rank"
              >
                <option value="all">All ranks</option>
                <option value="S">S-rank</option>
                <option value="A">A-rank</option>
                <option value="B">B-rank</option>
              </select>
              {typesPresent.length > 0 && (
                <select
                  className="type-select"
                  value={type}
                  onChange={(e) => setType(e.target.value.trim())}
                  aria-label="Filter by type"
                >
                  <option value="all">All types</option>
                  {typesPresent.map((typeName) => (
                    <option key={typeName} value={typeName}>{typeName}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="filters__row filters__row--bottom">
              <button className={`chip${status === 'all' ? ' is-active' : ''}`} onClick={() => setStatus('all')}>All</button>
              <button className={`chip${status === 'open' ? ' is-active' : ''}`} onClick={() => setStatus('open')}>Open</button>
              <button className={`chip${status === 'done' ? ' is-active' : ''}`} onClick={() => setStatus('done')}>Cleared</button>
            </div>
          </div>
        )}
      </div>

      {huntsActive ? (
        <>
          <div className="metarow">
            <div className="metarow__count">
              <b>{filtered.length}</b> of {hunts.length} marks
            </div>
            <button className="reset-btn" onClick={resetAll} title="Reset all progress">Reset all</button>
            <div className="viewtoggle" role="group" aria-label="View">
              <button className={t.view === 'cards' ? 'is-active' : ''} onClick={() => setTweak('view', 'cards')} aria-label="Card view"><Icon.cards /></button>
              <button className={t.view === 'table' ? 'is-active' : ''} onClick={() => setTweak('view', 'table')} aria-label="Table view"><Icon.table /></button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty__crest"><Icon.search /></div>
              <h3>No marks found</h3>
              <p>No hunts match the current filters. Try adjusting the rank, status, or type selection.</p>
            </div>
          ) : t.view === 'table' ? (
            <HuntTable hunts={filtered} doneMap={doneMap} onToggle={toggle} onCopy={copyCoords} q={q} highlightId={highlightId} />
          ) : (
            <div className="bills">
              {filtered.map((h) => (
                <BillCard
                  key={h.id}
                  hunt={h}
                  done={!!doneMap[h.id]}
                  onToggle={() => toggle(h.id)}
                  onCopy={copyCoords}
                  q={q}
                  highlighted={h.id === highlightId}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <ComingSoon cat={CATEGORIES.find((c) => c.id === cat)} />
      )}

      </>
      )}

      <div className={`toast${toast ? ' is-show' : ''}`}>
        <Icon.copy />{toast}
      </div>

      <TweaksPanel>
        <TweakSection label="View" />
        <TweakRadio label="Layout" value={t.view} options={['cards', 'table']} onChange={(v) => setTweak('view', v)} />
        <TweakRadio label="Density" value={t.density} options={['regular', 'compact']} onChange={(v) => setTweak('density', v)} />
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={t.accent} options={Object.keys(ACCENTS)} onChange={(v) => setTweak('accent', v)} />
      </TweaksPanel>
    </div>
    </>
  )
}

function ComingSoon({ cat }) {
  const I = Icon[cat.icon]
  return (
    <div className="empty">
      <div className="empty__crest"><I /></div>
      <h3>{cat.label}</h3>
      <p>This ledger is built to grow. {cat.label} will live here — same search, same board, one tap away.</p>
      <span className="empty__soon">Coming soon</span>
    </div>
  )
}

export default App
