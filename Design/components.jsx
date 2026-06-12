/* ============================================================
   components.jsx — presentational pieces for Centurio Ledger
   Exports to window at the bottom.
   ============================================================ */

/* ---------- Inline icons (no external deps) ---------- */
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
};

const RANK_GLOW = { S: 'var(--rank-s-glow)', A: 'var(--rank-a-glow)', B: 'var(--rank-b-glow)' };
const RANK_COLOR = { S: 'var(--rank-s)', A: 'var(--rank-a)', B: 'var(--rank-b)' };
const RANK_WORD = { S: 'Elite', A: 'Notorious', B: 'Wanted' };

function rankVars(rank) {
  return {
    '--rank-color': RANK_COLOR[rank] || 'var(--gold-dim)',
    '--rank-glow': RANK_GLOW[rank] || 'transparent',
  };
}

/* ---------- highlight matched query in text ---------- */
function Highlight({ text, q }) {
  const s = String(text ?? '');
  if (!q) return s;
  const i = s.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return s;
  return (
    <>
      {s.slice(0, i)}
      <mark>{s.slice(i, i + q.length)}</mark>
      {s.slice(i + q.length)}
    </>
  );
}

/* ---------- Rank seal ---------- */
function RankSeal({ rank }) {
  return (
    <div className="seal" style={rankVars(rank)}>
      <div className="seal__ring" />
      <span className="seal__letter">{rank}</span>
      <span className="seal__rank-label">{RANK_WORD[rank] || 'Mark'}</span>
    </div>
  );
}

/* ---------- Bill card ---------- */
function BillCard({ hunt, done, onToggle, onCopy, q }) {
  const [open, setOpen] = React.useState(false);
  const hasTips = hunt.tips && hunt.tips.length > 0;
  return (
    <article className={`bill${done ? ' is-done' : ''}`} style={rankVars(hunt.rank)}>
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
  );
}

/* ---------- Table view ---------- */
function HuntTable({ hunts, doneMap, onToggle, onCopy, q }) {
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
            const done = !!doneMap[h.id];
            return (
              <tr key={h.id} className={done ? 'is-done' : ''} style={rankVars(h.rank)}>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

Object.assign(window, { Icon, RankSeal, BillCard, HuntTable, Highlight, rankVars, RANK_COLOR });
