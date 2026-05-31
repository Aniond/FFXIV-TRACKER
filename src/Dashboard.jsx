import { useState, useMemo, useEffect } from 'react'
import { Icon, rankVars } from './components'
import { saveStash } from './api'
import './Dashboard.css'

/* ============================================================
   Dashboard — Centurio Ledger "Overview" startup page
   ============================================================ */

const NUTS_KEY = 'ffxiv-nuts-stash'
const RANK_WORD = { S: 'Elite', A: 'Notorious', B: 'Wanted' }
const fmt = (n) => Number(n || 0).toLocaleString('en-US')

/* ---- Reward parsing: "1,000 Gil · 4 Sacks of Nuts · 471,744 EXP" ---- */
export function parseReward(str) {
  const s = String(str || '')
  const num = (re) => { const m = re.exec(s); return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0 }
  return {
    gil:  num(/([\d,]+)\s*Gil/i),
    nuts: num(/([\d,]+)\s*Sacks?\s*of\s*Nuts/i),
    exp:  num(/([\d,]+)\s*EXP/i),
  }
}

export function computeStats(hunts, doneMap) {
  const blankRank = () => ({ done: 0, total: 0, gil: 0 })
  const byRank = { S: blankRank(), A: blankRank(), B: blankRank() }
  const byZone = {}
  let gil = 0, nuts = 0, exp = 0, cleared = 0
  const clears = []

  hunts.forEach((h) => {
    const r = parseReward(h.reward)
    if (!byRank[h.rank]) byRank[h.rank] = blankRank()
    byRank[h.rank].total++
    const z = (byZone[h.zone] = byZone[h.zone] || { done: 0, total: 0, gil: 0 })
    z.total++
    if (doneMap[h.id]) {
      cleared++; gil += r.gil; nuts += r.nuts; exp += r.exp
      byRank[h.rank].done++; byRank[h.rank].gil += r.gil
      z.done++; z.gil += r.gil
      clears.push({ ...h, _gil: r.gil })
    }
  })

  const zones = Object.entries(byZone)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => (b.done / b.total) - (a.done / a.total) || b.total - a.total)

  return {
    gil, nuts, exp, cleared,
    total: hunts.length,
    pct: hunts.length ? Math.round((cleared / hunts.length) * 100) : 0,
    byRank, zones, clears: clears.reverse(),
  }
}

/* ---- Dashboard-only icons (exported so App.jsx can use trophy in nav) ---- */
export const DIcon = {
  coin: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5.5" />
      <path d="M12 9.2v5.6M10.4 10.4h2.4a1.2 1.2 0 0 1 0 2.4h-1.6a1.2 1.2 0 0 0 0 2.4h2.4" strokeWidth="1.4" />
    </svg>
  ),
  sack: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" {...p}>
      <path d="M9 6h6l-1.2 2.2c3 1.1 5.2 3.9 5.2 7.3 0 1.6-1.3 2.5-3 2.5H8c-1.7 0-3-.9-3-2.5 0-3.4 2.2-6.2 5.2-7.3L9 6Z" />
      <path d="M8.5 6 8 4h8l-.5 2" />
    </svg>
  ),
  spark: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
    </svg>
  ),
  trophy: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 17h6M10 17l-.5 3h5l-.5-3" />
    </svg>
  ),
  arrow: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  pencil: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 5.5 18.5 10 8 20.5 3.5 21l.5-4.5L14 5.5ZM13 7l4 4" />
    </svg>
  ),
}

function Ring({ pct, size = 52, stroke = 5 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (pct / 100) * c
  return (
    <svg width={size} height={size} className="ring">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--gold)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off}
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" className="ring__txt">{pct}%</text>
    </svg>
  )
}

