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

function loadStatusOverrides() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

export default function App() {
  const [hunts, setHunts] = useState([])
  const [overrides, setOverrides] = useState(loadStatusOverrides)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  const doneCount = huntsWithStatus.filter((h) => h.status === 'done').length

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

      <main className="hunt-grid">
        {huntsWithStatus.map((hunt) => (
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
    </div>
  )
}
