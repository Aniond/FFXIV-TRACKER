import { useMemo } from 'react'
import './Profile.css'

/* ============================================================
   Profile — Centurio Ledger public hunter profile
   Route: /profile/:name  (e.g. /profile/aniond)
   Full-bleed, mobile-first. Pass a `profile` object (see shape
   below + SAMPLE_PROFILE). In production, assemble it from the
   user's accumulated progress + XIVAPI (see README).
   ============================================================ */

/* ---------- icons ---------- */
const I = {
  crest: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...p}><path d="M12 2 4 5v6c0 5 3.4 8.3 8 11 4.6-2.7 8-6 8-11V5l-8-3Z"/><path d="M12 7v8M8.5 10.5 12 7l3.5 3.5"/></svg>),
  share: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/></svg>),
  coin: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><path d="M12 9.2v5.6M10.4 10.4h2.4a1.2 1.2 0 0 1 0 2.4h-1.6a1.2 1.2 0 0 0 0 2.4h2.4" strokeWidth="1.4"/></svg>),
  sack: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" {...p}><path d="M9 6h6l-1.2 2.2c3 1.1 5.2 3.9 5.2 7.3 0 1.6-1.3 2.5-3 2.5H8c-1.7 0-3-.9-3-2.5 0-3.4 2.2-6.2 5.2-7.3L9 6Z"/><path d="M8.5 6 8 4h8l-.5 2"/></svg>),
  spark: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/></svg>),
  trophy: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 4h10v4a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 17h6M10 17l-.5 3h5l-.5-3"/></svg>),
  map: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>),
  swords: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14.5 4H20v5.5L8.5 21 3 15.5 14.5 4ZM4 4h5.5L21 15.5 15.5 21"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>),
  banner: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 3h12v15l-6-3-6 3V3Z"/></svg>),
  world: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>),
}

const fmt = (n) => Number(n || 0).toLocaleString('en-US')
const fmtExp = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : fmt(n))

/* ---------- Hunter rank progression (by lifetime marks cleared) ---------- */
export const HUNTER_TIERS = [
  { name: 'Wandering Hunter', at: 0 },
  { name: 'Sworn Hunter', at: 25 },
  { name: 'Veteran Hunter', at: 75 },
  { name: 'Elite Hunter', at: 150 },
  { name: 'Centurio', at: 300 },
]
export function hunterRank(cleared) {
  let idx = 0
  for (let i = 0; i < HUNTER_TIERS.length; i++) if (cleared >= HUNTER_TIERS[i].at) idx = i
  const cur = HUNTER_TIERS[idx]
  const next = HUNTER_TIERS[idx + 1] || null
  const pct = next ? Math.round(((cleared - cur.at) / (next.at - cur.at)) * 100) : 100
  return { idx, cur, next, pct }
}

const RANK_VARS = {
  S: { '--rc': 'var(--rank-s)', '--rg': 'var(--rank-s-glow)' },
  A: { '--rc': 'var(--rank-a)', '--rg': 'var(--rank-a-glow)' },
  B: { '--rc': 'var(--rank-b)', '--rg': 'var(--rank-b-glow)' },
}

function Ring({ pct, size = 40, stroke = 4, color = 'var(--gold)' }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c - (pct / 100) * c
  return (
    <svg width={size} height={size} className="ring" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" className="ring__txt">{pct}</text>
    </svg>
  )
}

function Panel({ title, icon: Ico, count, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <h3 className="panel__title">{Ico && <Ico />}{title}{count != null && <span className="ct">{count}</span>}</h3>
      {children}
    </section>
  )
}

