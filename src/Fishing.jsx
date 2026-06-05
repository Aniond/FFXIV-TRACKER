import { useState, useEffect, useMemo, useRef } from 'react'
import EorzeaClock from './EorzeaClock'
import OceanFishing, { OCEAN_ROUTES } from './OceanFishing'
import { FISHING_SPOTS, EXPANSIONS } from './fishingData'
import { BAIT_VENDORS } from './baitVendors'
import { BAIT_TACKLE } from './baitTackleData'
import ActivityNav from './ActivityNav'
import './Fishing.css'

/* ============================================================
   Fishing — Centurio Ledger Fishing Log (Gathering tab)
   Route: /fishing
   Mobile-first. Teal-themed variant of the hunt board.
   Personal catch checklist persists in localStorage.
   ============================================================ */

const CATCH_KEY = 'ffxiv-fish-caught'

const I = {
  search: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>),
  copy: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>),
  chevron: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>),
  hook: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v9a4 4 0 0 0 8 0v-1M12 3h3M12 3H9"/><circle cx="20" cy="9.5" r="1.4" fill="currentColor" stroke="none"/></svg>),
  fish: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12c3-5 8-6 12-6 3 0 5 2 6 6-1 4-3 6-6 6-4 0-9-1-12-6Z"/><path d="M3 12c-1 1.5-1 3 0 4.5M3 12c-1-1.5-1-3 0-4.5"/><circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/></svg>),
  sun: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>),
  moon: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 13.5A8 8 0 1 1 10.5 4a6.2 6.2 0 0 0 9.5 9.5Z"/></svg>),
  cloud: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 3.5 3.5 0 0 0 7 18Z"/></svg>),
  clock: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  coin: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/></svg>),
}

const RVARS = {
  common: { '--rc': 'var(--r-common)' },
  rare: { '--rc': 'var(--r-rare)' },
  legendary: { '--rc': 'var(--r-legend)' },
}
const RARITY_WORD = { common: 'Common', rare: 'Rare', legendary: 'Legendary' }

const fishKey = (spotId, fishName) => `${spotId}::${fishName}`

