import MuscleHeatmapBody from './MuscleHeatmapBody'
import WorkoutMotivationBanner from './WorkoutMotivationBanner'
import { toDateString } from '../lib/habitLogic'

export default function WorkoutTab({ actions, authUserId, isReadOnly, globalData }) {
  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione workout non disponibile</div>
  }

  const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 12,
    width: '100%', padding: '14px 18px', marginBottom: 8,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, cursor: 'pointer', color: 'var(--text)',
    fontSize: '0.92em', fontWeight: 600, textAlign: 'left',
  }

  const exercises = (globalData?.quickExercises || []).filter(e => e.active !== false)
  const todayStr  = toDateString(new Date())
  const todayLog  = globalData?.exerciseLog?.[todayStr] || []

  function todayRepsFor(exId) {
    return todayLog.filter(s => s.exerciseId === exId).reduce((a, s) => a + s.reps, 0)
  }

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Banner motivazionale — sempre visibile, in cima alla pagina */}
      <WorkoutMotivationBanner
        exerciseLog={globalData?.exerciseLog || {}}
        quickExercises={globalData?.quickExercises || []}
      />

      {/* Muscle heatmap */}
      <MuscleHeatmapBody
        exerciseLog={globalData?.exerciseLog || {}}
        quickExercises={globalData?.quickExercises || []}
      />

      {/* Action buttons */}
      <button style={btnStyle} onClick={() => actions.openModal('quickExercise')}>
        <span className="material-icons-round" style={{ color: 'var(--theme-color)', fontSize: 22 }}>fitness_center</span>
        Allenamento rapido
      </button>
      <button style={btnStyle} onClick={() => actions.openModal('weight')}>
        <span className="material-icons-round" style={{ color: 'var(--theme-color)', fontSize: 22 }}>monitor_weight</span>
        Peso corporeo
      </button>
      <button style={btnStyle} onClick={() => actions.openModal('exerciseStats')}>
        <span className="material-icons-round" style={{ color: 'var(--theme-color)', fontSize: 22 }}>bar_chart</span>
        Statistiche esercizi
      </button>

      {/* Per-exercise clickable list */}
      {exercises.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: '0.62em', color: '#555', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>
            I tuoi esercizi
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {exercises.map(ex => {
              const todayReps = todayRepsFor(ex.id)
              return (
                <button
                  key={ex.id}
                  onClick={() => actions.openModal('exerciseSingle', { exerciseId: ex.id })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '11px 14px',
                    background: 'var(--card)', border: '1px solid var(--card-border)',
                    borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '1.4em', flexShrink: 0 }}>{ex.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88em', color: 'var(--text)' }}>{ex.name}</div>
                    <div style={{ fontSize: '0.65em', color: 'var(--theme-color)', fontWeight: 600 }}>
                      {parseFloat(ex.pointsPerRep)} pt/rep
                    </div>
                  </div>
                  {todayReps > 0 && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.88em', fontWeight: 900, color: 'var(--theme-color)' }}>{todayReps}</div>
                      <div style={{ fontSize: '0.55em', color: '#666' }}>oggi</div>
                    </div>
                  )}
                  <span className="material-icons-round" style={{ fontSize: 16, color: '#444', flexShrink: 0 }}>chevron_right</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
