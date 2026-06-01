import { useState, useEffect } from 'react'

/* ============================================================
   EorzeaClock — live FFXIV Eorzea time.
   1 Eorzea hour = 175 real seconds → multiplier 3600/175.
   Self-contained; reusable anywhere (fishing, weather, hunts).
   ============================================================ */

const ET_MULT = 3600 / 175

export function eorzeaNow() {
  const t = Math.floor((Date.now() / 1000) * ET_MULT)
  return { h: Math.floor(t / 3600) % 24, m: Math.floor(t / 60) % 60 }
}

const Sun = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>)
const Moon = (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 13.5A8 8 0 1 1 10.5 4a6.2 6.2 0 0 0 9.5 9.5Z"/></svg>)

export default function EorzeaClock() {
  const [et, setEt] = useState(eorzeaNow)
  useEffect(() => {
    const id = setInterval(() => setEt(eorzeaNow()), 1000)
    return () => clearInterval(id)
  }, [])

  const isDay = et.h >= 6 && et.h < 18
  const hh = String(et.h).padStart(2, '0')
  const mm = String(et.m).padStart(2, '0')
  const hAng = ((et.h % 12) + et.m / 60) * 30
  const mAng = et.m * 6

  return (
    <div className="eclock">
      <div className="eclock__dial">
        <div className="eclock__face" />
        <div className="eclock__hand eclock__hand--h" style={{ transform: `rotate(${hAng}deg)` }} />
        <div className="eclock__hand eclock__hand--m" style={{ transform: `rotate(${mAng}deg)` }} />
        <div className="eclock__pivot" />
      </div>
      <div className="eclock__body">
        <div className="eclock__lbl">Eorzea Time</div>
        <div className="eclock__time">{hh}:{mm}</div>
      </div>
      <div className={`eclock__period ${isDay ? 'is-day' : 'is-night'}`}>
        {isDay ? <Sun /> : <Moon />}{isDay ? 'Day' : 'Night'}
      </div>
    </div>
  )
}