export default function Dashboard({ hunts, doneMap, user, onOpenBoard }) {
  const s = useMemo(() => computeStats(hunts, doneMap), [hunts, doneMap])
  const ranks = ['S', 'A', 'B'].filter((r) => s.byRank[r] && s.byRank[r].total)

  const [nutsBase, setNutsBase] = useState(() => {
    const v = parseInt(localStorage.getItem(NUTS_KEY), 10)
    return Number.isNaN(v) ? 0 : v
  })
  const [editingNuts, setEditingNuts] = useState(false)
  const [draft, setDraft] = useState('')
  const nutsTotal = nutsBase + s.nuts

  // Seed from backend when user loads (overrides localStorage)
  useEffect(() => {
    if (user?.nuts_stash != null) setNutsBase(user.nuts_stash)
  }, [user])

  function openNutsEdit() { setDraft(String(nutsBase)); setEditingNuts(true) }
  function saveNuts() {
    const v = parseInt(draft, 10)
    const clean = Number.isNaN(v) ? 0 : Math.max(0, v)
    setNutsBase(clean)
    localStorage.setItem(NUTS_KEY, String(clean))
    if (user) saveStash(clean).catch(() => {})
    setEditingNuts(false)
  }

  return (
    <div className="dash">
      <div className="dash__hello">
        <span className="dash__hello-eyebrow">Hunter's Record</span>
        <h2 className="dash__hello-name">{user ? user.username : 'Wandering Hunter'}</h2>
      </div>

      {/* Hero — total Gil */}
      <div className="gil-hero">
        <div className="gil-hero__ico"><DIcon.coin /></div>
        <div className="gil-hero__body">
          <div className="gil-hero__label">Total Gil Earned</div>
          <div className="gil-hero__value">{fmt(s.gil)}</div>
          <div className="gil-hero__sub">from {s.cleared} cleared {s.cleared === 1 ? 'bounty' : 'bounties'}</div>
        </div>
      </div>

      {/* Editable Sacks of Nuts balance */}
      <div className={`nuts-card${editingNuts ? ' is-editing' : ''}`}>
        <div className="nuts-card__ico"><DIcon.sack /></div>
        {!editingNuts ? (
          <>
            <div className="nuts-card__main">
              <div className="nuts-card__label">Total Sacks of Nuts</div>
              <div className="nuts-card__total">{fmt(nutsTotal)}</div>
              <div className="nuts-card__break">
                <span className="nuts-chip">Stash {fmt(nutsBase)}</span>
                <span className="nuts-plus">+</span>
                <span className="nuts-chip nuts-chip--earn">{fmt(s.nuts)} earned</span>
              </div>
            </div>
            <button className="nuts-card__edit" onClick={openNutsEdit} aria-label="Edit your stash">
              <DIcon.pencil />
            </button>
          </>
        ) : (
          <form className="nuts-edit" onSubmit={(e) => { e.preventDefault(); saveNuts() }}>
            <label className="nuts-edit__label">Your current Sacks of Nuts</label>
            <div className="nuts-edit__row">
              <input
                className="nuts-edit__input"
                type="number" min="0" inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="0"
                autoFocus
              />
              <button type="submit" className="nuts-edit__save">Save</button>
              <button type="button" className="nuts-edit__cancel" onClick={() => setEditingNuts(false)}>Cancel</button>
            </div>
            <div className="nuts-edit__hint">+ {fmt(s.nuts)} earned from {s.cleared} cleared {s.cleared === 1 ? 'hunt' : 'hunts'} will be added on top.</div>
          </form>
        )}
      </div>

      {/* Stat grid */}
      <div className="stat-grid stat-grid--3">
        <div className="stat-tile">
          <div className="stat-tile__top"><Icon.crest className="stat-tile__ico" /></div>
          <div className="stat-tile__value">{s.cleared}<span className="stat-tile__of">/{s.total}</span></div>
          <div className="stat-tile__label">Hunts Cleared</div>
        </div>
        <div className="stat-tile">
          <Ring pct={s.pct} />
          <div className="stat-tile__label" style={{ marginTop: 6 }}>Completion</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__top"><DIcon.spark className="stat-tile__ico" /></div>
          <div className="stat-tile__value">{s.exp >= 1e6 ? (s.exp / 1e6).toFixed(1) + 'M' : fmt(s.exp)}</div>
          <div className="stat-tile__label">EXP Gained</div>
        </div>
      </div>

      {/* By rank */}
      <section className="dash-section">
        <h3 className="dash-section__title"><DIcon.trophy /> Bounty by Rank</h3>
        <div className="rank-rows">
          {ranks.map((r) => {
            const d = s.byRank[r]
            const pct = d.total ? Math.round((d.done / d.total) * 100) : 0
            return (
              <div className="rank-row" key={r} style={rankVars(r)}>
                <div className="rank-row__seal">{r}</div>
                <div className="rank-row__main">
                  <div className="rank-row__head">
                    <span className="rank-row__word">{RANK_WORD[r]}</span>
                    <span className="rank-row__count">{d.done}/{d.total}</span>
                  </div>
                  <div className="bar"><span style={{ width: pct + '%' }} /></div>
                </div>
                <div className="rank-row__gil">{fmt(d.gil)}<small>gil</small></div>
              </div>
            )
          })}
        </div>
      </section>

      {/* By zone */}
      <section className="dash-section">
        <h3 className="dash-section__title"><Icon.target /> Territory Progress</h3>
        <div className="zone-rows">
          {s.zones.map((z) => {
            const pct = z.total ? Math.round((z.done / z.total) * 100) : 0
            return (
              <div className="zone-row" key={z.name}>
                <div className="zone-row__head">
                  <span className="zone-row__name">{z.name}</span>
                  <span className="zone-row__count">{z.done}/{z.total}</span>
                </div>
                <div className="bar bar--gold"><span style={{ width: pct + '%' }} /></div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Recent clears */}
      {s.clears.length > 0 && (
        <section className="dash-section">
          <h3 className="dash-section__title"><Icon.check /> Cleared Bounties</h3>
          <div className="clear-list">
            {s.clears.slice(0, 6).map((h) => (
              <div className="clear-item" key={h.id} style={rankVars(h.rank)}>
                <span className="clear-item__seal">{h.rank}</span>
                <div className="clear-item__body">
                  <div className="clear-item__name">{h.name}</div>
                  <div className="clear-item__zone">{h.zone}</div>
                </div>
                <div className="clear-item__gil">+{fmt(h._gil)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <button className="dash-cta" onClick={onOpenBoard}>
        Open the Hunt Board <DIcon.arrow />
      </button>
    </div>
  )
}
