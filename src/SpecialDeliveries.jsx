import { useEffect, useMemo, useState } from 'react'
import ActivityNav from './ActivityNav'
import { useSyncedState } from './syncedState'
import {
  CUSTOM_DELIVERIES,
  CUSTOM_DELIVERY_CLIENT_LIMIT,
  CUSTOM_DELIVERY_WEEKLY_LIMIT,
  SPECIAL_DELIVERIES_KEY,
  deliveryUsage,
  nextCustomDeliveryReset,
  normalizeSpecialDeliveriesState,
} from './specialDeliveriesData'
import './SpecialDeliveries.css'

const I = {
  check: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>),
  minus: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}><path d="M6 12h12"/></svg>),
  plus: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>),
  timer: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 13l3-3"/></svg>),
}

function fmtCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days) return `${days}d ${hours}h ${minutes}m`
  if (hours) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default function SpecialDeliveries() {
  const [now, setNow] = useState(() => new Date())
  const [saved, setSaved] = useSyncedState(SPECIAL_DELIVERIES_KEY, normalizeSpecialDeliveriesState(null))

  useEffect(() => {
    document.body.classList.add('special-deliveries-page')
    return () => document.body.classList.remove('special-deliveries-page')
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const state = useMemo(() => normalizeSpecialDeliveriesState(saved, now), [saved, now])
  useEffect(() => {
    if (JSON.stringify(state) !== JSON.stringify(saved)) setSaved(state)
  }, [state, saved, setSaved])

  const usage = deliveryUsage(state)
  const nextReset = nextCustomDeliveryReset(now)
  const setCount = (clientId, count) => {
    setSaved((prev) => {
      const clean = normalizeSpecialDeliveriesState(prev, new Date())
      return {
        ...clean,
        counts: {
          ...clean.counts,
          [clientId]: Math.max(0, Math.min(CUSTOM_DELIVERY_CLIENT_LIMIT, count)),
        },
      }
    })
  }
  const resetAll = () => setSaved(normalizeSpecialDeliveriesState(null, new Date()))

  return (
    <main className="sd-shell">
      <ActivityNav />
      <header className="sd-head">
        <div>
          <p className="sd-kicker">Crafting Guide</p>
          <h1>Special Deliveries</h1>
        </div>
        <div className="sd-timer">
          <I.timer />
          <span>Resets in</span>
          <strong>{fmtCountdown(nextReset - now)}</strong>
        </div>
      </header>

      <section className="sd-summary">
        <div>
          <span>Weekly allowances</span>
          <strong>{usage.remaining} / {CUSTOM_DELIVERY_WEEKLY_LIMIT} left</strong>
        </div>
        <div>
          <span>Completed</span>
          <strong>{usage.used}</strong>
        </div>
        <button type="button" onClick={resetAll}>Clear Week</button>
      </section>

      <section className="sd-list" aria-label="Special delivery clients">
        {CUSTOM_DELIVERIES.map((client) => {
          const count = state.counts[client.id] || 0
          const complete = count >= CUSTOM_DELIVERY_CLIENT_LIMIT
          return (
            <article className={`sd-card${complete ? ' is-complete' : ''}`} key={client.id}>
              <div className="sd-card__main">
                <div className="sd-card__meta">
                  <span>Lv {client.level}</span>
                  <span>Patch {client.patch}</span>
                </div>
                <h2>{client.name}</h2>
                <p>{client.zone} - {client.coords}</p>
              </div>
              <div className="sd-stepper" aria-label={`${client.name} deliveries`}>
                <button type="button" onClick={() => setCount(client.id, count - 1)} aria-label="Decrease">
                  <I.minus />
                </button>
                <strong>{count}</strong>
                <span>/ {CUSTOM_DELIVERY_CLIENT_LIMIT}</span>
                <button type="button" onClick={() => setCount(client.id, count + 1)} aria-label="Increase">
                  <I.plus />
                </button>
              </div>
              <button
                type="button"
                className={`sd-done${complete ? ' is-active' : ''}`}
                onClick={() => setCount(client.id, complete ? 0 : CUSTOM_DELIVERY_CLIENT_LIMIT)}
              >
                <I.check />
                {complete ? 'Done' : 'Mark Done'}
              </button>
            </article>
          )
        })}
      </section>
    </main>
  )
}
