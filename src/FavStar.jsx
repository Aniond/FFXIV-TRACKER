import { useState, useEffect } from 'react'
import { isFav, toggleFav } from './favNodes'
import { hydrateFromServer, HYDRATED_EVENT } from './syncedState'
import './FavStar.css'

/* Self-contained star toggle for a gathering node. Manages its own
   localStorage state so it can drop into any card without prop threading.
   Stars surface on the dashboard's Favorited Timers rail. */
export default function FavStar({ id, title = 'Favorite' }) {
  const [on, setOn] = useState(() => isFav(id))
  // Stars are account-synced; re-read once the server copy hydrates.
  useEffect(() => {
    hydrateFromServer()
    const onHydrated = () => setOn(isFav(id))
    window.addEventListener(HYDRATED_EVENT, onHydrated)
    return () => window.removeEventListener(HYDRATED_EVENT, onHydrated)
  }, [id])
  return (
    <button
      type="button"
      className={`favstar${on ? ' is-on' : ''}`}
      aria-pressed={on}
      title={on ? 'Remove from dashboard timers' : title}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOn(toggleFav(id)) }}
    >
      <svg viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l2.6 6.2 6.4.5-4.9 4.1 1.5 6.2L12 16.9 6.4 20.2l1.5-6.2L3 9.7l6.4-.5L12 3Z"/>
      </svg>
    </button>
  )
}
