import { useState, useEffect, useRef } from 'react'

const Icon = {
  search: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
    </svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  copy: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  ),
  chevron: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  cards: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" />
    </svg>
  ),
  table: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M3 5h18M3 10h18M3 15h18M3 20h18" />
    </svg>
  ),
  crest: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...p}>
      <path d="M12 2 4 5v6c0 5 3.4 8.3 8 11 4.6-2.7 8-6 8-11V5l-8-3Z" />
      <path d="M12 7v8M8.5 10.5 12 7l3.5 3.5" />
    </svg>
  ),
  fate: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M12 7l1.6 3.4L17 12l-3.4 1.6L12 17l-1.6-3.4L7 12l3.4-1.6Z" />
    </svg>
  ),
  gather: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22V12M12 12C9 12 7 9 8 5c3 0 4 3 4 7ZM12 12c3 0 5-3 4-7-3 0-4 3-4 7Z" />
    </svg>
  ),
  craft: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m14 7 3 3M5 19l8.5-8.5M14.5 5.5 18.5 9.5 21 7l-4-4ZM5 19l-2 2M5 19l2 2" />
    </svg>
  ),
  treasure: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="8" width="18" height="12" rx="2" /><path d="M3 12h18M12 8v12M9 8a3 3 0 0 1 6 0" />
    </svg>
  ),
  target: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...p}>
      <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" />
    </svg>
  ),
  discord: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.022.015.04.032.05a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  ),
}

const RANK_GLOW = { S: 'var(--rank-s-glow)', A: 'var(--rank-a-glow)', B: 'var(--rank-b-glow)' }
const RANK_COLOR = { S: 'var(--rank-s)', A: 'var(--rank-a)', B: 'var(--rank-b)' }
const RANK_WORD = { S: 'Elite', A: 'Notorious', B: 'Wanted' }

function rankVars(rank) {
  return {
    '--rank-color': RANK_COLOR[rank] || 'var(--gold-dim)',
    '--rank-glow': RANK_GLOW[rank] || 'transparent',
  }
}

function Highlight({ text, q }) {
  const s = String(text ?? '')
  if (!q) return s
  const i = s.toLowerCase().indexOf(q.toLowerCase())
  if (i === -1) return s
  return (
    <>
      {s.slice(0, i)}
      <mark>{s.slice(i, i + q.length)}</mark>
      {s.slice(i + q.length)}
    </>
  )
}

function RankSeal({ rank }) {
  return (
    <div className="seal" style={rankVars(rank)}>
      <div className="seal__ring" />
      <span className="seal__letter">{rank}</span>
      <span className="seal__rank-label">{RANK_WORD[rank] || 'Mark'}</span>
    </div>
  )
}

function BillCard({ hunt, done, onToggle, onCopy, q, highlighted }) {
  const [open, setOpen] = useState(false)
  const hasTips = hunt.tips && hunt.tips.length > 0
  const ref = useRef(null)
  // Deep-link from Centurio AI (/?hunt=): scroll the matched mark into view.
  useEffect(() => {
    if (highlighted && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlighted])
  return (
    <article ref={ref} className={`bill${done ? ' is-done' : ''}${highlighted ? ' is-highlight' : ''}`} style={rankVars(hunt.rank)}>
      <RankSeal rank={hunt.rank} />

      <div className="bill__body">
        <div className="bill__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="bill__name"><Highlight text={hunt.name} q={q} /></h2>
            <div className="bill__type">
              {hunt.type} · Bill <b>{hunt.billNumber}</b>
            </div>
          </div>
          <button
            className={`stamp-btn${done ? ' is-done' : ''}`}
            onClick={onToggle}
            aria-pressed={done}
            title={done ? 'Mark as open' : 'Mark as cleared'}
          >
            <Icon.check />
          </button>
        </div>

        <dl className="bill__meta">
          <div className="field field--wide">
            <dt>Zone</dt>
            <dd>
              <b><Highlight text={hunt.zone} q={q} /></b> — <Highlight text={hunt.area} q={q} />
            </dd>
          </div>
          <div className="field">
            <dt>Coordinates</dt>
            <dd>
              <span className="coords" onClick={() => onCopy(hunt.coords)} title="Tap to copy">
                <Icon.copy /> {hunt.coords}
              </span>
              {hunt.coordsNote && <span className="coords__note">{hunt.coordsNote}</span>}
            </dd>
          </div>
          <div className="field">
            <dt>Targets</dt>
            <dd>
              <span className="targets-pill">
                <span className="dots">
                  {Array.from({ length: Math.min(hunt.targets || 1, 5) }).map((_, i) => <i key={i} />)}
                </span>
                {hunt.targets} to clear
              </span>
            </dd>
          </div>
          <div className="field field--wide">
            <dt>Reward</dt>
            <dd>{hunt.reward}</dd>
          </div>
        </dl>

        {hasTips && (
          <>
            <button className={`tips-toggle${open ? ' is-open' : ''}`} onClick={() => setOpen(o => !o)}>
              <span>{open ? 'Hide field notes' : `Field notes (${hunt.tips.length})`}</span>
              <Icon.chevron />
            </button>
            {open && (
              <ul className="tips">
                {hunt.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            )}
          </>
        )}
      </div>

      {done && <span className="cleared-stamp">Cleared</span>}
    </article>
  )
}

function HuntTable({ hunts, doneMap, onToggle, onCopy, q, highlightId }) {
  const rowRef = useRef(null)
  // Deep-link from Centurio AI (/?hunt=): scroll the matched row into view.
  useEffect(() => {
    if (highlightId && rowRef.current) rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId])
  return (
    <div className="table-wrap">
      <table className="htable">
        <thead>
          <tr>
            <th></th><th>Mark</th><th>Zone</th><th>Coords</th><th style={{ textAlign: 'center' }}>✓</th>
          </tr>
        </thead>
        <tbody>
          {hunts.map((h) => {
            const done = !!doneMap[h.id]
            const isHl = h.id === highlightId
            return (
              <tr key={h.id} ref={isHl ? rowRef : null}
                className={`${done ? 'is-done' : ''}${isHl ? ' is-highlight' : ''}`} style={rankVars(h.rank)}>
                <td><div className="t-rank">{h.rank}</div></td>
                <td>
                  <div className="t-name"><Highlight text={h.name} q={q} /></div>
                  <div className="t-sub">{h.type}</div>
                </td>
                <td className="t-zone"><Highlight text={h.zone} q={q} /></td>
                <td className="t-coords">
                  <span className="coords" onClick={() => onCopy(h.coords)} style={{ padding: '2px 6px', fontSize: 11 }}>
                    <Icon.copy /> {h.coords}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button className={`t-check${done ? ' is-done' : ''}`} onClick={() => onToggle(h.id)}>
                    <Icon.check />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export { Icon, RankSeal, BillCard, HuntTable, Highlight, rankVars, RANK_COLOR }
