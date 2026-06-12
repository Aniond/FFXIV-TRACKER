/* ============================================================
   app.jsx — Centurio Ledger container
   ============================================================ */

const DONE_KEY = 'ffxiv-hunt-done';

/* Embedded seed mirrors public/data.json so the prototype always renders.
   In production the Vite app fetches /data.json (kept in sync from the Sheet). */
const SEED = {
  hunts: [
    { id:1, name:"Mourner", rank:"B", type:"Intermediate Dawn Hunt", billNumber:"1/5", zone:"Yak T'el", area:"The Ja Tiika Heartland", coords:"~X:22, Y:28", coordsNote:"Roams central forest area", targets:2, reward:"1,000 Gil · 4 Sacks of Nuts · 471,744 EXP", authority:"Dawn Hunt", tips:["2 targets — kill both to complete.","Found in the lower Ja Tiika Heartland jungle.","Roaming mob — patrol until you find both."], status:"done" },
    { id:2, name:"Blue Morpho", rank:"B", type:"Intermediate Dawn Hunt", billNumber:"2/5", zone:"Yak T'el", area:"The Cerulean Cexudross", coords:"~X:18, Y:32", coordsNote:"Roams lower forest area", targets:3, reward:"1,000 Gil · 4 Sacks of Nuts · 471,744 EXP", authority:"Dawn Hunt", tips:["3 targets — kill all 3 to complete.","Large blue butterflies in the lower Yak T'el forest.","Same lower forest tier as Mourner — do both together."], status:"done" },
    { id:3, name:"Balyaborr", rank:"B", type:"Intermediate Dawn Hunt", billNumber:"3/5", zone:"Yak T'el", area:"The Ut'ohmu Horizon", coords:"~X:31, Y:11", coordsNote:"Roams — NE of map", targets:1, reward:"1,000 Gil · 4 Sacks of Nuts · 471,744 EXP", authority:"Dawn Hunt", tips:["B ranks roam continuously — no fixed spawn timer.","Teleport to Dirigible Landing aetheryte and sweep open ground north.","Single-target kill — soloable."], status:"todo" },
    { id:4, name:"Aspis", rank:"B", type:"Intermediate Dawn Hunt", billNumber:"4/5", zone:"Shaaloani", area:"Eshceyaani Wilds", coords:"~X:26, Y:10", coordsNote:"Roams the wilds — snake-heavy area", targets:3, reward:"1,000 Gil · 4 Sacks of Nuts · 471,744 EXP", authority:"Dawn Hunt", tips:["3 targets — kill all 3 Aspis to complete.","Common open-world snakes — easy to spot.","Plentiful in the area — shouldn't take long."], status:"todo" },
    { id:5, name:"Horned Lizard", rank:"B", type:"Intermediate Dawn Hunt", billNumber:"5/5", zone:"Shaaloani", area:"Eshceyaani Wilds", coords:"X:11.7, Y:13.7", coordsNote:"Roams — same area as Aspis", targets:2, reward:"1,000 Gil · 4 Sacks of Nuts · 471,744 EXP", authority:"Dawn Hunt", tips:["2 targets — kill both to complete.","Same area as Aspis — do both in one run.","Aggressive — will attack on sight."], status:"todo" },
  ],
};

const CATEGORIES = [
  { id:'hunts',     label:'Hunts',     icon:'crest',    soon:false },
  { id:'fates',     label:'FATEs',     icon:'fate',     soon:true  },
  { id:'gathering', label:'Gathering', icon:'gather',   soon:true  },
  { id:'crafting',  label:'Crafting',  icon:'craft',    soon:true  },
  { id:'treasure',  label:'Treasure',  icon:'treasure', soon:true  },
];

const ACCENTS = {
  '#c9a35b': { bright:'#ecca82', dim:'#8a7038' }, // Centurio gold
  '#8fb6d6': { bright:'#bcd8ef', dim:'#5a7894' }, // Allagan silver
  '#cf6b4b': { bright:'#e89875', dim:'#92452d' }, // Bozjan ember
  '#7bbf9e': { bright:'#a9e0c5', dim:'#4a7d63' }, // Gridanian jade
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "view": "cards",
  "accent": "#c9a35b",
  "density": "regular"
}/*EDITMODE-END*/;

function loadDone() {
  try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {}; }
  catch { return {}; }
}

