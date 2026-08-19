import { useEffect, useState } from 'react'
import { getActiveRestTimer, cancelRestTimer } from '../lib/workoutStats'

// Il suono dei beep è gestito a livello App (vedi App.jsx) così continua anche
// se l'utente naviga su un'altra tab — questo componente è solo la parte visiva,
// visibile solo nella tab Workout.
export default function WorkoutRestTimer() {
  const [timer, setTimer] = useState(() => getActiveRestTimer())

  useEffect(() => {
    const id = setInterval(() => setTimer(getActiveRestTimer()), 500)
    return () => clearInterval(id)
  }, [])

  if (!timer) return null

  const elapsed = Math.floor(timer.elapsed)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  // Progresso visivo dentro il minuto corrente (si riempie e riparte ad ogni beep)
  const pct = Math.max(0, Math.min(100, ((elapsed % timer.interval) / timer.interval) * 100))

  function dismiss() {
    cancelRestTimer()
    setTimer(null)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderRadius: 14, marginBottom: 12,
      background: 'var(--card)', border: '1px solid var(--card-border)',
    }}>
      <div style={{ position: 'relative', width: 46, height: 46, flexShrink: 0 }}>
        <svg width="46" height="46" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="23" cy="23" r="19" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle
            cx="23" cy="23" r="19" fill="none"
            stroke="var(--theme-color)"
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
          ⏱️
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          Recupero dall'ultima serie
        </div>
        <div style={{ fontSize: '1.4em', fontWeight: 900, color: 'var(--theme-color)', lineHeight: 1.2 }}>
          {mins}:{String(secs).padStart(2, '0')}
        </div>
        {timer.marksPassed > 0 && (
          <div style={{ fontSize: '0.68em', color: '#888', marginTop: 1 }}>
            🔔 {timer.marksPassed} beep — {timer.marksPassed} min senza nuove serie
          </div>
        )}
      </div>

      <button onClick={dismiss} className="btn-icon" title="Chiudi">
        <span className="material-icons-round" style={{ fontSize: 18, color: '#888' }}>close</span>
      </button>
    </div>
  )
}
