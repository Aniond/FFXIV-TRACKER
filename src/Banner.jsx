import { useMemo } from 'react'
import './Banner.css'

/* ============================================================
   Banner — Centurio Ledger site header
   Self-contained: colors are literal + scoped to .cl-banner, so it
   renders identically regardless of the app's active accent Tweak.
   Fonts (Cinzel, Manrope) are already loaded by the app.
   ============================================================ */

const CrestPath = () => (
  <>
    <path d="M12 2 4 5v6c0 5 3.4 8.3 8 11 4.6-2.7 8-6 8-11V5l-8-3Z" />
    <path d="M12 7v8M8.5 10.5 12 7l3.5 3.5" />
  </>
)

const Corner = ({ cls }) => (
  <div className={`cl-corner ${cls}`} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 10V2h8M2 6c6 0 14 8 14 14" />
    </svg>
  </div>
)

export default function Banner() {
  const motes = useMemo(
    () =>
      Array.from({ length: 14 }, () => {
        const dur = 9 + Math.random() * 10
        const sc = 0.6 + Math.random() * 1.4
        return {
          left: `${Math.random() * 100}%`,
          animationDuration: `${dur}s`,
          animationDelay: `${-Math.random() * dur}s`,
          transform: `scale(${sc})`,
          opacity: (0.3 + Math.random() * 0.5).toFixed(2),
        }
      }),
    []
  )

  return (
    <div className="cl-banner" role="img" aria-label="Centurio Ledger — Final Fantasy XIV Hunt Tracker">
      <div className="cl-watermark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round">
          <CrestPath />
        </svg>
      </div>

      <div className="cl-motes" aria-hidden="true">
        {motes.map((s, i) => (
          <span key={i} className="cl-mote" style={s} />
        ))}
      </div>

      <div className="cl-frame" aria-hidden="true"></div>
      <Corner cls="tl" />
      <Corner cls="tr" />
      <Corner cls="bl" />
      <Corner cls="br" />

      <div className="cl-content">
        <div className="cl-crest">
          <div className="cl-crest__glow" aria-hidden="true"></div>
          <div className="cl-crest__rim" aria-hidden="true"></div>
          <div className="cl-crest__ticks" aria-hidden="true"></div>
          <div className="cl-crest__disc">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              <CrestPath />
            </svg>
          </div>
        </div>

        <div className="cl-word">
          <div className="cl-word__eyebrow"><span className="ln"></span>The Hunt Board</div>
          <h1 className="cl-word__title">CENTURIO&nbsp;LEDGER</h1>
          <div className="cl-word__divider"><span className="dot"></span><span className="ln"></span></div>
          <div className="cl-word__sub"><b>Final Fantasy XIV</b> · Hunt Tracker &amp; Field Ledger</div>
        </div>
      </div>
    </div>
  )
}