/* concatenated searchable text per hunt */
function searchText(h) {
  return [
    h.name, h.rank, `${h.rank}-rank`, h.type, h.billNumber, h.zone, h.area,
    h.coords, h.coordsNote, h.reward, h.authority, ...(h.tips || []),
  ].join(' ').toLowerCase();
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [hunts, setHunts] = React.useState(SEED.hunts);
  const [doneMap, setDoneMap] = React.useState(loadDone);
  const [query, setQuery] = React.useState('');
  const [cat, setCat] = React.useState('hunts');
  const [rank, setRank] = React.useState('all');
  const [status, setStatus] = React.useState('all'); // all | open | done
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);

  /* migrate seed status -> done map on first load (if no overrides yet) */
  React.useEffect(() => {
    setDoneMap((prev) => {
      if (Object.keys(prev).length) return prev;
      const m = {};
      SEED.hunts.forEach((h) => { if (h.status === 'done') m[h.id] = true; });
      return m;
    });
  }, []);

  /* try live data.json, fall back to seed silently */
  React.useEffect(() => {
    fetch('public/data.json')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && Array.isArray(d.hunts) && d.hunts.length) setHunts(d.hunts); })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    localStorage.setItem(DONE_KEY, JSON.stringify(doneMap));
  }, [doneMap]);

  /* apply accent tweak to CSS vars */
  React.useEffect(() => {
    const a = ACCENTS[t.accent] || ACCENTS['#c9a35b'];
    const r = document.documentElement;
    r.style.setProperty('--gold', t.accent);
    r.style.setProperty('--gold-bright', a.bright);
    r.style.setProperty('--gold-dim', a.dim);
    r.style.setProperty('--gold-faint', `${t.accent}24`);
  }, [t.accent]);

  const q = query.trim();

  const filtered = React.useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    return hunts.filter((h) => {
      const done = !!doneMap[h.id];
      if (rank !== 'all' && h.rank !== rank) return false;
      if (status === 'open' && done) return false;
      if (status === 'done' && !done) return false;
      if (tokens.length) {
        const txt = searchText(h);
        if (!tokens.every((tok) => txt.includes(tok))) return false;
      }
      return true;
    });
  }, [hunts, doneMap, rank, status, q]);

  const ranksPresent = React.useMemo(
    () => ['S','A','B'].filter((r) => hunts.some((h) => h.rank === r)),
    [hunts]
  );
  const doneCount = hunts.filter((h) => doneMap[h.id]).length;

  function toggle(id) {
    setDoneMap((m) => ({ ...m, [id]: !m[id] }));
  }
  function copyCoords(text) {
    const clean = String(text).replace(/^~/, '');
    navigator.clipboard?.writeText(clean).catch(() => {});
    showToast(`Copied ${clean}`);
  }
  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }

  const counts = { hunts: hunts.length };
  const huntsActive = cat === 'hunts';

  return (
    <div className={`ledger${t.density === 'compact' ? ' is-compact' : ''}`}>
      {/* Brand */}
      <header className="brand">
        <div className="brand__crest"><Icon.crest /></div>
        <div>
          <h1 className="brand__title">CENTURIO LEDGER</h1>
          <div className="brand__sub">Hunt Board · {doneCount}/{hunts.length} cleared</div>
        </div>
      </header>

      {/* Sticky controls */}
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
            const I = Icon[c.icon];
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
            );
          })}
        </nav>

        {huntsActive && (
          <div className="filters">
            <button className={`chip${rank === 'all' ? ' is-active' : ''}`} onClick={() => setRank('all')}>All ranks</button>
            {ranksPresent.map((r) => (
              <button key={r} className={`chip${rank === r ? ' is-active' : ''}`} onClick={() => setRank(r)}>
                <span className="chip__dot" style={{ background: RANK_COLOR[r] }} />{r}-rank
              </button>
            ))}
            <span className="chip-sep" />
            <button className={`chip${status === 'all' ? ' is-active' : ''}`} onClick={() => setStatus('all')}>All</button>
            <button className={`chip${status === 'open' ? ' is-active' : ''}`} onClick={() => setStatus('open')}>Open</button>
            <button className={`chip${status === 'done' ? ' is-active' : ''}`} onClick={() => setStatus('done')}>Cleared</button>
          </div>
        )}
      </div>

      {huntsActive ? (
        <>
          <div className="metarow">
            <div className="metarow__count">
              <b>{filtered.length}</b> of {hunts.length} marks
            </div>
            <div className="viewtoggle" role="group" aria-label="View">
              <button className={t.view === 'cards' ? 'is-active' : ''} onClick={() => setTweak('view', 'cards')} aria-label="Card view"><Icon.cards /></button>
              <button className={t.view === 'table' ? 'is-active' : ''} onClick={() => setTweak('view', 'table')} aria-label="Table view"><Icon.table /></button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty__crest"><Icon.search /></div>
              <h3>No marks found</h3>
              <p>No hunts match “{q}” with the current filters. Try a different term or reset the rank filter.</p>
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

      <div className={`toast${toast ? ' is-show' : ''}`}>
        <Icon.copy />{toast}
      </div>

      {/* Tweaks */}
      <TweaksPanel>
        <TweakSection label="View" />
        <TweakRadio label="Layout" value={t.view} options={['cards', 'table']} onChange={(v) => setTweak('view', v)} />
        <TweakRadio label="Density" value={t.density} options={['regular', 'compact']} onChange={(v) => setTweak('density', v)} />
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={t.accent} options={Object.keys(ACCENTS)} onChange={(v) => setTweak('accent', v)} />
      </TweaksPanel>
    </div>
  );
}

function ComingSoon({ cat }) {
  const I = Icon[cat.icon];
  return (
    <div className="empty">
      <div className="empty__crest"><I /></div>
      <h3>{cat.label}</h3>
      <p>This ledger is built to grow. {cat.label} will live here — same search, same board, one tap away.</p>
      <span className="empty__soon">Coming soon</span>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
