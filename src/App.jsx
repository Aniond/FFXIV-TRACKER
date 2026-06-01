import { useState, useEffect, useMemo, useRef } from 'react'
import './App.css'
import { Icon, RankSeal, BillCard, HuntTable, Highlight, rankVars } from './components'
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor } from './TweaksPanel'
import { API, getToken, setToken, clearToken, fetchMe, loadProgress, saveProgress, resetProgress, savePreferences } from './api'
import Dashboard, { DIcon } from './Dashboard'
import Banner from './Banner'

const DONE_KEY = 'ffxiv-hunt-done'

const SEED = {
  hunts: [
    { id:1, name:"Mourner", rank:"B", type:"Intermediate Dawn Hunt", billNumber:"1/5", zone:"Yak T'el", area:"The Ja Tiika Heartland", coords:"~X:22, Y:28", coordsNote:"Roams central forest area", targets:2, reward:"1,000 Gil · 4 Sacks of Nuts · 471,744 EXP", authority:"Dawn Hunt", tips:["2 targets — kill both to complete.","Found in the lower Ja Tiika Heartland jungle.","Roaming mob — patrol until you find both."], status:"done" },
    { id:2, name:"Blue Morpho", rank:"B", type:"Intermediate Dawn Hunt", billNumber:"2/5", zone:"Yak T'el", area:"The Cerulean Cexudross", coords:"~X:18, Y:32", coordsNote:"Roams lower forest area", targets:3, reward:"1,000 Gil · 4 Sacks of Nuts · 471,744 EXP", authority:"Dawn Hunt", tips:["3 targets — kill all 3 to complete.","Large blue butterflies in the lower Yak T'el forest.","Same lower forest tier as Mourner — do both together."], status:"done" },
    { id:3, name:"Balyaborr", rank:"B", type:"Intermediate Dawn Hunt", billNumber:"3/5", zone:"Yak T'el", area:"The Ut'ohmu Horizon", coords:"~X:31, Y:11", coordsNote:"Roams — NE of map", targets:1, reward:"1,000 Gil · 4 Sacks of Nuts · 471,744 EXP", authority:"Dawn Hunt", tips:["B ranks roam continuously — no fixed spawn timer.","Teleport to Dirigible Landing aetheryte and sweep open ground north.","Single-target kill — soloable."], status:"todo" },
    { id:4, name:"Aspis", rank:"B", type:"Intermediate Dawn Hunt", billNumber:"4/5", zone:"Shaaloani", area:"Eshceyaani Wilds", coords:"~X:26, Y:10", coordsNote:"Roams the wilds — snake-heavy area", targets:3, reward:"1,000 Gil · 4 Sacks of Nuts · 471,744 EXP", authority:"Dawn Hunt", tips:["3 targets — kill all 3 Aspis to complete.","Common open-world snakes — easy to spot.","Plentiful in the area — shouldn't take long."], status:"todo" },
    { id:5, name:"Horned Lizard", rank:"B", type:"Intermediate Dawn Hunt", billNumber:"5/5", zone:"Shaaloani", area:"Eshceyaani Wilds", coords:"X:11.7, Y:13.7", coordsNote:"Roams — same area as Aspis", targets:2, reward:"1,000 Gil · 4 Sacks of Nuts · 471,744 EXP", authority:"Dawn Hunt", tips:["2 targets — kill both to complete.","Same area as Aspis — do both in one run.","Aggressive — will attack on sight."], status:"todo" },
  ],
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
  const [page, setPage] = useState('overview')
  const toastTimer = useRef(null)
  const prefsSynced = useRef(false)

  // Handle OAuth redirect token in URL, then load user profile
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      setToken(urlToken)
      window.history.replaceState({}, '', window.location.pathname)
    }
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
      if (type !== 'all' && h.type !== type) return false
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
    () => [...new Set(hunts.map((h) => h.type).filter(Boolean))],
    [hunts]
  )
  const doneCount = hunts.filter((h) => doneMap[h.id]).length

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
      <header className="brand">
        <div className="brand__crest"><Icon.crest /></div>
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
                  onChange={(e) => setType(e.target.value)}
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
            <HuntTable hunts={filtered} doneMap={doneMap} onToggle={toggle} onCopy={copyCoords} q={q} />
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
