import { useEffect, useRef, useState } from 'react'
import { getActiveRestTimer, cancelRestTimer, adjustRestTimer, playRestFinishedAlert } from '../lib/workoutStats'

export default function WorkoutRestTimer() {
  const [timer, setTimer] = useState(() => getActiveRestTimer())
  const alertedRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => {
      const t = getActiveRestTimer()
      setTimer(t)
      if (t?.finished) {
        if (!alertedRef.current) { alertedRef.current = true; playRestFinishedAlert() }
      } else {
        alertedRef.current = false
      }
    }, 500)
    return () => clearInterval(id)
  }, [])

  if (!timer) return null

  const remaining = Math.ceil(timer.remaining)
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const pct = timer.duration > 0 ? Math.max(0, Math.min(100, (timer.remaining / timer.duration) * 100)) : 0

  function dismiss() {
    cancelRestTimer()
    setTimer(null)
    alertedRef.current = false
  }

  function adjust(delta) {
    setTimer(adjustRestTimer(delta))
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderRadius: 14, marginBottom: 12,
      background: timer.finished ? 'rgba(76,175,80,0.12)' : 'var(--card)',
      border: `1px solid ${timer.finished ? 'var(--success, #4caf50)' : 'var(--card-border)'}`,
      transition: 'background 0.3s, border-color 0.3s',
    }}>
      <div style={{ position: 'relative', width: 46, height: 46, flexShrink: 0 }}>
        <svg width="46" height="46" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="23" cy="23" r="19" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle
            cx="23" cy="23" r="19" fill="none"
            stroke={timer.finished ? 'var(--success, #4caf50)' : 'var(--theme-color)'}
            strokeWidth="4" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 19}
            strokeDashoffset={2 * Math.PI * 19 * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 0.4s linear' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.85em',
        }}>
          {timer.finished ? '✅' : '⏱️'}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          {timer.finished ? 'Recupero terminato' : 'Recupero'}
        </div>
        <div style={{ fontSize: '1.4em', fontWeight: 900, color: timer.finished ? 'var(--success, #4caf50)' : 'var(--theme-color)', lineHeight: 1.2 }}>
          {timer.finished ? 'Pronto!' : `${mins}:${String(secs).padStart(2, '0')}`}
        </div>
      </div>

      {!timer.finished && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => adjust(-15)} className="btn-icon" title="-15s" style={{ fontSize: '0.7em' }}>-15s</button>
          <button onClick={() => adjust(15)} className="btn-icon" title="+15s" style={{ fontSize: '0.7em' }}>+15s</button>
        </div>
      )}
      <button onClick={dismiss} className="btn-icon" title="Chiudi">
        <span className="material-icons-round" style={{ fontSize: 18, color: '#888' }}>close</span>
      </button>
    </div>
  )
}
