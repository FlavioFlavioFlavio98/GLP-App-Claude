import { useEffect, useRef, useState } from 'react'

/**
 * Non-blocking achievement unlock overlay.
 * Renders at the bottom of the screen, auto-dismisses after 3.5s.
 * Queues multiple achievements.
 *
 * Usage: <AchievementOverlay queue={[...defs]} onDismiss={fn} />
 */
export default function AchievementOverlay({ achievement, onDone }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!achievement) return
    // Trigger haptic
    if (navigator.vibrate) navigator.vibrate([50, 80, 50])
    // Confetti
    import('canvas-confetti').then(m => {
      m.default({ particleCount: 80, spread: 70, origin: { y: 0.9 }, zIndex: 10000 })
    })
    // Show
    requestAnimationFrame(() => setVisible(true))
    timerRef.current = setTimeout(() => {
      setExiting(true)
      setTimeout(() => { setVisible(false); setExiting(false); onDone?.() }, 400)
    }, 3500)
    return () => clearTimeout(timerRef.current)
  }, [achievement])

  if (!achievement || !visible) return null

  return (
    <div
      style={{
        position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, width: 'min(360px, 92vw)',
        background: 'var(--card-solid)', border: '1px solid var(--theme-color)',
        borderRadius: 20, padding: '20px 24px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px var(--theme-glow)',
        display: 'flex', alignItems: 'center', gap: 16,
        animation: exiting ? 'achievement-out 0.4s ease forwards' : 'achievement-in 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: '2.8em', lineHeight: 1, flexShrink: 0 }}>{achievement.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.68em', color: 'var(--theme-color)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 2 }}>
          Achievement sbloccato! 🎉
        </div>
        <div style={{ fontWeight: 800, fontSize: '1.1em', color: 'var(--text)', marginBottom: 2 }}>
          {achievement.name}
        </div>
        <div style={{ fontSize: '0.78em', color: '#777' }}>{achievement.desc}</div>
      </div>
    </div>
  )
}

/** Manages a queue of achievements, showing them one at a time */
export function AchievementQueue({ queue, onClear }) {
  const [current, setCurrent] = useState(null)
  const queueRef = useRef([])

  useEffect(() => {
    if (queue.length > 0) {
      queueRef.current = [...queueRef.current, ...queue]
      onClear?.()
      if (!current) showNext()
    }
  }, [queue])

  function showNext() {
    if (queueRef.current.length === 0) { setCurrent(null); return }
    const next = queueRef.current.shift()
    setCurrent(next)
  }

  if (!current) return null
  return <AchievementOverlay achievement={current} onDone={showNext} />
}