function SpotCard({ spot, caught, onToggleFish, onToggleAll, onCopy, highlighted }) {
  const total = spot.fish.length
  const got = spot.fish.filter((f) => caught[fishKey(spot.id, f.name)]).length
  const allDone = got === total
  const ref = useRef(null)
  // Deep-link target: scroll the card into view when it becomes highlighted.
  useEffect(() => {
    if (highlighted && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlighted])
  return (
    <article ref={ref} className={`spot${allDone ? ' is-done' : ''}${highlighted ? ' is-highlight' : ''}`}>
      <div className="spot__head">
        <div className="spot__head-main">
          <h2 className="spot__name">{spot.name}</h2>
          <div className="spot__zone">
            <span className="exp">{spot.expansion === 'Dawntrail' ? 'DT' : 'EW'}</span>
            {spot.zone}
          </div>
          <div className={`spot__prog${allDone ? ' full' : ''}`}>
            <I.fish style={{ width: 12, height: 12 }} /><b>{got}</b>/{total} logged
          </div>
        </div>
        <button className={`catch-btn${allDone ? ' is-done' : ''}`} onClick={() => onToggleAll(spot, !allDone)} title={allDone ? 'Clear spot' : 'Log all fish'}>
          <I.check />
        </button>
      </div>

      <div className="reqs">
        <span className="req req--coords" onClick={() => onCopy(spot.coords)} title="Tap to copy">
          <I.copy />{spot.coords}
        </span>
        {spot.weather && <span className="req req--weather"><I.cloud />{spot.weather}</span>}
        <span className={`req ${spot.time === 'Night' ? 'req--weather' : 'req--time'}`}>
          {spot.time === 'Night' ? <I.moon /> : spot.time === 'Any' ? <I.clock /> : <I.sun />}{spot.time}
        </span>
      </div>

      <div className="field-lbl">Bait</div>
      <div className="baits">
        {spot.baits.map(([name, color]) => {
          const v = BAIT_VENDORS[name]
          return (
            <span className="bait" key={name}
              title={v ? `${name} — buy from ${v.vendor} (${v.zone}) · ${v.price} gil` : name}>
              <span className="bait__dot" style={{ '--bc': color }} />{name}
              {v && (
                <button className="bait__buy" title={`Copy ${v.coords}`}
                  onClick={() => onCopy(v.coords)}>
                  <I.coin />{v.price}g
                </button>
              )}
            </span>
          )
        })}
      </div>

      <div className="field-lbl">Catch ({got}/{total})</div>
      <div className="fish-list">
        {spot.fish.map((f) => {
          const key = fishKey(spot.id, f.name)
          const done = !!caught[key]
          return (
            <div className="fish" key={f.name} style={RVARS[f.rarity]}>
              <span className="fish__icon"><I.fish /></span>
              <span className="fish__body">
                <span className="fish__name">{f.name}</span>
                {(f.note || f.timed) && <span className="fish__meta">{f.timed ? '⌚ ' : ''}{f.note || RARITY_WORD[f.rarity]}</span>}
              </span>
              <span className="fish__rarity">{RARITY_WORD[f.rarity]}</span>
              <button className={`fish__check${done ? ' is-done' : ''}`} onClick={() => onToggleFish(key)} title={done ? 'Caught' : 'Mark caught'}>
                <I.check />
              </button>
            </div>
          )
        })}
      </div>
    </article>
  )
}

export default function Fishing({ spots = FISHING_SPOTS }) {
  const [caught, setCaught] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CATCH_KEY)) || {} } catch { return {} }
  })
  const [q, setQ] = useState('')
  const [exp, setExp] = useState('All')
  const [zone, setZone] = useState('All zones')
  const [toast, setToast] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const toastTimer = useRef(null)

  // Scope the fishing page's CSS tokens to body so they don't bleed into the hunt board
  useEffect(() => {
    document.body.classList.add('fishing-page')
    return () => document.body.classList.remove('fishing-page')
  }, [])

  useEffect(() => { localStorage.setItem(CATCH_KEY, JSON.stringify(caught)) }, [caught])

  const zones = useMemo(() => {
    const list = spots.filter((s) => exp === 'All' || s.expansion === exp).map((s) => s.zone)
    return ['All zones', ...Array.from(new Set(list))]
  }, [exp, spots])

  useEffect(() => { if (!zones.includes(zone)) setZone('All zones') }, [zones]) // eslint-disable-line

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return spots.filter((s) => {
      if (exp !== 'All' && s.expansion !== exp) return false
      if (zone !== 'All zones' && s.zone !== zone) return false
      if (query) {
        const hay = [s.name, s.zone, s.expansion, s.weather, s.time, ...s.baits.map((b) => b[0]), ...s.fish.map((f) => f.name)].join(' ').toLowerCase()
        if (!hay.includes(query)) return false
      }
      return true
    })
  }, [q, exp, zone, spots])

  const totalFish = spots.reduce((a, s) => a + s.fish.length, 0)
  const caughtCount = Object.values(caught).filter(Boolean).length

  const [view, setView] = useState('spots') // 'spots' | 'bait'

  // Deep-link from AI search (?highlight=<spot, zone, or fish name>): switch to
  // the spots view, find the matching spot, glow it gold for 3s. Cards are always
  // expanded, so the catch list shows immediately.
  useEffect(() => {
    const h = new URLSearchParams(window.location.search).get('highlight')
    if (!h) return
    const norm = (s) => String(s || '').trim().toLowerCase()
    const target = spots.find((s) =>
      norm(s.name) === norm(h) || norm(s.zone) === norm(h) || s.fish.some((f) => norm(f.name) === norm(h)))
    if (!target) return
    setView('spots')
    setHighlightId(target.id)
    const t = setTimeout(() => setHighlightId(null), 3000)
    return () => clearTimeout(t)
  }, [spots])

  const baitFiltered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return BAIT_TACKLE
    return BAIT_TACKLE.filter((b) =>
      (b.name + ' ' + (b.vendor ? `${b.vendor.npc} ${b.vendor.zone || ''}` : '')).toLowerCase().includes(query))
  }, [q])

  const showOcean = zone === 'All zones' && (() => {
    const query = q.trim().toLowerCase()
    if (!query) return true
    return ('ocean fishing ferry voyage boat ' + OCEAN_ROUTES.map((r) => r.name).join(' ')).toLowerCase().includes(query)
  })()

  function toggleFish(key) { setCaught((c) => ({ ...c, [key]: !c[key] })) }
  function toggleAll(spot, on) {
    setCaught((c) => {
      const next = { ...c }
      spot.fish.forEach((f) => { next[fishKey(spot.id, f.name)] = on })
      return next
    })
  }
  function copyCoords(text) {
    navigator.clipboard?.writeText(String(text).replace(/^~/, '')).catch(() => {})
    showToast(`Copied ${text}`)
  }
  function showToast(m) { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1500) }

  return (
    <div className="ledger">
      <ActivityNav />
      <header className="brand">
        <a href="/" className="brand__crest" title="Home" aria-label="Home"><I.hook /></a>
        <div>
          <h1 className="brand__title">FISHING LOG</h1>
          <div className="brand__sub">Centurio Ledger · {caughtCount}/{totalFish} logged</div>
        </div>
      </header>

      <EorzeaClock />

      <div className="controls">
        <div className="seg fish-tabs" role="group" aria-label="View">
          <button className={view === 'spots' ? 'is-active' : ''} onClick={() => setView('spots')}>Spots</button>
          <button className={view === 'bait' ? 'is-active' : ''} onClick={() => setView('bait')}>Bait &amp; Tackle</button>
        </div>

        <div className="search">
          <I.search className="search__icon" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={view === 'bait' ? 'Search bait, lures, vendors…' : 'Search spots, fish, bait…'} aria-label="Search" />
        </div>

        {view === 'spots' ? (
          <>
            <div className="seg" role="group" aria-label="Expansion">
              {EXPANSIONS.map((e) => (
                <button key={e.key} className={exp === e.key ? 'is-active' : ''} onClick={() => setExp(e.key)}>
                  <span className="dot" style={{ background: exp === e.key ? 'currentColor' : e.dot }} />{e.key}
                </button>
              ))}
            </div>
            <div className="zonebar">
              <div className="selwrap">
                <select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone">
                  {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
                <I.chevron />
              </div>
              <span className="zonebar__count"><b>{filtered.length}</b> spots</span>
            </div>
          </>
        ) : (
          <div className="zonebar"><span className="zonebar__count"><b>{baitFiltered.length}</b> bait &amp; tackle</span></div>
        )}
      </div>

      {view === 'bait' ? (
        <div className="bait-ref">
          {baitFiltered.map((b) => (
            <div className="bt-row" key={b.name}>
              <span className="bt-name"><I.hook />{b.name}</span>
              {b.vendor ? (
                <span className="bt-where">
                  <span className="bt-npc">{b.vendor.npc}{b.vendor.zone ? ` · ${b.vendor.zone}` : ''}</span>
                  {b.vendor.coords && (
                    <button className="bt-coords" title="Tap to copy" onClick={() => copyCoords(b.vendor.coords)}>
                      <I.copy />{b.vendor.coords}
                    </button>
                  )}
                  <span className="bt-price"><I.coin />{b.vendor.price}g</span>
                </span>
              ) : (
                <span className="bt-other">Gathered / other</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          {showOcean && <OceanFishing />}
          {filtered.length === 0 ? (
            showOcean ? null : (
              <div className="empty">
                <div className="empty__ico"><I.fish /></div>
                <h3>No spots found</h3>
                <p>Nothing matches your filters. Try a different zone or expansion.</p>
              </div>
            )
          ) : (
            <div className="spots">
              {filtered.map((s) => (
                <SpotCard key={s.id} spot={s} caught={caught} highlighted={s.id === highlightId} onToggleFish={toggleFish} onToggleAll={toggleAll} onCopy={copyCoords} />
              ))}
            </div>
          )}
        </>
      )}

      <div className={`toast${toast ? ' show' : ''}`}><I.copy />{toast}</div>
    </div>
  )
}
