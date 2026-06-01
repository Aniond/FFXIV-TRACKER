import { useState, useEffect } from 'react'

/* ============================================================
   OceanFishing — the timed ferry voyage card.

   REAL cadence (accurate against the player's local clock):
     • Voyages depart every 2 hours, on the even hour.
     • Registration opens 15 minutes before each departure.

   ROUTE ROTATION: the in-game route + time-of-day follow a fixed
   long sequence tied to a known epoch. This component ships with a
   representative rotation computed deterministically from the
   departure timestamp. To make route names exact, replace
   `routeFor(ts)` with a lookup against the real sequence (see
   README → "Exact route rotation").
   ============================================================ */

const TWO_H = 2 * 3600 * 1000
const REG_LEAD = 15 * 60 * 1000

export const OCEAN_ROUTES = [
  { name: 'Galadion Bay', tod: 'Day' },
  { name: 'Southern Strait of Merlthor', tod: 'Sunset' },
  { name: 'Northern Strait of Merlthor', tod: 'Night' },
  { name: 'Rhotano Sea', tod: 'Day' },
  { name: 'The Cieldalaes', tod: 'Sunset' },
  { name: 'The Bloodbrine Sea', tod: 'Night' },
  { name: 'The Rothlyt Sound', tod: 'Day' },
]

/* Override this to plug in the real rotation table. */
export function routeFor(ts) {
  return OCEAN_ROUTES[Math.floor(ts / TWO_H) % OCEAN_ROUTES.length]
}

export function nextDepartures(count) {
  const d = new Date(); d.setMinutes(0, 0, 0)
  while (d.getHours() % 2 !== 0 || d.getTime() <= Date.now()) d.setHours(d.getHours() + 1)
  const out = []; let t = d.getTime()
  for (let i = 0; i < count; i++) { out.push(t); t += TWO_H }
  return out
}

function fmtDur(ms) {
  if (ms < 0) ms = 0
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`
}
const fmtLocal = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const Ico = {
  ship: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 14h18l-2.2 5.2a2 2 0 0 1-1.8 1.3H7a2 2 0 0 1-1.8-1.3L3 14Z"/><path d="M6 14V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7M12 3v3M9 10h6"/></svg>),
  anchor: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="5" r="2"/><path d="M12 7v13M5 13a7 7 0 0 0 14 0M5 13H3m16 0h2"/></svg>),
  clock: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  sun: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>),
  sunset: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 4v3M5 9l1.6 1.6M19 9l-1.6 1.6M2 18h20M5.5 18a6.5 6.5 0 0 1 13 0"/></svg>),
  moon: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 13.5A8 8 0 1 1 10.5 4a6.2 6.2 0 0 0 9.5 9.5Z"/></svg>),
}
const TOD_ICON = { Day: Ico.sun, Sunset: Ico.sunset, Night: Ico.moon }

export default function OceanFishing() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const deps = nextDepartures(5)
  const next = deps[0]
  const msToNext = next - now
  const regOpen = msToNext <= REG_LEAD
  const route = routeFor(next)
  const NextTod = TOD_ICON[route.tod]

  return (
    <div className="ocean">
      <div className="ocean__waves" aria-hidden="true" />
      <div className="ocean__head">
        <span className="ocean__crest"><Ico.ship /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="ocean__title">Ocean Fishing</h2>
          <div className="ocean__sub"><Ico.anchor style={{ width: 12, height: 12 }} />Ferry · Limsa Lominsa Lower Decks</div>
        </div>
      </div>

      <div className="ocean__timer">
        <div className="ocean__timer-lbl">{regOpen ? 'Boarding closes in' : 'Next voyage departs in'}</div>
        <div className="ocean__time">{fmtDur(msToNext)}</div>
      </div>

      <div className={`ocean__status${regOpen ? ' open' : ''}`}>
        {regOpen
          ? <><Ico.anchor />Registration open — board now!</>
          : <><Ico.clock />Registration opens in {fmtDur(msToNext - REG_LEAD)}</>}
      </div>

      <div className="ocean__next">
        <span className="ocean__next-time">{fmtLocal(next)}</span>
        <span className="ocean__next-route">{route.name}</span>
        <span className={`tod tod--${route.tod.toLowerCase()}`}><NextTod />{route.tod}</span>
      </div>

      <div className="field-lbl" style={{ margin: '13px 0 7px' }}>Upcoming Schedule</div>
      <div className="sched">
        {deps.map((ts, i) => {
          const r = routeFor(ts)
          const Tod = TOD_ICON[r.tod]
          return (
            <div className={`sched__row${i === 0 ? ' is-next' : ''}`} key={ts}>
              <span className="sched__time">{fmtLocal(ts)}</span>
              <span className="sched__route">{r.name}</span>
              <span className={`tod tod--${r.tod.toLowerCase()}`}><Tod />{r.tod}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
