import { detectPlateau } from '../lib/workoutStats'

export default function WorkoutPlateauAlert({ exerciseLog, quickExercises }) {
  const exercises = (quickExercises || []).filter(e => e.active !== false)
  const plateaus = exercises
    .map(ex => ({ ex, info: detectPlateau(exerciseLog, ex.id) }))
    .filter(({ info }) => info && info.isPlateau)

  if (plateaus.length === 0) return null

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: '0.65em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>
        ⚠️ Possibili plateau
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plateaus.map(({ ex, info }) => (
          <div key={ex.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: 'rgba(239,159,39,0.08)', border: '1px solid rgba(239,159,39,0.3)', borderRadius: 12,
          }}>
            <span style={{ fontSize: '1.3em' }}>{ex.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.85em', color: '#EF9F27' }}>{ex.name} fermo da un po'</div>
              <div style={{ fontSize: '0.68em', color: '#888' }}>
                Media ultime {info.sessionsAnalyzed} sessioni: {info.recentAvg} reps (era {info.previousAvg}) — prova ad aumentare reps o carico
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
