import { useEffect, useMemo, useState } from 'react'
import ActivityNav from './ActivityNav'
import { CRAFTING_GEAR } from './craftingGearData'
import './CraftingGear.css'

const JOBS = ['All', 'CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL']
const SOURCES = ['All', 'Gil', 'Scrip', 'Crafted']
const LEVELS = ['All', '100', '90+', '80+', '70+']

const I = {
  search: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>),
  coin: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h3.2a1.4 1.4 0 0 1 0 2.8h-1.5a1.4 1.4 0 0 0 0 2.8h3.3"/></svg>),
  spark: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/></svg>),
}

function sourceLabel(row) {
  if (row.vendor) return `${row.vendor.price.toLocaleString()} gil`
  if (row.scrip) return `${row.scrip.price.toLocaleString()} ${row.scrip.currency}`
  return 'Crafted / market board'
}

function sourceWhere(row) {
  const source = row.vendor || row.scrip
  if (!source) return null
  return [source.npc, source.zone, source.coords].filter(Boolean).join(' - ')
}

export default function CraftingGear() {
  const [query, setQuery] = useState('')
  const [job, setJob] = useState('All')
  const [source, setSource] = useState('All')
  const [level, setLevel] = useState('90+')

  useEffect(() => {
    document.body.classList.add('crafting-gear-page')
    return () => document.body.classList.remove('crafting-gear-page')
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CRAFTING_GEAR.filter((row) => {
      if (q && !row.name.toLowerCase().includes(q)) return false
      if (job !== 'All' && !row.jobs.includes(job)) return false
      if (level !== 'All') {
        const min = level === '100' ? 100 : Number.parseInt(level, 10)
        if (level === '100' ? row.level !== 100 : row.level < min) return false
      }
      if (source === 'Gil' && !row.vendor) return false
      if (source === 'Scrip' && !row.scrip) return false
      if (source === 'Crafted' && (row.vendor || row.scrip)) return false
      return true
    }).slice(0, 250)
  }, [query, job, source, level])

  return (
    <main className="gear-shell">
      <ActivityNav />
      <header className="gear-head">
        <div>
          <p className="gear-kicker">Crafting Gear</p>
          <h1>Gear Sources</h1>
        </div>
        <div className="gear-count">{visible.length.toLocaleString()} shown</div>
      </header>

      <section className="gear-controls" aria-label="Crafting gear filters">
        <label className="gear-search">
          <I.search />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search gear" />
        </label>
        <select value={job} onChange={(e) => setJob(e.target.value)} aria-label="Job">
          {JOBS.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level">
          {LEVELS.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          {SOURCES.map((value) => <option key={value}>{value}</option>)}
        </select>
      </section>

      <section className="gear-list" aria-label="Crafting gear results">
        {visible.map((row) => (
          <article className="gear-card" key={row.id}>
            <div className="gear-card__main">
              <div className="gear-card__top">
                <span className="gear-slot">{row.slot}</span>
                <span>Lv {row.level}</span>
              </div>
              <h2>{row.name}</h2>
              <div className="gear-jobs">{row.jobs.join(' ')}</div>
            </div>
            <div className="gear-stats">
              <span>Craft <b>{row.stats.craftsmanship}</b></span>
              <span>Ctrl <b>{row.stats.control}</b></span>
              <span>CP <b>{row.stats.cp}</b></span>
            </div>
            <div className={`gear-source${row.scrip ? ' is-scrip' : row.vendor ? ' is-gil' : ''}`}>
              {row.scrip ? <I.spark /> : <I.coin />}
              <div>
                <strong>{sourceLabel(row)}</strong>
                {sourceWhere(row) && <span>{sourceWhere(row)}</span>}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
