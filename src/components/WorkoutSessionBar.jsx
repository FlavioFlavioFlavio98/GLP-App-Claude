import { useEffect, useState } from 'react'
import { getActiveWorkoutSession } from '../lib/workoutStats'

export default function WorkoutSessionBar({ onEndSession }) {
  const [session, setSession] = useState(() => getActiveWorkoutSession())

  useEffect(() => {
    const id = setInterval(() => setSession(getActiveWorkoutSession()), 5000)
    return () => clearInterval(id)
  }, [])

  if (!session) return null

  const minutes = Math.max(0, Math.round((Date.now() - session.startedAt) / 60000))

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 12, marginBottom: 12,
      background: 'rgba(255,202,40,0.06)', border: '1px solid rgba(255,202,40,0.25)',
    }}>
      <span style={{ fontSize: '1.1em' }}>🏋️</span>
      <div style={{ flex: 1, fontSize: '0.78em', color: 'var(--text-sec)' }}>
        Sessione in corso da <strong style={{ color: 'var(--theme-color)' }}>{minutes} min</strong>
      </div>
      <button
        onClick={() => onEndSession(session)}
        style={{
          padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: '0.72em', fontWeight: 700,
          background: 'transparent', border: '1px solid var(--theme-color)', color: 'var(--theme-color)',
        }}
      >
        Termina sessione
      </button>
    </div>
  )
}
