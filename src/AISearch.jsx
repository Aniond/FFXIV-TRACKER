import { useState, useEffect, useRef, useMemo } from 'react'
import ActivityNav from './ActivityNav'
import EorzeaClock from './EorzeaClock'
import { windowState, fmtDur } from './etWindow'
import { MINING_NODES } from './miningData'
import { BOTANY_NODES } from './botanyData'
import { API, getToken, fetchMe, fetchFlags, aiSearch } from './api'
import './AISearch.css'

/* ============================================================
   AISearch — Centurio assistant (Gathering/Hunt companion AI)
   Route: /ai
   Admin-only preview until the ENABLE_AI_PUBLIC flag is on.
   Natural-language query -> POST /api/ai/search -> structured
   results with coords copy + live timed-node windows.
   ============================================================ */

const SAMPLES = ['Where is Chupacabra?', 'Darksteel Ore', 'Rhotano Sea fishing', 'Unspoiled nodes open now']

const PAGE_LINK = {
  hunt: { href: '/', label: 'Hunt board' },
  fishing: { href: '/gathering/fishing', label: 'Fishing log' },
  mining: { href: '/gathering/mining', label: 'Mining log' },
  botany: { href: '/gathering/botany', label: 'Botany log' },
}

const I = {
  spark: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="2.4"/></svg>),
  search: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>),
  copy: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>),
  pin: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>),
  clock: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  bulb: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.2 1 2.5h6c0-1.3.3-1.8 1-2.5A6 6 0 0 0 12 3Z"/></svg>),
  arrow: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>),
}

const normCoords = (c) => String(c || '').replace(/~/g, '').replace(/\s+/g, '').toLowerCase()

