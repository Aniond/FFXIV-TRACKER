import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'ffxiv-hunt-status'

const STATUS_CYCLE = {
  todo: 'in-progress',
  'in-progress': 'done',
  done: 'todo',
}

const STATUS_LABEL = {
  todo: 'To do',
  'in-progress': 'In progress',
  done: 'Done',
}

const STATUS_ORDER = ['todo', 'in-progress', 'done']

const DEFAULT_FILTERS = { rank: 'all', status: 'all', type: 'all' }

function loadStatusOverrides() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function FilterRow({ label, options, value, onChange }) {
  return (
    <div className="filter-row">
      <span className="filter-row__label">{label}</span>
      <div className="filter-row__options">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`filter-pill${value === opt.value ? ' is-active' : ''}`}
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [hunts, setHunts] = useState([])
  const [overrides, setOverrides] = useState(loadStatusOverrides)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  useEffect(() => {
    fetch('/data.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load data.json (${res.status})`)
        return res.json()
      })
      .then((data) => setHunts(data.hunts ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  }, [overrides])

  const huntsWithStatus = useMemo(
    () =>
      hunts.map((hunt) => ({
        ...hunt,
        status: overrides[hunt.id] ?? hunt.status ?? 'todo',
      })),
    [hunts, overrides]
  )

  // Filter options are generated dynamically from whatever exists in the data.
  const rankOptions = useMemo(() => {
    const ranks = [...new Set(hunts.map((h) => h.rank).filter(Boolean))].sort()
    return [{ value: 'all', label: 'All' }, ...ranks.map((r) => ({ value: r, label: r }))]
  }, [hunts])

  const typeOptions = useMemo(() => {
    const types = [...new Set(hunts.map((h) => h.type).filter(Boolean))].sort()
    return [{ value: 'all', label: 'All' }, ...types.map((t) => ({ value: t, label: t }))]
  }, [hunts])

  // Status options follow a fixed lifecycle order, not data order.
  const statusOptions = useMemo(() => {
    const present = new Set(huntsWithStatus.map((h) => h.status))
    return [
      { value: 'all', label: 'All' },
      ...STATUS_ORDER.filter((s) => present.has(s)).map((s) => ({
        value: s,
        label: STATUS_LABEL[s],
      })),
    ]
  }, [huntsWithStatus])

  const filteredHunts = useMemo(
    () =>
      huntsWithStatus.filter(
        (h) =>
          (filters.rank === 'all' || h.rank === filters.rank) &&
          (filters.status === 'all' || h.status === filters.status) &&
          (filters.type === 'all' || h.type === filters.type)
      ),
    [huntsWithStatus, filters]
  )

  const doneCount = huntsWithStatus.filter((h) => h.status === 'done').length
  const filtersActive =
    filters.rank !== 'all' || filters.status !== 'all' || filters.type !== 'all'

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function cycleStatus(id, current) {
    setOverrides((prev) => ({ ...prev, [id]: STATUS_CYCLE[current] ?? 'todo' }))
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>FFXIV Hunt Tracker</h1>
        <p className="subtitle">
          {huntsWithStatus.length > 0
            ? `${doneCount} / ${huntsWithStatus.length} hunts complete`
            : 'Track your hunt marks'}
        </p>
      </header>

      {loading && <p className="message">Loading hunts…</p>}
      {error && <p className="message error">⚠ {error}</p>}

      {huntsWithStatus.length > 0 && (
        <section className="filters" aria-label="Filter hunts">
          <FilterRow
            label="Rank"
            options={rankOptions}
            value={filters.rank}
            onChange={(v) => setFilter('rank', v)}
          />
          <FilterRow
            label="Status"
            options={statusOptions}
            value={filters.status}
            onChange={(v) => setFilter('status', v)}
          />
          <FilterRow
            label="Type"
            options={typeOptions}
            value={filters.type}
            onChange={(v) => setFilter('type', v)}
          />
          <div className="filters__footer">
            <span className="filters__count">
              Showing {filteredHunts.length} of {huntsWithStatus.length}
            </span>
            {filtersActive && (
              <button
                type="button"
                className="filters__reset"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                Reset filters
              </button>
            )}
          </div>
        </section>
      )}

      <main className="hunt-grid">
        {filteredHunts.map((hunt) => (
          <article key={hunt.id} className={`hunt-card status-${hunt.status}`}>
            <div className="hunt-card__top">
              <span className={`rank rank-${hunt.rank}`}>{hunt.rank}</span>
              <div className="hunt-title">
                <h2>{hunt.name}</h2>
                <span className="hunt-type">{hunt.type}</span>
              </div>
              <button
                type="button"
                className="status-toggle"
                onClick={() => cycleStatus(hunt.id, hunt.status)}
              >
                {STATUS_LABEL[hunt.status]}
              </button>
            </div>

            <dl className="hunt-meta">
              <div>
                <dt>Zone</dt>
                <dd>{hunt.zone}</dd>
              </div>
              <div>
                <dt>Area</dt>
                <dd>{hunt.area}</dd>
              </div>
              <div>
                <dt>Coords</dt>
                <dd>
                  {hunt.coords}
                  {hunt.coordsNote && <span className="note"> · {hunt.coordsNote}</span>}
                </dd>
              </div>
              <div>
                <dt>Targets</dt>
                <dd>{hunt.targets}</dd>
              </div>
              <div>
                <dt>Bill</dt>
                <dd>{hunt.billNumber} · {hunt.authority}</dd>
              </div>
              <div>
                <dt>Reward</dt>
                <dd>{hunt.reward}</dd>
              </div>
            </dl>

            {hunt.tips?.length > 0 && (
              <ul className="hunt-tips">
                {hunt.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </main>

      {!loading && !error && huntsWithStatus.length === 0 && (
        <p className="message">No hunts found in data.json.</p>
      )}
      {!loading && !error && huntsWithStatus.length > 0 && filteredHunts.length === 0 && (
        <p className="message">No hunts match the current filters.</p>
      )}
    </div>
  )
}
