import { useState, useEffect, useMemo, useRef } from 'react'
import { windowState as winState, fmtDur } from './etWindow'
import { MINING_NODES } from './miningData'
import { BOTANY_NODES } from './botanyData'
import { getFavNodes } from './favNodes'
import { hydrateFromServer, HYDRATED_EVENT, readState } from './syncedState'
import UniversalSearch from './UniversalSearch'
import { clearToken } from './api'
import { navigate } from './router'
import './HomePage.css'

/* ============================================================
   HomePage — Centurio Ledger personal dashboard.
   Route: / (signed-in users; guests get the hunt board — see Home.jsx)
   Recreated from design_handoff_dashboard against the repo's data,
   etWindow helpers, and manual (no-router) navigation.
   ============================================================ */


function greeting() {
  const h = new Date().getHours()
  if (h < 5 || h >= 22) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// Compact Eorzea time for the identity bar (1 ET hour = 175 real seconds).
const ET_MULT = 3600 / 175
function eorzeaNow() {
  const t = Math.floor((Date.now() / 1000) * ET_MULT)
  return { h: Math.floor(t / 3600) % 24, m: Math.floor(t / 60) % 60 }
}

// Resolve a starred node id back to its full record (mining + botany are timed).
const NODE_INDEX = (() => {
  const m = new Map()
  MINING_NODES.forEach((n) => m.set(n.id, { node: n, src: 'mining', color: '#e0b252' }))
  BOTANY_NODES.forEach((n) => m.set(n.id, { node: n, src: 'botany', color: '#5aaa72' }))
  return m
})()


const I = {
  spark: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="2.4"/></svg>,
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>,
  arrow: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 14 0M12 5l7 7-7 7"/></svg>,
  chevron: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 18 6-6-6-6"/></svg>,
  leaf: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>,
  pick: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 21 13 11"/><path d="M4 9c4-4 12-5 16-2-3-1-7 0-9 2 3-1 6 0 7 2-4-3-11-2-14-2Z"/><path d="m12.5 11.5 2 2"/></svg>,
  fish: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12c3-5 8-6 12-6 3 0 5 2 6 6-1 4-3 6-6 6-4 0-9-1-12-6Z"/><path d="M3 12c-1 1.5-1 3 0 4.5M3 12c-1-1.5-1-3 0-4.5"/><circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/></svg>,
  knife: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 22 17.5 4"/><path d="M17.5 4c1.5 2.5 2 5 0 9s-2 6-1.5 9"/></svg>,
  target: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>,
  sun: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>,
  moon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" {...p}><path d="M20 13.5A8 8 0 1 1 10.5 4a6.2 6.2 0 0 0 9.5 9.5Z"/></svg>,
  hist: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/></svg>,
  star: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l2.6 6.2 6.4.5-4.9 4.1 1.5 6.2L12 16.9 6.4 20.2l1.5-6.2L3 9.7l6.4-.5L12 3Z"/></svg>,
  user: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/></svg>,
  shield: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3 5 6v5c0 4.4 3 7.4 7 9 4-1.6 7-4.6 7-9V6l-7-3Z"/><path d="m9.5 12 1.8 1.8L15 10"/></svg>,
  logout: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/></svg>,
  flask: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 2v7.31L2.83 18.2a2.02 2.02 0 0 0 1.63 3.14h15.08a2.02 2.02 0 0 0 1.63-3.14L14 9.31V2"/><path d="M8.5 2h7"/><path d="M5.52 14h12.96"/></svg>,
}

const SRC_ICO = { botany: I.leaf, mining: I.pick, fishing: I.fish }


function CompactET() {
  const [et, setEt] = useState(eorzeaNow)
  useEffect(() => { const id = setInterval(() => setEt(eorzeaNow()), 1000); return () => clearInterval(id) }, [])
  const isDay = et.h >= 6 && et.h < 18
  const hh = String(et.h).padStart(2, '0'), mm = String(et.m).padStart(2, '0')
  return (
    <div className="dh-top__et">
      <div className="dh-top__time">{hh}:{mm}</div>
      <div className={`dh-top__period ${isDay ? 'is-day' : 'is-night'}`}>
        {isDay ? <I.sun /> : <I.moon />}{isDay ? 'Eorzea Day' : 'Eorzea Night'}
      </div>
    </div>
  )
}

function TimerCard({ fav }) {
  const { node, src, color } = fav
  const ws = winState(node.window) // null for always-up (regular) nodes
  const SrcI = SRC_ICO[src] || I.leaf
  const stateKey = ws?.state || 'always'
  const href = `/gathering/${src === 'mining' ? 'mining' : 'botany'}`
  const name = node.items?.[0]?.name || node.zone
  return (
    <a className="dh-timer" style={{ '--tc': color }} href={href}>
      <div className="dh-timer__src"><SrcI />{node.type}</div>
      <div className="dh-timer__name">{name}</div>
      <div className="dh-timer__zone">{node.zone} · {node.coords}</div>
      <div className={`dh-timer__cd${stateKey === 'up' ? ' is-active' : ''}`}>{ws ? fmtDur(ws.ms) : '∞'}</div>
      <div className={`dh-timer__status is-${stateKey}`}>
        <span className="dh-timer__dot" />
        {stateKey === 'up' ? 'Active now' : stateKey === 'soon' ? 'Opens soon' : stateKey === 'closed' ? 'Opens in' : 'Always up'}
      </div>
    </a>
  )
}

function QuickTile({ tile }) {
  const IcoEl = I[tile.ico] || I.spark
  const inner = (
    <>
      <div className="dh-tile__ico"><IcoEl /></div>
      <div className="dh-tile__label">{tile.label}</div>
    </>
  )
  if (tile.soon) return <div className="dh-tile is-soon" style={{ '--tc': tile.color }}>{inner}</div>
  return <a href={tile.href} className="dh-tile" style={{ '--tc': tile.color }}>{inner}</a>
}

export default function HomePage({ user }) {
  const [, setTick] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  // Account-synced stars: bump once the server copy hydrates so the rail updates.
  const [favRev, setFavRev] = useState(0)
  useEffect(() => {
    hydrateFromServer()
    const onHydrated = () => setFavRev((n) => n + 1)
    window.addEventListener(HYDRATED_EVENT, onHydrated)
    return () => window.removeEventListener(HYDRATED_EVENT, onHydrated)
  }, [])
  const favs = useMemo(() => getFavNodes().map((id) => NODE_INDEX.get(id)).filter(Boolean), [favRev])

  // Live countdowns: re-render each second while any timer is shown.
  useEffect(() => {
    if (!favs.length) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [favs.length])

  // Close the account menu on outside click.
  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  function signOut() { clearToken(); window.location.href = '/' }

  const activeCount = favs.filter((f) => winState(f.node.window)?.state === 'up').length

  const initials = (user?.username || '?').slice(0, 2).toUpperCase()
  const avatarUrl = user?.avatar ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png?size=64` : null

  const tiles = [
    { label: 'Hunt Board', href: '/hunts', color: '#d6483a', ico: 'target' },
    { label: 'Mining', href: '/gathering/mining', color: '#e0b252', ico: 'pick' },
    { label: 'Botany', href: '/gathering/botany', color: '#5aaa72', ico: 'leaf' },
    { label: 'Fishing', href: '/gathering/fishing', color: '#58c4e8', ico: 'fish' },
    { label: 'Cooking', href: '/crafting/cooking', color: '#d4923a', ico: 'knife' },
    { label: 'Alchemy', href: '/crafting/alchemy', color: '#c79be0', ico: 'flask' },
  ]

  return (
    <div className="dh">
      <header className="dh-top">
        <div className="dh-acct" ref={menuRef}>
          <button
            type="button"
            className="dh-top__avatar"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Account menu"
          >
            {avatarUrl ? <img src={avatarUrl} alt={user.username} /> : initials}
          </button>
          {menuOpen && (
            <div className="dh-menu" role="menu">
              <a className="dh-menu__item" href={`/profile/${(user?.username || '').toLowerCase()}`} role="menuitem">
                <I.user />View profile
              </a>
              {user?.is_admin && (
                <a className="dh-menu__item" href="/admin" role="menuitem">
                  <I.shield />Admin dashboard
                </a>
              )}
              <button type="button" className="dh-menu__item dh-menu__item--danger" onClick={signOut} role="menuitem">
                <I.logout />Sign out
              </button>
            </div>
          )}
        </div>
        <div className="dh-top__id">
          <div className="dh-top__name">
            {greeting()}, <strong>{user?.username || 'Adventurer'}</strong>
            {user?.is_admin && <span className="dh-top__admin">Admin</span>}
          </div>
          <div className="dh-top__meta"><b>Centurio Ledger</b> · {user?.nuts_stash ?? 0} Sacks of Nuts</div>
        </div>
        <CompactET />
      </header>

      <UniversalSearch rev={favRev} />

      <div className="dh-shd"><span className="dh-shd__title">Quick Access</span></div>
      <div className="dh-grid">
        {tiles.map((t) => <QuickTile key={t.label} tile={t} />)}
      </div>

      {favs.length > 0 && (
        <>
          <div className="dh-shd">
            <span className="dh-shd__title">
              Favorited Timers
              {activeCount > 0 && <span className="dh-shd__badge">{activeCount} active</span>}
            </span>
            <a href="/gathering/botany" className="dh-shd__link">All nodes<I.chevron /></a>
          </div>
          <div className="dh-rail">
            <div className="dh-rail__row">
              {favs.map((f) => <TimerCard key={f.node.id} fav={f} />)}
            </div>
          </div>
        </>
      )}

      <div className="dh-shd"><span className="dh-shd__title">Saved Recipes</span></div>
      <div className="dh-rail">
        <div className="dh-rail__row">
          <div className="dh-recipe dh-recipe--soon" style={{ '--rc': '#d4923a' }}>
            <div className="dh-recipe__type"><I.knife />Cooking</div>
            <div className="dh-recipe__name">Recipes &amp; shopping lists</div>
            <div className="dh-recipe__foot"><span className="dh-recipe__soon">Coming soon</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