// Recent-search history powers the dashboard's "Recent" chips.
const HISTORY_KEY = 'ffxiv-search-history'
function pushHistory(text) {
  try {
    const cur = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []
    const next = [text, ...cur.filter((x) => x.toLowerCase() !== text.toLowerCase())].slice(0, 8)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch { /* ignore quota/parse errors */ }
}

// Map verbatim coords -> source node, but only for TIMED nodes (those carry a
// spawn window). Lets us recover the precise window object the AI can't reliably
// echo, and render a live "Active/Soon/Closed" countdown.
const TIMED_BY_COORDS = (() => {
  const m = new Map()
  ;[...MINING_NODES, ...BOTANY_NODES].forEach((n) => { if (n.window) m.set(normCoords(n.coords), n) })
  return m
})()

function ResultCard({ r, onCopy }) {
  const link = PAGE_LINK[r.category]
  const node = (r.category === 'mining' || r.category === 'botany') ? TIMED_BY_COORDS.get(normCoords(r.coords)) : null
  const win = node ? windowState(node.window) : null
  // Live badge if we matched a source node; static window text from the AI otherwise.
  const badge = win
    ? { state: win.state, head: win.state === 'up' ? 'Active' : win.state === 'soon' ? 'Soon' : 'Closed', sub: `${win.pre} ${fmtDur(win.ms)}`, title: node.time }
    : (r.timed && r.window ? { state: 'timed', head: 'Timed', sub: r.window, title: r.window } : null)

  return (
    <article className={`aicard aicard--${r.category}`}>
      <div className="aicard__head">
        <h3 className="aicard__name">{r.name}</h3>
        <span className={`aicard__cat aicard__cat--${r.category}`}>{r.category}</span>
      </div>
      {r.zone && <div className="aicard__zone"><I.pin />{r.zone}</div>}
      {r.detail && <p className="aicard__detail">{r.detail}</p>}

      <div className="aicard__foot">
        {r.coords && (
          <button className="aicard__coords" onClick={() => onCopy(r.coords)} title="Tap to copy">
            <I.copy />{r.coords}
          </button>
        )}
        {badge && (
          <span className={`aicard__timer is-${badge.state}`} title={badge.title}>
            <I.clock /><b>{badge.head}</b><span className="aicard__timer-sub">{badge.sub}</span>
          </span>
        )}
        {link && <a className="aicard__link" href={link.href}>{link.label}<I.arrow /></a>}
      </div>
    </article>
  )
}

export default function AISearch() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)
  const [publicOn, setPublicOn] = useState(false)

  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState(null)
  const [, setTick] = useState(0)
  const toastTimer = useRef(null)
  const didAuto = useRef(false)

  useEffect(() => {
    document.body.classList.add('ai-page')
    return () => document.body.classList.remove('ai-page')
  }, [])

  // Gate: who can use it. Admin always (preview); everyone once the flag is on.
  useEffect(() => {
    Promise.all([getToken() ? fetchMe().catch(() => null) : Promise.resolve(null), fetchFlags()])
      .then(([me, flags]) => { setUser(me); setPublicOn(!!flags.ENABLE_AI_PUBLIC); setReady(true) })
      .catch(() => setReady(true))
  }, [])

  // Keep timed-node countdowns ticking once there are results to show.
  const hasTimed = useMemo(() => (result?.results || []).some((r) => r.category === 'mining' || r.category === 'botany'), [result])
  useEffect(() => {
    if (!hasTimed) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [hasTimed])

  const isAdmin = !!user?.is_admin
  const canUse = isAdmin || publicOn

  // Auto-run a query passed via ?q= (e.g. from the dashboard's AI hero / chips).
  useEffect(() => {
    if (!ready || !canUse || didAuto.current) return
    const iq = new URLSearchParams(window.location.search).get('q')
    if (iq && iq.trim()) { didAuto.current = true; setQ(iq.trim()); run(iq.trim()) }
  }, [ready, canUse]) // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(m) { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1500) }
  function copyCoords(text) { navigator.clipboard?.writeText(String(text).replace(/^~/, '')).catch(() => {}); showToast(`Copied ${text}`) }

  async function run(query) {
    const text = (query ?? q).trim()
    if (!text || loading) return
    setQ(text)
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await aiSearch(text)
      setResult(data)
      pushHistory(text)
    } catch (err) {
      if (err.status === 401) setError('Please sign in with Discord to use AI search.')
      else if (err.status === 403) setError('AI search is in admin preview right now.')
      else if (err.status === 429) setError('Rate limit reached (20/hour). Try again later.')
      else setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ledger ai">
      <ActivityNav />
      <header className="brand">
        <a href="/" className="brand__crest" title="Home" aria-label="Home"><I.spark /></a>
        <div>
          <h1 className="brand__title">CENTURIO AI</h1>
          <div className="brand__sub">
            Gathering &amp; hunt companion
            {isAdmin && !publicOn && <span className="ai-preview-badge">AI Search — Admin Preview</span>}
          </div>
        </div>
      </header>

      {!ready ? (
        <div className="ai-note">Loading…</div>
      ) : !canUse ? (
        <div className="ai-locked">
          <div className="ai-locked__ico"><I.spark /></div>
          <h3>Admin preview</h3>
          <p>Centurio AI search is being tested by admins and isn’t open yet. Check back soon.</p>
          {!user && (
            <a href={`${API}/auth/discord`} className="discord-btn"><I.spark />Sign in</a>
          )}
        </div>
      ) : (
        <>
          <EorzeaClock />

          <form className="controls" onSubmit={(e) => { e.preventDefault(); run() }}>
            <div className="search">
              <I.search className="search__icon" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ask about a mark, fish, ore, herb, or node…"
                aria-label="Ask Centurio"
                autoFocus
              />
              {q && <button type="button" className="search__clear" onClick={() => setQ('')} aria-label="Clear">×</button>}
            </div>
            <button className="ai-go" type="submit" disabled={loading || !q.trim()}>
              {loading ? 'Asking…' : <>Ask<I.arrow /></>}
            </button>
          </form>

          <div className="ai-samples">
            {SAMPLES.map((s) => (
              <button key={s} className="ai-sample" onClick={() => run(s)} disabled={loading}>{s}</button>
            ))}
          </div>

          {error && <div className="ai-error">{error}</div>}

          {loading && (
            <div className="ai-thinking"><span className="ai-dots"><i /><i /><i /></span>Centurio is consulting the ledger…</div>
          )}

          {result && !loading && (
            <div className="ai-result">
              {result.cached && <div className="ai-cached">Cached result</div>}
              <div className="ai-summary"><I.spark className="ai-summary__ico" />{result.summary}</div>

              {result.results?.length > 0 && (
                <div className="ai-cards">
                  {result.results.map((r, i) => <ResultCard key={`${r.name}-${i}`} r={r} onCopy={copyCoords} />)}
                </div>
              )}

              {result.tips?.length > 0 && (
                <div className="ai-tips">
                  <div className="ai-tips__hd"><I.bulb />Tips</div>
                  <ul>{result.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className={`toast${toast ? ' show is-show' : ''}`}><I.copy />{toast}</div>
    </div>
  )
}
