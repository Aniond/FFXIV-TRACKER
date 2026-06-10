import { useState, useEffect, useMemo, useRef } from 'react'
import EorzeaClock from './EorzeaClock'
import ActivityNav from './ActivityNav'
import FavStar from './FavStar'
import { windowState, fmtDur } from './etWindow'
import { weatherWindow } from './eorzeaWeather'
import { MINING_NODES } from './miningData'
import { BOTANY_NODES } from './botanyData'
import { getFavNodes } from './favNodes'
import { hydrateFromServer, HYDRATED_EVENT } from './syncedState'
import './Timers.css'

/* ============================================================
   Timers — condensed gathering timer board.
   Route: /gathering/timers
   Every Unspoiled / Ephemeral / Legendary node across mining and
   botany as one clean countdown list: what's up right now, what
   opens next. No full cards — built to stay open while playing.
   ============================================================ */

const I = {
  pick: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 21 13 11"/><path d="M4 9c4-4 12-5 16-2-3-1-7 0-9 2 3-1 6 0 7 2-4-3-11-2-14-2Z"/><path d="m12.5 11.5 2 2"/></svg>,
  leaf: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>,
  copy: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>,
  star: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l2.6 6.2 6.4.5-4.9 4.1 1.5 6.2L12 16.9 6.4 20.2l1.5-6.2L3 9.7l6.4-.5L12 3Z"/></svg>,
  cloud: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 3.5 3.5 0 0 0 7 18Z"/></svg>,
  arrow: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 14 0M12 5l7 7-7 7"/></svg>,
}

// Every timed node, tagged with its source page.
const TIMED = [
  ...MINING_NODES.filter((n) => n.window).map((n) => ({ ...n, src: 'mining' })),
  ...BOTANY_NODES.filter((n) => n.window).map((n) => ({ ...n, src: 'botany' })),
]

const STATE_ORDER = { up: 0, soon: 1, closed: 2 }
const STATE_WORD = { up: 'Active', soon: 'Soon', closed: 'Closed' }

function TimerRow({ node, ws, starredOnlyHint }) {
  const SrcI = node.src === 'mining' ? I.pick : I.leaf
  const headline = node.items?.[0]?.name || node.name
  const extra = (node.items?.length || 0) - 1
  const href = `/gathering/${node.src}?highlight=${encodeURIComponent(headline)}`
  const copy = (e) => {
    e.preventDefault(); e.stopPropagation()
    navigator.clipboard?.writeText(node.coords).catch(() => {})
  }
  return (
    <a className={`trow is-${ws.state}`} href={href} title={`Open on the ${node.src} page`}>
      <span className={`trow__state is-${ws.state}`}><span className="trow__dot" />{STATE_WORD[ws.state]}</span>
      <span className="trow__main">
        <span className="trow__name">
          {headline}{extra > 0 && <span className="trow__extra">+{extra}</span>}
        </span>
        <span className="trow__meta">
          <SrcI className="trow__srcico" />
          {node.type} · {node.zone}
          <button className="trow__coords" onClick={copy} title="Tap to copy"><I.copy />{node.coords}</button>
        </span>
      </span>
      <span className="trow__cd">
        <span className="trow__cdv">{fmtDur(ws.ms)}</span>
        <span className="trow__cdl">{ws.pre}</span>
      </span>
      <span onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
        <FavStar id={node.id} title={starredOnlyHint ? 'Unstar to remove' : 'Pin to dashboard timers'} />
      </span>
      <I.arrow className="trow__go" />
    </a>
  )
}

export default function Timers() {
  const [, setTick] = useState(0)
  const [src, setSrc] = useState('All')
  const [starredOnly, setStarredOnly] = useState(false)
  const [favRev, setFavRev] = useState(0)
  const tickRef = useRef(null)

  useEffect(() => {
    document.body.classList.add('timers-page')
    return () => document.body.classList.remove('timers-page')
  }, [])

  // Everything on this page is a countdown — tick every second.
  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(tickRef.current)
  }, [])

  // Stars are account-synced; refresh when the server copy lands.
  useEffect(() => {
    hydrateFromServer()
    const onHydrated = () => setFavRev((n) => n + 1)
    window.addEventListener(HYDRATED_EVENT, onHydrated)
    return () => window.removeEventListener(HYDRATED_EVENT, onHydrated)
  }, [])

  const favSet = useMemo(() => new Set(getFavNodes()), [favRev])

  const rows = TIMED
    .filter((n) => src === 'All' || n.src === src.toLowerCase())
    .filter((n) => !starredOnly || favSet.has(n.id))
    .map((n) => ({ node: n, ws: windowState(n.window) }))
    .sort((a, b) => (STATE_ORDER[a.ws.state] - STATE_ORDER[b.ws.state]) || (a.ws.ms - b.ws.ms))

  const activeCount = rows.filter((r) => r.ws.state === 'up').length

  // Weather strip: zones of currently-active nodes (gatherers care what
  // they're flying into), deduped, max 4.
  const activeZones = [...new Set(rows.filter((r) => r.ws.state === 'up').map((r) => r.node.zone))].slice(0, 4)

  return (
    <div className="timers">
      <header className="timers__top">
        <div>
          <h1 className="timers__title">Gathering Timers</h1>
          <p className="timers__sub">{TIMED.length} timed nodes · <b className="timers__live">{activeCount} active now</b></p>
        </div>
        <EorzeaClock />
      </header>
      <ActivityNav />

      <div className="timers__filters">
        {['All', 'Mining', 'Botany'].map((s) => (
          <button key={s} className={`timers__chip${src === s ? ' is-active' : ''}`} onClick={() => setSrc(s)}>{s}</button>
        ))}
        <button className={`timers__chip timers__chip--star${starredOnly ? ' is-active' : ''}`}
          onClick={() => setStarredOnly((v) => !v)}>
          <I.star style={{ width: 12, height: 12 }} /> Starred
        </button>
      </div>

      {activeZones.length > 0 && (
        <div className="timers__weather">
          {activeZones.map((z) => {
            const w = weatherWindow(z)
            return w ? (
              <span key={z} className="timers__wchip" title={w.next ? `${w.next} in ${fmtDur(w.changeMs)}` : 'Weather holding'}>
                <I.cloud style={{ width: 12, height: 12 }} />{z}: <b>{w.now}</b>
                {w.next && <span className="timers__wnext">→ {w.next} {fmtDur(w.changeMs)}</span>}
              </span>
            ) : null
          })}
        </div>
      )}

      <div className="timers__list">
        {rows.map(({ node, ws }) => (
          <TimerRow key={node.id} node={node} ws={ws} starredOnlyHint={starredOnly} />
        ))}
        {!rows.length && (
          <div className="timers__empty">
            {starredOnly ? 'No starred timed nodes yet — star nodes on the Mining/Botany pages.' : 'No timed nodes match.'}
          </div>
        )}
      </div>
    </div>
  )
}
