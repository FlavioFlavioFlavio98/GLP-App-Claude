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
import WorkoutMobilityStats from './WorkoutMobilityStats'
import WorkoutStudyStats from './WorkoutStudyStats'
import ActivityRateEditor from './ActivityRateEditor'
import { toDateString } from '../lib/habitLogic'
import { getUnseenExpiredSession, markSessionSeen, endWorkoutSession, computeSessionSummary, getMobilityRate, setMobilityRate, getStudyRate, setStudyRate, sortExercisesForQuickAdd } from '../lib/workoutStats'

export default function WorkoutTab({ actions, authUserId, isReadOnly, globalData }) {
  const [sessionSummary, setSessionSummary] = useState(null)
  const [dismissedRecordIds, setDismissedRecordIds] = useState(() => new Set())
  const { state } = useApp()

  const exerciseLog = globalData?.exerciseLog || {}
  const quickExercises = globalData?.quickExercises || []
  const mobilityLog = globalData?.mobilityLog || {}
  const studyLog = globalData?.studyLog || {}
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
    setDismissedRecordIds(new Set())
  }

  const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 12,
    width: '100%', padding: '14px 18px', marginBottom: 8,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, cursor: 'pointer', color: 'var(--text)',
    fontSize: '0.92em', fontWeight: 600, textAlign: 'left',
  }

  // Esercizi già fatti oggi in cima (più recente prima), poi il resto in ordine
  // alfabetico — stesso criterio del modal "Aggiungi serie" e del widget Android.
  const exercises = sortExercisesForQuickAdd(quickExercises.filter(e => e.active !== false), exerciseLog)
  const dayLog = exerciseLog[viewDate] || []

  function dayRepsFor(exId) {
    return dayLog.filter(s => s.exerciseId === exId).reduce((a, s) => a + s.reps, 0)
  }

  // Bottoni "Aggiungi sessione" utili in cima solo finché non sono già stati
  // usati oggi — fatto quello, il pulsante scende più in basso e lascia spazio
  // alle statistiche di oggi, che sono ciò che si vuole vedere per prime.
  const mobilityDoneToday = (mobilityLog[todayStr] || []).length > 0
  const studyDoneToday = (studyLog[todayStr] || []).length > 0

  const MobilityAddRow = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <button
        onClick={() => actions.openModal('mobility')}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
          borderRadius: 12, cursor: 'pointer', color: 'var(--text)',
          fontSize: '0.85em', fontWeight: 600,
        }}
      >
        <span style={{ fontSize: '1.1em' }}>🧘</span>
        Aggiungi sessione Mobility
      </button>
      <ActivityRateEditor getRate={getMobilityRate} setRate={setMobilityRate} unit="pt/min" label="Punti Mobility" />
    </div>
  )

  const StudyAddRow = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <button
        onClick={() => actions.openModal('study')}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
          borderRadius: 12, cursor: 'pointer', color: 'var(--text)',
          fontSize: '0.85em', fontWeight: 600,
        }}
      >
        <span style={{ fontSize: '1.1em' }}>📚</span>
        Aggiungi sessione Studio
      </button>
      <ActivityRateEditor getRate={getStudyRate} setRate={setStudyRate} unit="pt/min" label="Punti Studio" />
    </div>
  )

  return (
    <div style={{ paddingTop: 8 }}>
      {sessionSummary && (
        <WorkoutSessionSummary summary={sessionSummary} onClose={() => setSessionSummary(null)} />
      )}

      {isToday ? (
        <>
          {/* Sessione attiva — bottone "Termina sessione" */}
          <WorkoutSessionBar onEndSession={handleEndSession} />

          {/* Statistiche di oggi per prime: banner motivazionale (sforzo/record),
              obiettivo, timer di recupero */}
          <WorkoutMotivationBanner
            exerciseLog={exerciseLog}
            quickExercises={quickExercises}
            dismissedIds={dismissedRecordIds}
            onDismiss={id => setDismissedRecordIds(prev => new Set(prev).add(id))}
          />
          <WorkoutGoalProgress exerciseLog={exerciseLog} />
          <WorkoutRestTimer />

          {/* Aggiungi sessione Mobility/Studio in cima solo se non ancora fatte oggi */}
          {!mobilityDoneToday && MobilityAddRow}
          {!studyDoneToday && StudyAddRow}
        </>
      ) : (
        // Sessione/banner/obiettivo/timer sono concetti "live", inutili su un
        // giorno passato — al loro posto, cosa si è allenato quel giorno.
        <WorkoutDaySummary
          exerciseLog={exerciseLog}
          quickExercises={quickExercises}
          mobilityLog={mobilityLog}
          dateStr={viewDate}
          actions={actions}
        />
      )}

      {/* Mobility/Studio già fatte oggi: bottone (per un'altra sessione) +
          statistiche, spostati qui più in basso invece che in cima */}
      {isToday && mobilityDoneToday && MobilityAddRow}
      <WorkoutMobilityStats mobilityLog={mobilityLog} actions={actions} />

      {isToday && studyDoneToday && StudyAddRow}
      <WorkoutStudyStats studyLog={studyLog} actions={actions} />

      {/* Possibili plateau — esercizi fermi da un po' */}
      <WorkoutPlateauAlert exerciseLog={exerciseLog} quickExercises={quickExercises} />

      {/* Da quanto non batti un record, per esercizio */}
      <WorkoutRecordFreshness exerciseLog={exerciseLog} quickExercises={quickExercises} />

      {/* Action buttons */}
      <button style={btnStyle} onClick={() => actions.openModal('quickExercise')}>
        <span className="material-icons-round" style={{ color: 'var(--theme-color)', fontSize: 22 }}>fitness_center</span>
        Allenamento rapido
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

      {/* Sezioni usate raramente — in fondo, sotto la lista esercizi */}
      <MuscleHeatmapBody
        exerciseLog={exerciseLog}
        quickExercises={quickExercises}
      />
      <WorkoutEffortChart exerciseLog={exerciseLog} />
      <WorkoutHeatmap exerciseLog={exerciseLog} />

      {/* FAB — sempre raggiungibile per aggiungere una serie al volo, indipendentemente da dove si è scrollato */}
      <button
        onClick={() => actions.openModal('quickExercise')}
        title="Aggiungi serie"
        style={{
          // Su schermi larghi l'app resta una colonna centrata (max 480px): il
          // FAB deve seguire il bordo destro di quella colonna, non del viewport.
          position: 'fixed', right: 'max(16px, calc(50vw - 240px + 16px))', bottom: 76, zIndex: 900,
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
