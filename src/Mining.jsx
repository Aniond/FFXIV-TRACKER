import { useState, useEffect, useMemo, useRef } from 'react'
import EorzeaClock from './EorzeaClock'
import { windowState, fmtDur } from './etWindow'
import { MINING_NODES, NODE_TYPES, TYPE_ORDER, ITEM_TAG, ITEM_COLOR } from './miningData'
import { EXP_SHORT } from './crosslinkNodes.js'
import { useRecipeUsage, usageFor, cookingLink } from './recipeLinks'
import ActivityNav from './ActivityNav'
import FavStar from './FavStar'
import './Mining.css'

/* ============================================================
   Mining — Centurio Ledger Mining Log (Gathering tab)
   Route: /mining
   Underground / gem-coded variant of the hunt board.
   Personal collect checklist persists in localStorage.
   Reuses the shared <EorzeaClock> and etWindow helpers.
   ============================================================ */

const COLLECT_KEY = 'ffxiv-mining-collected'

const I = {
  search: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>),
  copy: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>),
  chevron: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>),
  pick: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 21 13 11M4 9c4-4 12-5 16-2-3-1-7 0-9 2 3-1 6 0 7 2-4-3-11-2-14-2Z"/><path d="m12.5 11.5 2 2"/></svg>),
  gem: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" {...p}><path d="M6 3h12l3 6-9 12L3 9l3-6Z"/><path d="M3 9h18M9 3 7.5 9 12 21M15 3l1.5 6L12 21"/></svg>),
  ore: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" {...p}><path d="M5 13l3-5 5-1 5 4 1 5-4 4-8 0-3-4 1-3Z"/><path d="m10 11 2 3 3-2"/></svg>),
  clock: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  hourglass: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/></svg>),
  star: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l2.6 6.2 6.4.5-4.9 4.1 1.5 6.2L12 16.9 6.4 20.2l1.5-6.2L3 9.7l6.4-.5L12 3Z"/></svg>),
}

const itemKey = (nodeId, itemName) => `${nodeId}::${itemName}`
const nodeVars = (type) => ({ '--nc': NODE_TYPES[type].gem })

