import { useEffect, useRef, useState } from 'react'
import { THEMES } from '../lib/themes'

export default function SplashScreen({ correctPinLoaded, dataLoaded, forceHide, onHidden }) {
  const theme = THEMES[localStorage.getItem('glp_theme') || 'dark']
  const [progress, setProgress] = useState(0)
  const [fading, setFading] = useState(false)
  const [done, setDone] = useState(false)
  const progressRef = useRef(0)
  const rafRef = useRef(null)
  const hidingRef = useRef(false)

  function animateTo(target, duration, cb) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const from = progressRef.current
    const start = performance.now()
    function step(now) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - t) ** 2
      const val = from + (target - from) * eased
      progressRef.current = val
      setProgress(val)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        cb?.()
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }

  function hide() {
    if (hidingRef.current) return
    hidingRef.current = true
    animateTo(100, 300, () => {
      setFading(true)
      setTimeout(() => { setDone(true); onHidden?.() }, 320)
    })
  }

  // Phase 1: 0 → 38% on mount (simula connessione Firebase)
  useEffect(() => { animateTo(38, 1100) }, [])

  // Phase 2: 38 → 76% quando PIN caricato
  useEffect(() => {
    if (correctPinLoaded && !hidingRef.current) animateTo(76, 650)
  }, [correctPinLoaded])

  // Phase 3: 76 → 100% + fade out quando tutto pronto
  useEffect(() => {
    if (dataLoaded) hide()
  }, [dataLoaded])

  // Forza hide (es. mostra PIN screen)
  useEffect(() => {
    if (forceHide) hide()
  }, [forceHide])

  if (done) return null

  return (
    <div
      className={`splash-screen${fading ? ' splash-out' : ''}`}
      style={{ background: theme.bg }}
    >
      <div className="splash-content">
        <div className="splash-logo">🔥</div>
        <div className="splash-name" style={{ color: theme.themeColor }}>GLP</div>
        <div className="splash-sub">Gamification Life Project</div>
      </div>
      <div className="splash-bar-track">
        <div
          className="splash-bar-fill"
          style={{ width: `${progress}%`, background: theme.themeColor }}
        />
      </div>
    </div>
  )
}
