import { useState, useEffect, useMemo } from 'react'
import { getToken, API } from './api.js'
import { navigate } from './router.js'
import { getUniversalIndex, searchIndex } from './universalIndex.js'
import { readState, writeState } from './syncedState.js'
import './UniversalSearch.css'

/* ============================================================
   UniversalSearch — the one search bar that understands everything.

   Instant client-side matches (hunts, nodes, fish, recipes,
   ingredients) are FREE and work for guests — no AI call, no login.
   The bottom row hands the query to Centurio AI: logged-in users go
   straight to /ai; guests get a Discord sign-in CTA instead, having
   just watched the site half-answer their question.

   Used on the logged-in dashboard (HomePage) and the guest hunt
   board (App). Extracted from HomePage's AIHero.
   ============================================================ */

const HISTORY_KEY = 'ffxiv-search-history'
const getHistory = () => {
  const v = readState(HISTORY_KEY, [])
  return (Array.isArray(v) ? v : []).slice(0, 8)
}

const goAI = (q) => navigate(q ? `/ai?q=${encodeURIComponent(q)}` : '/ai')

const AI_PLACEHOLDERS = [
  'Search any node, mark, fish, or recipe…',
  'Where is Chupacabra?',
  'Unspoiled nodes open now',
  'Rhotano Sea fishing',
  'Show me timed botany nodes',
]

// Category accents for instant-search rows (matches each page's identity).
const CAT_META = {
  hunt: { word: 'Hunt', color: '#d6483a' },
  mining: { word: 'Mining', color: '#d4a84a' },
  botany: { word: 'Botany', color: '#54b98a' },
  fishing: { word: 'Fishing', color: '#5ec0b0' },
  recipe: { word: 'Recipe', color: '#e0a24a' },
  ingredient: { word: 'Ingredient', color: '#b07ce0' },
}

const I = {
  spark: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="2.4"/></svg>,
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>,
  arrow: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 14 0M12 5l7 7-7 7"/></svg>,
  hist: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/></svg>,
  discord: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.02.06.03.09.02c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z"/></svg>,
}

/**
 * @param {number}  rev         bump to re-read recent searches (after sync hydration)
 * @param {boolean} showRecent  render the Recent chips row (dashboard only)
 */
export default function UniversalSearch({ rev = 0, showRecent = true }) {
  const [q, setQ] = useState('')
  const [phIdx, setPhIdx] = useState(0)
  const [focused, setFocused] = useState(false)
  const [index, setIndex] = useState(null)
  const [sel, setSel] = useState(-1)
  const [historyRev, setHistoryRev] = useState(0)
  const loggedIn = !!getToken()
  const recent = useMemo(getHistory, [rev, historyRev])

  useEffect(() => {
    if (focused) return
    const id = setInterval(() => setPhIdx((i) => (i + 1) % AI_PLACEHOLDERS.length), 3400)
    return () => clearInterval(id)
  }, [focused])

  // Universal index loads once on first focus — keeps initial page load lean.
  useEffect(() => {
    if (!focused || index) return
    let alive = true
    getUniversalIndex().then((idx) => { if (alive) setIndex(idx) })
    return () => { alive = false }
  }, [focused, index])

  // Instant matches: substring hits across hunts/nodes/fish/recipes — free,
  // no AI call, no login. The bottom row is the AI (or sign-in) fallback.
  const hits = useMemo(() => (index ? searchIndex(index, q) : []), [index, q])
  useEffect(() => { setSel(-1) }, [q])

  const go = (href) => navigate(href)
  const saveHistory = (next) => {
    writeState(HISTORY_KEY, next)
    setHistoryRev((v) => v + 1)
  }
  const clearHistory = () => saveHistory([])
  const removeHistoryItem = (item) => saveHistory(recent.filter((r) => r.toLowerCase() !== item.toLowerCase()))
  const onAiRow = () => {
    if (loggedIn) goAI(q.trim())
    else window.location.href = `${API}/auth/discord` // full-page OAuth round-trip
  }
  function onKeyDown(e) {
    const max = hits.length // index `hits.length` = the AI / sign-in row
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, max)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, -1)) }
    else if (e.key === 'Enter' && q.trim()) {
      if (sel >= 0 && sel < hits.length) go(hits[sel].href)
      else onAiRow()
    } else if (e.key === 'Escape') { setQ(''); setSel(-1) }
  }

  const showDrop = focused && q.trim().length >= 2

  return (
    <section className="dh-hero">
      <div className="dh-hero__label"><I.spark />Centurio AI — Ask anything</div>
      <div className="dh-hero__bar">
        <I.search className="dh-hero__ico" />
        <input
          className="dh-hero__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120) /* let row clicks land */}
          placeholder={AI_PLACEHOLDERS[phIdx]}
          aria-label="Search everything"
          aria-expanded={showDrop}
          role="combobox"
        />
        <button className="dh-hero__send" disabled={!q.trim()} onClick={() => q.trim() && onAiRow()} aria-label="Search">
          <I.arrow />
        </button>
        {showDrop && (
          <div className="dh-drop" role="listbox">
            {hits.map((h, i) => (
              <button key={h.cat + h.label} role="option" aria-selected={i === sel}
                className={`dh-drop__row${i === sel ? ' is-sel' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); go(h.href) }}
                onMouseEnter={() => setSel(i)}>
                <span className="dh-drop__cat" style={{ '--cc': CAT_META[h.cat]?.color }}>{CAT_META[h.cat]?.word}</span>
                <span className="dh-drop__main">
                  <span className="dh-drop__name">{h.label}</span>
                  <span className="dh-drop__sub">{h.sub}</span>
                </span>
                <I.arrow className="dh-drop__go" />
              </button>
            ))}
            <button role="option" aria-selected={sel === hits.length}
              className={`dh-drop__row dh-drop__row--ai${sel === hits.length ? ' is-sel' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); onAiRow() }}
              onMouseEnter={() => setSel(hits.length)}>
              <span className="dh-drop__cat" style={{ '--cc': 'var(--gold, #c9a35b)' }}>
                {loggedIn ? <I.spark style={{ width: 11, height: 11 }} /> : <I.discord style={{ width: 12, height: 12 }} />}
              </span>
              <span className="dh-drop__main">
                {loggedIn ? (<>
                  <span className="dh-drop__name">Ask Centurio AI</span>
                  <span className="dh-drop__sub">“{q.trim()}” — full answer with locations, timers & tips</span>
                </>) : (<>
                  <span className="dh-drop__name">Sign in to ask Centurio AI</span>
                  <span className="dh-drop__sub">“{q.trim()}” — free with Discord; full answers with locations, timers & tips</span>
                </>)}
              </span>
              <I.arrow className="dh-drop__go" />
            </button>
          </div>
        )}
      </div>

      {showRecent && recent.length > 0 && (
        <div className="dh-hero__recent">
          <div className="dh-hero__recent-head">
            <div className="dh-hero__rlabel">Recent</div>
            <button type="button" className="dh-hero__clear" onClick={clearHistory}>Clear history</button>
          </div>
          {recent.map((r) => (
            <span key={r} className="dh-hero__chip-wrap">
              <button type="button" className="dh-hero__chip" onClick={() => (loggedIn ? goAI(r) : setQ(r))}>
                <I.hist /><span className="dh-hero__chip-text">{r}</span>
              </button>
              <button type="button" className="dh-hero__chip-x" aria-label={`Remove ${r} from history`} onClick={() => removeHistoryItem(r)}>
                X
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
