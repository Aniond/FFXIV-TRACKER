import { useState, useEffect, useMemo } from 'react'
import { saveJobs, saveCharacterLink, refreshJobsFromLodestone, fetchJobs, fetchMarketWorlds, API } from './api'
import { readState, writeState, hydrateFromServer, HYDRATED_EVENT, useSyncedState } from './syncedState'
import './Profile.css'

/* ============================================================
   Profile — Centurio Ledger player profile
   Route: /profile/:name  (e.g. /profile/aniond)
   Full-bleed, mobile-first. Pass a `profile` object (see shape
   below + SAMPLE_PROFILE). In production, assemble it from the
   user's accumulated progress + XIVAPI (see README).
   ============================================================ */

/* ---------- icons ---------- */
const I = {
  crest:   (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...p}><path d="M12 2 4 5v6c0 5 3.4 8.3 8 11 4.6-2.7 8-6 8-11V5l-8-3Z"/><path d="M12 7v8M8.5 10.5 12 7l3.5 3.5"/></svg>),
  share:   (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/></svg>),
  spark:   (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/></svg>),
  swords:  (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14.5 4H20v5.5L8.5 21 3 15.5 14.5 4ZM4 4h5.5L21 15.5 15.5 21"/></svg>),
  banner:  (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 3h12v15l-6-3-6 3V3Z"/></svg>),
  world:   (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>),
  pencil:  (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 5.5 18.5 10 8 20.5 3.5 21l.5-4.5L14 5.5ZM13 7l4 4"/></svg>),
  search:  (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>),
  link:    (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>),
  x:       (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>),
  refresh: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>),
}

const fmt    = (n) => Number(n || 0).toLocaleString('en-US')

const COLLAPSE_KEY = 'ffxiv-profile-collapsed'
const GATHERING_STATS_KEY = 'ffxiv-gathering-stats'
const DEFAULT_GATHERING_STATS = { level: 100, gathering: 0, perception: 0, gp: 0 }
const GATHERING_STAT_FIELDS = [
  { key: 'level', label: 'Level', min: 1, max: 100 },
  { key: 'gathering', label: 'Gathering', min: 0, max: 9999 },
  { key: 'perception', label: 'Perception', min: 0, max: 9999 },
  { key: 'gp', label: 'GP', min: 0, max: 9999 },
]
const CRAFTING_STATS_KEY = 'ffxiv-crafter-stats'
const DEFAULT_CRAFTING_STATS = { level: 100, craft: 4000, control: 4000, cp: 600 }
const CRAFTING_STAT_FIELDS = [
  { key: 'level', label: 'Level', min: 1, max: 100 },
  { key: 'craft', label: 'Craftsmanship', min: 0, max: 9999 },
  { key: 'control', label: 'Control', min: 0, max: 9999 },
  { key: 'cp', label: 'CP', min: 0, max: 9999 },
]
const PREFERRED_ROLES_KEY = 'ffxiv-preferred-roles'
const MARKET_SERVER_KEY = 'ffxiv-market-server'
const PREFERRED_ROLE_OPTIONS = [
  { key: 'tank', label: 'Tank', color: 'var(--role-tank)' },
  { key: 'healer', label: 'Healer', color: 'var(--role-heal)' },
  { key: 'melee', label: 'Melee DPS', color: 'var(--role-melee)' },
  { key: 'physical-ranged', label: 'Physical Ranged', color: 'var(--role-pranged)' },
  { key: 'magical-ranged', label: 'Magical Ranged', color: 'var(--role-mranged)' },
  { key: 'crafter', label: 'Crafter', color: 'var(--role-craft)' },
  { key: 'gatherer', label: 'Gatherer', color: 'var(--role-gather)' },
  { key: 'fisher', label: 'Fisher', color: '#38b8c0' },
]

function Panel({ title, icon: Ico, count, badge, action, children, className = '', collapseId }) {
  const collapsible = !!collapseId
  // Default open; the collapsed set follows the account (synced state).
  const [open, setOpen] = useState(() => !collapsible || !readState(COLLAPSE_KEY, {})[collapseId])
  useEffect(() => {
    if (!collapsible) return
    hydrateFromServer()
    const onHydrated = () => setOpen(!readState(COLLAPSE_KEY, {})[collapseId])
    window.addEventListener(HYDRATED_EVENT, onHydrated)
    return () => window.removeEventListener(HYDRATED_EVENT, onHydrated)
  }, [collapsible, collapseId])
  const toggle = () => {
    const map = { ...readState(COLLAPSE_KEY, {}) }
    if (open) map[collapseId] = true
    else delete map[collapseId]
    writeState(COLLAPSE_KEY, map)
    setOpen(!open)
  }
  const hasRight = count != null || action || collapsible
  return (
    <section className={`panel ${className}${collapsible && !open ? ' is-closed' : ''}`}>
      <h3 className={`panel__title${collapsible ? ' is-collapsible' : ''}`}
        onClick={collapsible ? toggle : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? open : undefined}>
        {Ico && <Ico />}
        {title}
        {badge && <span className="panel__badge">{badge}</span>}
        {hasRight && <span className="panel__spacer" />}
        {count != null && <span className="ct">{count}</span>}
        {action && <span className="panel__action" onClick={(e) => e.stopPropagation()}>{action}</span>}
        {collapsible && (
          <span className={`panel__chev${open ? ' is-open' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </span>
        )}
      </h3>
      {open && children}
    </section>
  )
}

function GatheringStatsPanel({ isOwner }) {
  const [stats, setStats] = useSyncedState(GATHERING_STATS_KEY, DEFAULT_GATHERING_STATS)
  const [draft, setDraft] = useState(stats)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setDraft({ ...DEFAULT_GATHERING_STATS, ...(stats || {}) })
  }, [stats, editing])

  const cleanStats = (value) => {
    const next = {}
    for (const field of GATHERING_STAT_FIELDS) {
      const raw = Number.parseInt(value?.[field.key], 10)
      const num = Number.isFinite(raw) ? raw : DEFAULT_GATHERING_STATS[field.key]
      next[field.key] = Math.max(field.min, Math.min(field.max, num))
    }
    return next
  }

  const current = cleanStats(stats)
  const save = () => {
    setStats(cleanStats(draft))
    setEditing(false)
  }
  const action = isOwner && (
    editing ? (
      <>
        <button className="jobs-btn jobs-btn--save" onClick={save}>Save</button>
        <button className="jobs-btn jobs-btn--cancel" onClick={() => { setDraft(current); setEditing(false) }}>Cancel</button>
      </>
    ) : (
      <button className="jobs-btn jobs-btn--edit" onClick={() => { setDraft(current); setEditing(true) }}>
        <I.pencil style={{ width: 11, height: 11 }} /> Edit
      </button>
    )
  )

  return (
    <Panel title="Gathering Stats" icon={I.spark} className="col-span" collapseId="gathering-stats" action={action}>
      <div className="gather-stats">
        {GATHERING_STAT_FIELDS.map((field) => (
          <label className="gather-stat" key={field.key}>
            <span>{field.label}</span>
            {editing ? (
              <input
                type="number"
                min={field.min}
                max={field.max}
                value={draft[field.key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
              />
            ) : (
              <b>{fmt(current[field.key])}</b>
            )}
          </label>
        ))}
      </div>
    </Panel>
  )
}

function CraftingStatsPanel({ isOwner }) {
  const [stats, setStats] = useSyncedState(CRAFTING_STATS_KEY, DEFAULT_CRAFTING_STATS)
  const [draft, setDraft] = useState(stats)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setDraft({ ...DEFAULT_CRAFTING_STATS, ...(stats || {}) })
  }, [stats, editing])

  const cleanStats = (value) => {
    const next = {}
    for (const field of CRAFTING_STAT_FIELDS) {
      const raw = Number.parseInt(value?.[field.key], 10)
      const num = Number.isFinite(raw) ? raw : DEFAULT_CRAFTING_STATS[field.key]
      next[field.key] = Math.max(field.min, Math.min(field.max, num))
    }
    return next
  }

  const current = cleanStats(stats)
  const save = () => {
    setStats(cleanStats(draft))
    setEditing(false)
  }
  const action = isOwner && (
    editing ? (
      <>
        <button className="jobs-btn jobs-btn--save" onClick={save}>Save</button>
        <button className="jobs-btn jobs-btn--cancel" onClick={() => { setDraft(current); setEditing(false) }}>Cancel</button>
      </>
    ) : (
      <button className="jobs-btn jobs-btn--edit" onClick={() => { setDraft(current); setEditing(true) }}>
        <I.pencil style={{ width: 11, height: 11 }} /> Edit
      </button>
    )
  )

  return (
    <Panel title="Crafting Stats" icon={I.swords} className="col-span" collapseId="crafting-stats" action={action}>
      <div className="gather-stats">
        {CRAFTING_STAT_FIELDS.map((field) => (
          <label className="gather-stat" key={field.key}>
            <span>{field.label}</span>
            {editing ? (
              <input
                type="number"
                min={field.min}
                max={field.max}
                value={draft[field.key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
              />
            ) : (
              <b>{fmt(current[field.key])}</b>
            )}
          </label>
        ))}
      </div>
    </Panel>
  )
}

function PreferredRolesPanel({ isOwner, initialRoles = [] }) {
  const [roles, setRoles] = useSyncedState(PREFERRED_ROLES_KEY, [])
  const sourceRoles = isOwner ? roles : initialRoles
  const selected = new Set(Array.isArray(sourceRoles) ? sourceRoles : [])
  const selectedOptions = PREFERRED_ROLE_OPTIONS.filter((role) => selected.has(role.key))

  const toggle = (key) => {
    if (!isOwner) return
    setRoles((prev) => {
      const next = new Set(Array.isArray(prev) ? prev : [])
      next.has(key) ? next.delete(key) : next.add(key)
      return [...next]
    })
  }

  return (
    <Panel
      title="Preferred Roles"
      icon={I.banner}
      className="col-span"
      collapseId="preferred-roles"
      count={selected.size ? `${selected.size} selected` : undefined}
    >
      <div className="preferred-roles">
        {isOwner ? (
          PREFERRED_ROLE_OPTIONS.map((role) => {
            const active = selected.has(role.key)
            return (
              <button
                type="button"
                key={role.key}
                className={`preferred-role${active ? ' is-active' : ''}`}
                style={{ '--role-color': role.color }}
                onClick={() => toggle(role.key)}
                aria-pressed={active}
              >
                <span className="preferred-role__mark" />
                <span>{role.label}</span>
              </button>
            )
          })
        ) : selectedOptions.length ? (
          selectedOptions.map((role) => (
            <span className="preferred-role is-active is-readonly" style={{ '--role-color': role.color }} key={role.key}>
              <span className="preferred-role__mark" />
              <span>{role.label}</span>
            </span>
          ))
        ) : (
          <div className="preferred-roles__empty">No preferred roles set.</div>
        )}
      </div>
    </Panel>
  )
}

function MarketServerPanel({ isOwner, fallbackWorld, fallbackDc }) {
  const fallback = fallbackWorld && fallbackWorld !== '-' ? fallbackWorld : (fallbackDc || 'Crystal')
  const [marketServer, setMarketServer] = useSyncedState(MARKET_SERVER_KEY, fallback)
  const [marketWorlds, setMarketWorlds] = useState({ dataCenters: [], worlds: [] })
  const selected = marketServer || fallback

  useEffect(() => {
    if (!isOwner) return
    let alive = true
    fetchMarketWorlds().then((data) => { if (alive) setMarketWorlds(data) }).catch(() => {})
    return () => { alive = false }
  }, [isOwner])

  return (
    <Panel title="Market Server" icon={I.world} className="col-span" collapseId="market-server" badge={selected}>
      {isOwner ? (
        <div className="market-server">
          <label>
            <span>World or Data Center</span>
            <select value={selected} onChange={(e) => setMarketServer(e.target.value)}>
              <option value={fallback}>{fallback} (Character)</option>
              {marketWorlds.dataCenters.map((dc) => (
                <optgroup key={dc.name} label={`${dc.region || 'Region'} - ${dc.name}`}>
                  <option value={dc.name}>{dc.name} data center</option>
                  {dc.worlds.map((world) => <option key={world.id} value={world.name}>{world.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="preferred-roles__empty">Market prices use this character's public world or data center.</div>
      )}
    </Panel>
  )
}

export default function Profile({ profile = SAMPLE_PROFILE, isOwner = false }) {
  const p = profile

  /* ---- Portrait local state (updates after linking) ---- */
  const [localPortrait, setLocalPortrait] = useState(p.portrait)
  useEffect(() => setLocalPortrait(p.portrait), [p])

  /* ---- Link-character state ---- */
  const [linkOpen, setLinkOpen]           = useState(false)
  const [searchName, setSearchName]       = useState('')
  const [searchServer, setSearchServer]   = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching]         = useState(false)
  const [linkError, setLinkError]         = useState(null)
  const [importing, setImporting]         = useState(false)

  function openLink() { setLinkOpen(true); setSearchResults([]); setLinkError(null) }
  function closeLink() { setLinkOpen(false); setSearchName(''); setSearchServer(''); setSearchResults([]); setLinkError(null) }

  async function doSearch(e) {
    e.preventDefault()
    if (!searchName.trim()) return
    setSearching(true); setLinkError(null); setSearchResults([])
    try {
      const r = await fetch(`${API}/api/character/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: searchName.trim(), server: searchServer.trim() || undefined }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Search failed')
      if (!data.results?.length) setLinkError('No characters found — try a different name or server.')
      else setSearchResults(data.results)
    } catch (err) { setLinkError(err.message) }
    finally { setSearching(false) }
  }

  async function importCharacter(char) {
    setImporting(true); setLinkError(null)
    try {
      const r = await fetch(`${API}/api/character/${char.id}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to fetch character')

      // Save character link + portrait to DB
      await saveCharacterLink({ lodestone_id: char.id, world: data.server, dc: data.dc, portrait_url: data.portrait })

      // Import job levels if available
      if (Object.keys(data.jobs || {}).length) {
        await saveJobs(Object.entries(data.jobs).map(([job_abbr, level]) => ({ job_abbr, level })))
        setLocalRoles((prev) =>
          prev.map((role) => ({ ...role, jobs: role.jobs.map(([abbr]) => [abbr, data.jobs[abbr] ?? 0]) }))
        )
      }

      setLocalPortrait(data.portrait)
      closeLink()
    } catch (err) { setLinkError(err.message) }
    finally { setImporting(false) }
  }

  /* ---- Job levels local state ---- */
  const [localRoles, setLocalRoles] = useState(p.roles)
  useEffect(() => { setLocalRoles(p.roles) }, [p])

  const [editingJobs, setEditingJobs]   = useState(false)
  const [draftLevels, setDraftLevels]   = useState({})
  const [savingJobs,  setSavingJobs]    = useState(false)
  const [syncing,     setSyncing]       = useState(false)
  const [syncMsg,     setSyncMsg]       = useState(null)

  function startEdit() {
    const flat = {}
    for (const role of localRoles)
      for (const [abbr, lvl] of role.jobs) flat[abbr] = String(lvl)
    setDraftLevels(flat)
    setEditingJobs(true)
  }

  function cancelEdit() {
    setEditingJobs(false)
    setDraftLevels({})
  }

  async function commitSave() {
    setSavingJobs(true)
    const clean = Object.fromEntries(
      Object.entries(draftLevels).map(([k, v]) => [k, Math.max(0, Math.min(100, parseInt(v, 10) || 0))])
    )
    try {
      await saveJobs(Object.entries(clean).map(([job_abbr, level]) => ({ job_abbr, level })))
      setLocalRoles((prev) =>
        prev.map((role) => ({ ...role, jobs: role.jobs.map(([abbr]) => [abbr, clean[abbr] ?? 0]) }))
      )
      setEditingJobs(false)
    } catch (e) {
      console.error('[jobs save]', e.message)
    } finally {
      setSavingJobs(false)
    }
  }

  async function syncFromLodestone() {
    setSyncing(true); setSyncMsg(null)
    try {
      await refreshJobsFromLodestone()
      const updated = await fetchJobs()
      const lvls = Object.fromEntries(updated.map((j) => [j.job_abbr, j.level]))
      setLocalRoles((prev) =>
        prev.map((role) => ({ ...role, jobs: role.jobs.map(([abbr]) => [abbr, lvls[abbr] ?? 0]) }))
      )
      setSyncMsg('Synced')
      setTimeout(() => setSyncMsg(null), 2500)
    } catch (err) {
      setSyncMsg(err.message)
      setTimeout(() => setSyncMsg(null), 4000)
    } finally {
      setSyncing(false)
    }
  }

  const at100 = useMemo(
    () => localRoles.reduce((n, r) => n + r.jobs.filter(([, lvl]) => lvl === 100).length, 0),
    [localRoles]
  )

  function share() {
    const url = typeof window !== 'undefined' ? window.location.href : `https://ffxivlog.com/profile/${p.slug || ''}`
    if (navigator.share) navigator.share({ title: `${p.name} · Centurio Ledger`, url }).catch(() => {})
    else navigator.clipboard?.writeText(url).catch(() => {})
  }

  const jobsAction = isOwner && (
    editingJobs ? (
      <>
        <button className="jobs-btn jobs-btn--save" onClick={commitSave} disabled={savingJobs}>
          {savingJobs ? 'Saving…' : 'Save'}
        </button>
        <button className="jobs-btn jobs-btn--cancel" onClick={cancelEdit} disabled={savingJobs}>Cancel</button>
      </>
    ) : (
      <>
        <button className="jobs-btn jobs-btn--sync" onClick={syncFromLodestone} disabled={syncing} title="Pull latest levels from Lodestone">
          <I.refresh style={{ width: 11, height: 11 }} />
          {syncing ? 'Syncing…' : syncMsg ?? 'Sync'}
        </button>
        <button className="jobs-btn jobs-btn--edit" onClick={startEdit}>
          <I.pencil style={{ width: 11, height: 11 }} /> Edit
        </button>
      </>
    )
  )

  return (
    <div className="wrap">
      <header className="topbar">
        <a className="brandmini" href="/">
          <span className="brandmini__crest"><I.crest /></span>
            <span>
              <span className="brandmini__name">CENTURIO LEDGER</span>
              <span className="brandmini__sub" style={{ display: 'block' }}>Profile</span>
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
            {localPortrait
              ? <img className="portrait-img" src={localPortrait} alt={`${p.name} portrait`} loading="eager" />
              : <div className="portrait-img portrait-img--empty" aria-hidden="true" />}
          </div>
          <div className="hero__body">
            <h1 className="hero__name">{p.name}</h1>
            {p.title && <div className="hero__title">"{p.title}"</div>}
            <div className="hero__meta">
              <span className="metachip"><I.world /><b>{p.world}</b>{p.dc ? ` · ${p.dc}` : ''}</span>
              {p.gc && <span className="metachip"><I.banner className="gc-crest" /><b>{p.gc.name}</b> · {p.gc.rank}</span>}
            </div>
            {isOwner && !linkOpen && (
              <button className="link-char-btn" onClick={openLink}>
                {localPortrait ? <><I.pencil />Change Character</> : <><I.link />Link Character</>}
              </button>
            )}
          </div>
        </div>

        {/* Lodestone character link panel */}
        {linkOpen && (
          <div className="link-panel">
            <div className="link-panel__head">
              <I.link style={{ width: 14, height: 14 }} />
              <span>Link your Lodestone character</span>
              <button className="link-panel__close" onClick={closeLink} aria-label="Close"><I.x /></button>
            </div>
            <form className="link-panel__form" onSubmit={doSearch}>
              <input
                className="link-panel__input"
                placeholder="Character name"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                required
                autoFocus
              />
              <input
                className="link-panel__input"
                placeholder="Server (optional)"
                value={searchServer}
                onChange={(e) => setSearchServer(e.target.value)}
              />
              <button className="link-panel__search-btn" type="submit" disabled={searching || importing}>
                {searching ? 'Searching…' : <><I.search style={{ width: 12, height: 12 }} />Search</>}
              </button>
            </form>
            {linkError && <div className="link-panel__error">{linkError}</div>}
            {searchResults.length > 0 && (
              <div className="link-panel__results">
                {searchResults.map((char) => (
                  <button
                    key={char.id}
                    className="char-result"
                    onClick={() => importCharacter(char)}
                    disabled={importing}
                  >
                    {char.portrait
                      ? <img className="char-result__portrait" src={char.portrait} alt="" />
                      : <div className="char-result__portrait char-result__portrait--empty" />}
                    <div className="char-result__info">
                      <span className="char-result__name">{char.name}</span>
                      <span className="char-result__world">{char.server}{char.dc ? ` · ${char.dc}` : ''}</span>
                    </div>
                    <span className="char-result__cta">
                      {importing ? 'Importing…' : 'Link & import jobs →'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid">
        <GatheringStatsPanel isOwner={isOwner} />
        <CraftingStatsPanel isOwner={isOwner} />
        <PreferredRolesPanel isOwner={isOwner} initialRoles={p.preferredRoles} />
        <MarketServerPanel isOwner={isOwner} fallbackWorld={p.world} fallbackDc={p.dc} />

        {/* Job levels */}
        <Panel
          title="Job Levels"
          icon={I.swords}
          className="col-span"
          collapseId="jobs"

          count={editingJobs ? undefined : `${at100} at 100`}
          action={jobsAction}
        >
          {localRoles.map((role) => (
            <div className="rolegroup" key={role.key} style={{ '--rcol': role.color }}>
              <div className="rolegroup__head">
                <span className="rolegroup__dot" />
                <span className="rolegroup__name">{role.name}</span>
                <span className="rolegroup__line" />
              </div>
              <div className="jobs">
                {role.jobs.map(([abbr, lvl]) => {
                  const isMax = !editingJobs && lvl === 100
                  return (
                    <div className={`job${isMax ? ' max' : ''}${editingJobs ? ' is-editing' : ''}`} key={abbr}>
                      <span className="job__ring"><span className="job__abbr">{abbr}</span></span>
                      {editingJobs ? (
                        <input
                          className="job__input"
                          type="number"
                          min="0"
                          max="100"
                          value={draftLevels[abbr] ?? String(lvl)}
                          onChange={(e) => setDraftLevels((d) => ({ ...d, [abbr]: e.target.value }))}
                        />
                      ) : (
                        <span className="job__lvl"><small>Lv</small>{lvl}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </Panel>

        {/* Recent clears */}

      </div>

      <footer className="foot">
        <div className="foot__url">ffxivlog.com/profile/{p.slug || ''}</div>
        <div className="foot__note">Centurio Ledger · Player Profile &amp; Field Ledger</div>
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
  portrait: null,
  gc: { name: 'Maelstrom', rank: 'Storm Captain' },
  preferredRoles: ['crafter', 'gatherer', 'fisher'],
  roles: [
    { key: 'tank',    name: 'Tank',            color: 'var(--role-tank)',    jobs: [['PLD', 100], ['WAR', 90], ['DRK', 100], ['GNB', 82]] },
    { key: 'heal',    name: 'Healer',          color: 'var(--role-heal)',    jobs: [['WHM', 100], ['SCH', 100], ['AST', 74], ['SGE', 90]] },
    { key: 'melee',   name: 'Melee DPS',       color: 'var(--role-melee)',   jobs: [['MNK', 88], ['DRG', 100], ['NIN', 70], ['SAM', 100], ['RPR', 90], ['VPR', 100]] },
    { key: 'pranged', name: 'Physical Ranged', color: 'var(--role-pranged)', jobs: [['BRD', 100], ['MCH', 85], ['DNC', 100]] },
    { key: 'mranged', name: 'Magical Ranged',  color: 'var(--role-mranged)', jobs: [['BLM', 100], ['SMN', 92], ['RDM', 100], ['PCT', 100]] },
    { key: 'craft',   name: 'Crafters',        color: 'var(--role-craft)',   jobs: [['CRP', 90], ['BSM', 90], ['ARM', 90], ['GSM', 90], ['LTW', 90], ['WVR', 90], ['ALC', 90], ['CUL', 90]] },
    { key: 'gather',  name: 'Gatherers',       color: 'var(--role-gather)',  jobs: [['MIN', 100], ['BTN', 100], ['FSH', 82]] },
  ],
}
