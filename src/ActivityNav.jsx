import { useState, useEffect, useRef } from 'react'
import './ActivityNav.css'

const ACTIVITIES = [
  {
    id: 'hunts',
    label: 'Hunts',
    href: '/',
    soon: false,
    icon: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d="M12 2 4 5v6c0 5 3.4 8.3 8 11 4.6-2.7 8-6 8-11V5l-8-3Z"/>
        <path d="M12 7v8M8.5 10.5 12 7l3.5 3.5"/>
      </svg>
    ),
  },
  {
    id: 'fishing',
    label: 'Fishing',
    href: '/fishing',
    soon: false,
    icon: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d="M3 12c3-5 8-6 12-6 3 0 5 2 6 6-1 4-3 6-6 6-4 0-9-1-12-6Z"/>
        <path d="M3 12c-1 1.5-1 3 0 4.5M3 12c-1-1.5-1-3 0-4.5"/>
        <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 'gathering',
    label: 'Gathering',
    href: '/gathering',
    soon: true,
    icon: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d="M12 22V12M12 12 7 7M12 12l5-5"/>
        <path d="M3 7c0-2.2 4-4 9-4s9 1.8 9 4-4 4-9 4-9-1.8-9-4Z"/>
        <path d="M3 12c0 2.2 4 4 9 4s9-1.8 9-4"/>
        <path d="M3 17c0 2.2 4 4 9 4s9-1.8 9-4"/>
      </svg>
    ),
  },
  {
    id: 'crafting',
    label: 'Crafting',
    href: '/crafting',
    soon: true,
    icon: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d="m14.7 6.3-8 8a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l8-8-3-3Z"/>
        <path d="m16 2 6 6-2 2-6-6 2-2ZM4 20l1-4 3 3-4 1Z"/>
      </svg>
    ),
  },
  {
    id: 'treasure',
    label: 'Treasure',
    href: '/treasure',
    soon: true,
    icon: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d="M4 9v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/>
        <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6Z"/>
        <path d="M12 12v4"/>
      </svg>
    ),
  },
]

const ChevronDown = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m6 9 6 6 6-6"/>
  </svg>
)

export default function ActivityNav() {
  const path = window.location.pathname
  const current = ACTIVITIES.find((a) => {
    if (a.href === '/') return path === '/' || path === ''
    return path.startsWith(a.href)
  }) || ACTIVITIES[0]

  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClick(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const CurrentIcon = current.icon

  return (
    <div className="act-nav" ref={ref}>
      <button className={`act-nav__trigger${open ? ' is-open' : ''}`} onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
        <CurrentIcon className="act-nav__ico" />
        <span className="act-nav__label">{current.label}</span>
        <ChevronDown className="act-nav__chevron" />
      </button>

      {open && (
        <div className="act-nav__menu" role="menu">
          {ACTIVITIES.map((a) => {
            const Icon = a.icon
            const isActive = a.id === current.id
            return (
              <a
                key={a.id}
                className={`act-nav__item${isActive ? ' is-active' : ''}${a.soon ? ' is-soon' : ''}`}
                href={a.soon ? undefined : a.href}
                role="menuitem"
                onClick={a.soon ? (e) => e.preventDefault() : () => setOpen(false)}
                aria-disabled={a.soon}
              >
                <Icon className="act-nav__item-ico" />
                <span className="act-nav__item-label">{a.label}</span>
                {a.soon && <span className="act-nav__soon">Soon</span>}
                {isActive && <span className="act-nav__active-dot" />}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