function NodeCard({ node, collected, onToggleItem, onToggleAll, onCopy, highlighted, usage }) {
  const t = NODE_TYPES[node.type]
  const total = node.items.length
  const got = node.items.filter((it) => collected[itemKey(node.id, it.name)]).length
  const allDone = got === total
  const win = windowState(node.window)
  const ref = useRef(null)
  // Deep-link target: scroll the card into view when it becomes highlighted.
  useEffect(() => {
    if (highlighted && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlighted])
  return (
    <article ref={ref} className={`node${allDone ? ' is-done' : ''}${highlighted ? ' is-highlight' : ''}`} style={nodeVars(node.type)}>
      <div className="node__head">
        <div className="node__head-main">
          <h2 className="node__name">{node.name}</h2>
          <div className="node__zone">
            <span className="exp">{EXP_SHORT[node.expansion] || 'EW'}</span>{node.zone}
          </div>
          <div className="node__prog"><I.pick style={{ width: 12, height: 12 }} /><b>{got}</b>/{total} collected</div>
        </div>
        <span className="node__gem"><span className="gem" />{t.word}</span>
        <FavStar id={node.id} title="Pin to dashboard timers" />
        <button className={`collect-btn${allDone ? ' is-done' : ''}`} onClick={() => onToggleAll(node, !allDone)} title={allDone ? 'Reset' : 'Collect all'}>
          <I.check />
        </button>
      </div>

      <div className="reqs">
        <span className="req req--coords" onClick={() => onCopy(node.coords)} title="Tap to copy"><I.copy />{node.coords}</span>
        <span className="req req--lvl"><I.pick />Lv {node.level}</span>
        {!node.window && <span className="req req--time"><I.clock />Always up</span>}
      </div>

      {win && (
        <div className="window">
          <span className="window__ico">{node.type === 'Ephemeral' ? <I.hourglass /> : node.type === 'Legendary' ? <I.star /> : <I.clock />}</span>
          <span className="window__body">
            <span className="window__lbl">{node.type} window · {node.time}</span>
            <span className="window__et">{win.pre} {fmtDur(win.ms)}</span>
          </span>
          <span className={`window__state ${win.state}`}>
            {win.state === 'up' ? 'Active' : win.state === 'soon' ? 'Soon' : 'Closed'}
          </span>
        </div>
      )}

      <div className="field-lbl">Yield ({got}/{total})</div>
      <div className="items">
        {node.items.map((it) => {
          const key = itemKey(node.id, it.name)
          const done = !!collected[key]
          const Ico = I[it.icon] || I.ore
          return (
            <div className="item" key={it.name} style={{ '--ic': ITEM_COLOR[it.tag] }}>
              <span className="item__icon"><Ico /></span>
              <span className="item__body">
                <span className="item__name">{it.name}</span>
                <span className="item__meta">{ITEM_TAG[it.tag]}</span>
              </span>
              {(() => { // cross-link: this item is a cooking ingredient
                const u = usage && usageFor(usage, it.name)
                return u ? (
                  <a className="item__recipes" href={cookingLink(it.name)}
                    title={`Used in: ${u.dishes.slice(0, 6).join(', ')}${u.dishes.length > 6 ? '…' : ''}`}
                    onClick={(e) => e.stopPropagation()}>
                    {u.count} recipe{u.count > 1 ? 's' : ''}
                  </a>
                ) : null
              })()}
              <span className="item__tag">{ITEM_TAG[it.tag]}</span>
              <button className={`item__check${done ? ' is-done' : ''}`} onClick={() => onToggleItem(key)} title={done ? 'Collected' : 'Mark collected'}>
                <I.check />
              </button>
            </div>
          )
        })}
      </div>
    </article>
  )
}

export default function Mining({ nodes = MINING_NODES }) {
  const [collected, setCollected] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COLLECT_KEY)) || {} } catch { return {} }
  })
  const [q, setQ] = useState('')
  const [type, setType] = useState('All')
  const [gatherType, setGatherType] = useState('All')
  const [zone, setZone] = useState('All zones')
  const [toast, setToast] = useState(null)
  const [, setTick] = useState(0)
  const [highlightId, setHighlightId] = useState(null)
  const recipeUsage = useRecipeUsage() // item → dishes cross-links
  const toastTimer = useRef(null)
  useEffect(() => () => clearTimeout(toastTimer.current), []) // drop pending toast on unmount

  // Scope mining CSS tokens to body
  useEffect(() => {
    document.body.classList.add('mining-page')
    return () => document.body.classList.remove('mining-page')
  }, [])

  // Deep-link from AI search (?highlight=<item or node name>): find the matching
  // node, glow it gold for 3s. Cards are always expanded, so details show at once.
  useEffect(() => {
    const h = new URLSearchParams(window.location.search).get('highlight')
    if (!h) return
    const norm = (s) => String(s || '').trim().toLowerCase()
    const target = nodes.find((n) => norm(n.name) === norm(h) || n.items.some((it) => norm(it.name) === norm(h)))
    if (!target) return
    setZone('All zones')
    setType('All')
    setGatherType('All')
    setQ('')
    setHighlightId(target.id)
    const t = setTimeout(() => setHighlightId(null), 3000)
    return () => clearTimeout(t)
  }, [nodes])

  useEffect(() => { localStorage.setItem(COLLECT_KEY, JSON.stringify(collected)) }, [collected])

  const zones = useMemo(() => {
    const list = nodes
      .filter((n) => type === 'All' || n.type === type)
      .filter((n) => gatherType === 'All' || n.gatherType === gatherType)
      .map((n) => n.zone)
    return ['All zones', ...Array.from(new Set(list))]
  }, [type, gatherType, nodes])
  useEffect(() => { if (!zones.includes(zone)) setZone('All zones') }, [zones]) // eslint-disable-line

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return nodes.filter((n) => {
      if (type !== 'All' && n.type !== type) return false
      if (gatherType !== 'All' && n.gatherType !== gatherType) return false
      if (zone !== 'All zones' && n.zone !== zone) return false
      if (query) {
        const hay = [n.name, n.zone, n.expansion, n.type, n.gatherType, n.time, ...n.items.map((i) => i.name)].join(' ').toLowerCase()
        if (!hay.includes(query)) return false
      }
      return true
    })
  }, [q, type, gatherType, zone, nodes])

  // re-render each second so spawn-window countdowns stay live — but only
  // while a timed node is actually in the filtered view.
  const anyTimed = useMemo(() => filtered.some((n) => n.window), [filtered])
  useEffect(() => {
    if (!anyTimed) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [anyTimed])

  const totalItems = nodes.reduce((a, n) => a + n.items.length, 0)
  const gotItems = Object.values(collected).filter(Boolean).length

  function toggleItem(key) { setCollected((c) => ({ ...c, [key]: !c[key] })) }
  function toggleAll(node, on) {
    setCollected((c) => {
      const next = { ...c }
      node.items.forEach((it) => { next[itemKey(node.id, it.name)] = on })
      return next
    })
  }
  function copyCoords(text) { navigator.clipboard?.writeText(String(text).replace(/^~/, '')).catch(() => {}); showToast(`Copied ${text}`) }
  function showToast(m) { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1500) }

  return (
    <div className="ledger">
      <ActivityNav />
      <header className="brand">
        <a href="/" className="brand__crest" title="Home" aria-label="Home"><I.pick /></a>
        <div>
          <h1 className="brand__title">MINING LOG</h1>
          <div className="brand__sub">Centurio Ledger · {gotItems}/{totalItems} collected</div>
        </div>
      </header>

      <EorzeaClock />

      <div className="controls">
        <div className="search">
          <I.search className="search__icon" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search nodes, ore, gems…" aria-label="Search" />
        </div>

        <div className="gtseg" role="group" aria-label="Gather class">
          {[
            { key: 'Mining',    color: 'var(--topaz)',    label: 'Mining' },
            { key: 'Quarrying', color: 'var(--amethyst)', label: 'Quarrying' },
          ].map(({ key, color, label }) => (
            <button key={key} className={`gtchip${gatherType === key ? ' is-active' : ''}`} style={{ '--gc': color }}
              onClick={() => setGatherType(g => g === key ? 'All' : key)}>
              <span className="gtchip__dot" style={{ '--gc': color }} />{label}
            </button>
          ))}
        </div>

        <div className="types" role="group" aria-label="Node type">
          {TYPE_ORDER.map((tk) => {
            const gc = tk === 'All' ? 'var(--gem)' : NODE_TYPES[tk].gem
            return (
              <button key={tk} className={`tchip${type === tk ? ' is-active' : ''}`} style={{ '--gc': gc }} onClick={() => setType(tk)}>
                <span className="tchip__gem" style={{ '--gc': gc }} />{tk}
              </button>
            )
          })}
        </div>

        <div className="zonebar">
          <div className="selwrap">
            <select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone">
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <I.chevron />
          </div>
          <span className="zonebar__count"><b>{filtered.length}</b> nodes</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty__ico"><I.gem /></div>
          <h3>No nodes found</h3>
          <p>Nothing matches your filters. Try a different type or zone.</p>
        </div>
      ) : (
        <div className="nodes">
          {filtered.map((n) => (
            <NodeCard key={n.id} node={n} collected={collected} highlighted={n.id === highlightId}
              onToggleItem={toggleItem} onToggleAll={toggleAll} onCopy={copyCoords} usage={recipeUsage} />
          ))}
        </div>
      )}

      <div className={`toast${toast ? ' show' : ''}`}><I.copy />{toast}</div>
    </div>
  )
}