export default function Profile({ profile = SAMPLE_PROFILE }) {
  const p = profile

  const totals = useMemo(() => {
    const done = p.byRank.S.done + p.byRank.A.done + p.byRank.B.done
    const total = p.byRank.S.total + p.byRank.A.total + p.byRank.B.total
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [p])
  const hr = hunterRank(totals.done)

  function share() {
    const url = typeof window !== 'undefined' ? window.location.href : `https://ffxivlog.com/profile/${p.slug || ''}`
    if (navigator.share) navigator.share({ title: `${p.name} · Centurio Ledger`, url }).catch(() => {})
    else navigator.clipboard?.writeText(url).catch(() => {})
  }

  return (
    <div className="wrap">
      <header className="topbar">
        <a className="brandmini" href="/">
          <span className="brandmini__crest"><I.crest /></span>
          <span>
            <span className="brandmini__name">CENTURIO LEDGER</span>
            <span className="brandmini__sub" style={{ display: 'block' }}>Hunt Board</span>
          </span>
        </a>
        <div className="topbar__actions">
          <span className="pubtag"><i />Public</span>
          <button className="sharebtn" onClick={share}><I.share />Share</button>
        </div>
      </header>

      {/* Hero */}
      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="hero">
          <div className="portrait-frame">
            {p.portrait
              ? <img className="portrait-img" src={p.portrait} alt={`${p.name} portrait`} loading="eager" />
              : <div className="portrait-img portrait-img--empty" aria-hidden="true" />}
            <span className="hero__rankpin">{hr.cur.name}</span>
          </div>
          <div className="hero__body">
            <h1 className="hero__name">{p.name}</h1>
            {p.title && <div className="hero__title">“{p.title}”</div>}
            <div className="hero__meta">
              <span className="metachip"><I.world /><b>{p.world}</b>{p.dc ? ` · ${p.dc}` : ''}</span>
              {p.gc && <span className="metachip"><I.banner className="gc-crest" /><b>{p.gc.name}</b> · {p.gc.rank}</span>}
              <span className="metachip"><I.check style={{ color: 'var(--gold)' }} /><b>{totals.done}</b> marks cleared</span>
            </div>
          </div>
        </div>

        <div className="hunter">
          <div className="hunter__head">
            <span className="hunter__now">{hr.cur.name}</span>
            {hr.next
              ? <span className="hunter__next"><b>{hr.next.at - totals.done}</b> marks to <b>{hr.next.name}</b></span>
              : <span className="hunter__next">Highest rank attained</span>}
          </div>
          <div className="hunter__bar"><span style={{ width: hr.pct + '%' }} /></div>
          <div className="ladder">
            {HUNTER_TIERS.map((t, i) => (
              <div key={t.name} className={`ladder__node${i < hr.idx ? ' done' : ''}${i === hr.idx ? ' now' : ''}`}>
                <span className="ladder__dot" />
                <span className="ladder__lbl">{t.name.replace(' Hunter', '')}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stat band */}
      <div className="statband">
        <div className="stat"><span className="stat__ico"><I.coin /></span><span className="stat__val">{fmt(p.gil)}</span><span className="stat__lbl">Gil Earned</span></div>
        <div className="stat"><span className="stat__ico"><I.sack /></span><span className="stat__val">{fmt(p.nuts)}</span><span className="stat__lbl">Sacks of Nuts</span></div>
        <div className="stat"><span className="stat__ico"><I.spark /></span><span className="stat__val">{fmtExp(p.exp)}</span><span className="stat__lbl">EXP Gained</span></div>
        <div className="stat stat--ring"><Ring pct={totals.pct} size={52} stroke={5} /><span className="stat__lbl" style={{ marginTop: 6 }}>Completion</span></div>
      </div>

      <div className="grid">
        {/* Bounty by rank */}
        <Panel title="Bounty by Rank" icon={I.trophy}>
          {['S', 'A', 'B'].map((rk) => {
            const d = p.byRank[rk], pct = d.total ? Math.round((d.done / d.total) * 100) : 0
            return (
              <div className="rankrow" key={rk} style={RANK_VARS[rk]}>
                <div className="rankrow__seal">{rk}</div>
                <div>
                  <div className="rankrow__head">
                    <span><span className="rankrow__word">{d.word}</span> <span className="rankrow__sub">· {d.sub}</span></span>
                    <span className="rankrow__count">{d.done}/{d.total}</span>
                  </div>
                  <div className="bar"><span style={{ width: pct + '%' }} /></div>
                </div>
                <div className="rankrow__pct">{pct}%</div>
              </div>
            )
          })}
        </Panel>

        {/* Territory */}
        <Panel title="Territory" icon={I.map}
          count={`${p.zones.reduce((a, z) => a + z.done, 0)}/${p.zones.reduce((a, z) => a + z.total, 0)}`}>
          <div className="zones">
            {p.zones.map((z) => {
              const pct = z.total ? Math.round((z.done / z.total) * 100) : 0
              return (
                <div className="zone" key={z.name}>
                  <span className="zone__fill" style={{ width: pct + '%' }} />
                  <span className="zone__ring"><Ring pct={pct} size={40} stroke={4} color={pct === 100 ? 'var(--rank-b)' : 'var(--gold)'} /></span>
                  <span className="zone__body">
                    <span className="zone__name">{z.name}</span>
                    <span className="zone__count">{z.done} / {z.total} marks</span>
                  </span>
                </div>
              )
            })}
          </div>
        </Panel>

        {/* Job levels */}
        <Panel title="Job Levels" icon={I.swords} className="col-span"
          count={`${p.roles.reduce((a, r) => a + r.jobs.filter((j) => j[1] === 100).length, 0)} at 100`}>
          {p.roles.map((role) => (
            <div className="rolegroup" key={role.key} style={{ '--rcol': role.color }}>
              <div className="rolegroup__head">
                <span className="rolegroup__dot" />
                <span className="rolegroup__name">{role.name}</span>
                <span className="rolegroup__line" />
              </div>
              <div className="jobs">
                {role.jobs.map(([abbr, lvl]) => (
                  <div className={`job${lvl === 100 ? ' max' : ''}`} key={abbr}>
                    <span className="job__ring"><span className="job__abbr">{abbr}</span></span>
                    <span className="job__lvl"><small>Lv</small>{lvl}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Panel>

        {/* Recent clears */}
        <Panel title="Recent Clears" icon={I.check} className="col-span">
          {p.recent.map((c, i) => (
            <div className="clear" key={i} style={RANK_VARS[c.rank]}>
              <span className="clear__seal">{c.rank}</span>
              <span className="clear__body">
                <span className="clear__name">{c.name}</span>
                <span className="clear__zone">{c.zone}</span>
              </span>
              <span className="clear__time">{c.time}</span>
            </div>
          ))}
        </Panel>
      </div>

      <footer className="foot">
        <div className="foot__url">ffxivlog.com/profile/{p.slug || ''}</div>
        <div className="foot__note">Centurio Ledger · Hunt Tracker &amp; Field Ledger</div>
      </footer>
    </div>
  )
}

/* ============================================================
   SAMPLE_PROFILE — dev fallback + canonical shape reference.
   ============================================================ */
export const SAMPLE_PROFILE = {
  slug: 'aniond',
  name: 'Aniond',
  title: 'Warrior of Light',
  world: 'Gilgamesh',
  dc: 'Aether',
  portrait: null, // XIVAPI portrait URL in production
  gc: { name: 'Maelstrom', rank: 'Storm Captain' },
  gil: 153000,
  nuts: 1558,
  exp: 49061376,
  byRank: {
    S: { done: 8, total: 12, word: 'Elite', sub: 'Notorious Monster' },
    A: { done: 34, total: 40, word: 'Notorious', sub: 'Clan Mark' },
    B: { done: 62, total: 70, word: 'Wanted', sub: 'Bounty Bill' },
  },
  zones: [
    { name: 'Urqopacha', done: 18, total: 22 },
    { name: "Kozama'uka", done: 20, total: 22 },
    { name: "Yak T'el", done: 24, total: 24 },
    { name: 'Shaaloani', done: 16, total: 20 },
    { name: 'Heritage Found', done: 14, total: 18 },
    { name: 'Living Memory', done: 12, total: 16 },
  ],
  roles: [
    { key: 'tank', name: 'Tank', color: 'var(--role-tank)', jobs: [['PLD', 100], ['WAR', 90], ['DRK', 100], ['GNB', 82]] },
    { key: 'heal', name: 'Healer', color: 'var(--role-heal)', jobs: [['WHM', 100], ['SCH', 100], ['AST', 74], ['SGE', 90]] },
    { key: 'melee', name: 'Melee DPS', color: 'var(--role-melee)', jobs: [['MNK', 88], ['DRG', 100], ['NIN', 70], ['SAM', 100], ['RPR', 90], ['VPR', 100]] },
    { key: 'pranged', name: 'Physical Ranged', color: 'var(--role-pranged)', jobs: [['BRD', 100], ['MCH', 85], ['DNC', 100]] },
    { key: 'mranged', name: 'Magical Ranged', color: 'var(--role-mranged)', jobs: [['BLM', 100], ['SMN', 92], ['RDM', 100], ['PCT', 100]] },
  ],
  recent: [
    { name: 'Chupacabra', rank: 'S', zone: 'Urqopacha', time: '2h ago' },
    { name: "Yak T'el Squib", rank: 'A', zone: "Yak T'el", time: '6h ago' },
    { name: 'Hammerhead Crocodile', rank: 'A', zone: "Kozama'uka", time: 'Yesterday' },
    { name: 'Mourner', rank: 'B', zone: "Yak T'el", time: 'Yesterday' },
    { name: 'Matchlock Scorpion', rank: 'A', zone: 'Living Memory', time: '2 days ago' },
  ],
}
