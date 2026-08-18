import { useEffect, useState } from 'react'
import { useApp } from '../lib/store'
import MuscleHeatmapBody from './MuscleHeatmapBody'
import WorkoutMotivationBanner from './WorkoutMotivationBanner'
import WorkoutGoalProgress from './WorkoutGoalProgress'
import WorkoutRestTimer from './WorkoutRestTimer'
import WorkoutEffortChart from './WorkoutEffortChart'
import WorkoutSessionBar from './WorkoutSessionBar'
import WorkoutSessionSummary from './WorkoutSessionSummary'
import WorkoutHeatmap from './WorkoutHeatmap'
import WorkoutRecordFreshness from './WorkoutRecordFreshness'
import WorkoutPlateauAlert from './WorkoutPlateauAlert'
import WorkoutDaySummary from './WorkoutDaySummary'
import { toDateString } from '../lib/habitLogic'
import { getUnseenExpiredSession, markSessionSeen, endWorkoutSession, computeSessionSummary } from '../lib/workoutStats'

export default function WorkoutTab({ actions, authUserId, isReadOnly, globalData }) {
  const [sessionSummary, setSessionSummary] = useState(null)
  const { state } = useApp()

  const exerciseLog = globalData?.exerciseLog || {}
  const quickExercises = globalData?.quickExercises || []
  const todayStr = toDateString(new Date())
  const viewDate = state.viewDate || todayStr
  const isToday = viewDate === todayStr

  // Se l'ultima sessione è scaduta per inattività e non è mai stata mostrata,
  // proponi il riepilogo anche se l'utente non ha premuto "Termina sessione"
  useEffect(() => {
    if (authUserId !== 'flavio' || isReadOnly) return
    const expired = getUnseenExpiredSession()
    if (expired) {
      const summary = computeSessionSummary(exerciseLog, quickExercises, expired, expired.lastActivityAt)
      markSessionSeen(expired)
      setSessionSummary(summary)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione workout non disponibile</div>
  }

  function handleEndSession(session) {
    const endedAt = Date.now()
    const summary = computeSessionSummary(exerciseLog, quickExercises, session, endedAt)
    endWorkoutSession()
    markSessionSeen(session)
    setSessionSummary(summary)
  }

  const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 12,
    width: '100%', padding: '14px 18px', marginBottom: 8,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, cursor: 'pointer', color: 'var(--text)',
    fontSize: '0.92em', fontWeight: 600, textAlign: 'left',
  }

  const exercises = quickExercises.filter(e => e.active !== false)
  const dayLog = exerciseLog[viewDate] || []

  function dayRepsFor(exId) {
    return dayLog.filter(s => s.exerciseId === exId).reduce((a, s) => a + s.reps, 0)
  }

  return (
    <div style={{ paddingTop: 8 }}>
      {sessionSummary && (
        <WorkoutSessionSummary summary={sessionSummary} onClose={() => setSessionSummary(null)} />
      )}

      {isToday ? (
        <>
          {/* Sessione attiva — bottone "Termina sessione" */}
          <WorkoutSessionBar onEndSession={handleEndSession} />

          {/* Banner motivazionale — sempre visibile, in cima alla pagina */}
          <WorkoutMotivationBanner
            exerciseLog={exerciseLog}
            quickExercises={quickExercises}
          />

          {/* Obiettivo di sforzo giornaliero */}
          <WorkoutGoalProgress exerciseLog={exerciseLog} />

          {/* Timer di recupero — visibile solo se un countdown è attivo */}
          <WorkoutRestTimer />
        </>
      ) : (
        // Sessione/banner/obiettivo/timer sono concetti "live", inutili su un
        // giorno passato — al loro posto, cosa si è allenato quel giorno.
        <WorkoutDaySummary
          exerciseLog={exerciseLog}
          quickExercises={quickExercises}
          dateStr={viewDate}
          actions={actions}
        />
      )}

      {/* Muscle heatmap */}
      <MuscleHeatmapBody
        exerciseLog={exerciseLog}
        quickExercises={quickExercises}
      />

      {/* Sforzo pesato nel tempo */}
      <WorkoutEffortChart exerciseLog={exerciseLog} />

      {/* Calendario/heatmap costanza allenamenti */}
      <WorkoutHeatmap exerciseLog={exerciseLog} />

      {/* Possibili plateau — esercizi fermi da un po' */}
      <WorkoutPlateauAlert exerciseLog={exerciseLog} quickExercises={quickExercises} />

      {/* Da quanto non batti un record, per esercizio */}
      <WorkoutRecordFreshness exerciseLog={exerciseLog} quickExercises={quickExercises} />

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
              const dayReps = dayRepsFor(ex.id)
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
                  {dayReps > 0 && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.88em', fontWeight: 900, color: 'var(--theme-color)' }}>{dayReps}</div>
                      <div style={{ fontSize: '0.55em', color: '#666' }}>{isToday ? 'oggi' : 'quel dì'}</div>
                    </div>
                  )}
                  <span className="material-icons-round" style={{ fontSize: 16, color: '#444', flexShrink: 0 }}>chevron_right</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* FAB — sempre raggiungibile per aggiungere una serie al volo, indipendentemente da dove si è scrollato */}
      <button
        onClick={() => actions.openModal('quickExercise')}
        title="Aggiungi serie"
        style={{
          position: 'fixed', right: 16, bottom: 76, zIndex: 900,
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--theme-color)', color: '#111',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        <span className="material-icons-round" style={{ fontSize: 28 }}>add</span>
      </button>
    </div>
  )
}
