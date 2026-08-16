import { useMemo } from 'react'
import { getDaysSinceLastRecord } from '../lib/workoutStats'

export default function WorkoutRecordFreshness({ exerciseLog, quickExercises }) {
  const rows = useMemo(() => {
    return (quickExercises || [])
      .filter(ex => ex.active !== false)
      .map(ex => ({ exercise: ex, status: getDaysSinceLastRecord(exerciseLog, ex.id) }))
      .filter(r => r.status !== null)
      .sort((a, b) => b.status.days - a.status.days) // più "stantii" prima, spingono a riprovare
  }, [exerciseLog, quickExercises])

  if (rows.length === 0) return null

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
        ⏳ Da quanto non batti un record
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(({ exercise, status }) => (
          <div key={exercise.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.1em' }}>{exercise.emoji}</span>
            <div style={{ flex: 1, fontSize: '0.82em', color: 'var(--text)' }}>{exercise.name}</div>
            {status.days === 0 ? (
              <span style={{ fontSize: '0.75em', fontWeight: 700, color: 'var(--theme-color)' }}>🏆 record oggi!</span>
            ) : (
              <span style={{ fontSize: '0.75em', color: status.days >= 30 ? '#e53935' : '#888' }}>
                nessun record da {status.days} giorn{status.days === 1 ? 'o' : 'i'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
