import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import { MUSCLE_GROUPS } from '../lib/muscleMapping'
import { groupExercisesByMuscle, getAverageRepsPerSession, getEffortMultiplier, DEFAULT_EFFORT } from '../lib/workoutStats'

const EFFORT_LEVELS = [
  { level: 1, label: 'Leggero', sub: 'riscaldamento', emoji: '🟢' },
  { level: 2, label: 'Medio', sub: '+20% pt', emoji: '🟡' },
  { level: 3, label: 'Massimo', sub: 'sfinimento · +50% pt', emoji: '🔴' },
]

const ALTRO_GROUP = { label: 'Altro', emoji: '🏋️' }

export default function QuickExerciseModal() {
  const { state, actions } = useApp()
  const { modal, allUsersData, authUserId } = state

  // step: 'muscle' | 'exercise' | 'reps'
  const [step, setStep] = useState('muscle')
  const [muscleKey, setMuscleKey] = useState(null)
  const [selId, setSelId] = useState(null)
  const [reps, setReps] = useState(10)
  const [effort, setEffort] = useState(DEFAULT_EFFORT)
  const [saving, setSaving] = useState(false)
  const [exerciseDate, setExerciseDate] = useState(toDateString(new Date()))

  const gd = allUsersData?.flavio
  const exercises = (gd?.quickExercises || []).filter(e => e.active !== false)
  const exerciseLog = gd?.exerciseLog || {}

  const grouped = useMemo(() => groupExercisesByMuscle(exercises), [exercises])
  const muscleKeys = useMemo(
    () => Object.keys(grouped).sort((a, b) => {
      if (a === 'altro') return 1
      if (b === 'altro') return -1
      return (MUSCLE_GROUPS[a]?.label || '').localeCompare(MUSCLE_GROUPS[b]?.label || '')
    }),
    [grouped]
  )

  // Reset del flusso ogni volta che il modal si apre
  useEffect(() => {
    if (modal === 'quickExercise') {
      setStep('muscle')
      setMuscleKey(null)
      setSelId(null)
      setReps(10)
      setEffort(DEFAULT_EFFORT)
      setExerciseDate(toDateString(new Date()))
    }
  }, [modal])

  if (modal !== 'quickExercise') return null
  if (authUserId !== 'flavio') return null

  const exercise = exercises.find(e => e.id === selId) ?? null

  // ppr: always parseFloat to handle Firestore string/number ambiguity
  const ppr = parseFloat(exercise?.pointsPerRep) || 0.1
  const pts = parseFloat((reps * ppr * getEffortMultiplier(effort)).toFixed(2))

  const avgReps = useMemo(
    () => exercise ? getAverageRepsPerSession(exerciseLog, exercise.id) : 0,
    [exercise?.id, exerciseLog]
  )

  function changeReps(delta) {
    setReps(prev => Math.max(1, Math.min(200, prev + delta)))
  }

  function pickMuscle(key) {
    setMuscleKey(key)
    setStep('exercise')
  }

  function pickExercise(ex) {
    setSelId(ex.id)
    setReps(10)
    setEffort(DEFAULT_EFFORT)
    setStep('reps')
  }

  function goBack() {
    if (step === 'reps') setStep('exercise')
    else if (step === 'exercise') { setMuscleKey(null); setStep('muscle') }
  }

  async function handleAdd() {
    if (!exercise) { actions.showToast('Nessun esercizio selezionato', '⚠️'); return }
    setSaving(true)
    await actions.addExerciseSession(exercise.id, reps, exerciseDate, effort)
    setSaving(false)
    actions.closeModal()
  }

  // No exercises yet — show loading / init state
  if (exercises.length === 0) {
    return (
      <div className="modal-overlay" style={{ alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }}
        onClick={e => e.target === e.currentTarget && actions.closeModal()}>
        <div style={{ width: '100%', background: 'var(--card-solid)', borderRadius: '20px 20px 0 0', padding: '32px 24px 48px', border: '1px solid var(--card-border)', animation: 'slideUp 0.22s ease', textAlign: 'center' }}>
          <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 20px' }} />
          <div style={{ fontSize: '0.85em', color: '#555', marginBottom: 16 }}>Inizializzazione esercizi...</div>
          <button className="btn-sec" onClick={async () => { await actions.ensureDefaultExercise(); }} style={{ marginBottom: 8 }}>
            Crea "Flessioni" default
          </button>
          <button className="btn-icon" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} onClick={() => actions.closeModal()}>
            <span className="material-icons-round">close</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && actions.closeModal()}
    >
      <div style={{
        width: '100%', background: 'var(--card-solid)',
        borderRadius: '20px 20px 0 0', padding: '20px 20px 36px',
        border: '1px solid var(--card-border)',
        animation: 'slideUp 0.22s ease',
        maxHeight: '82vh', overflowY: 'auto', boxSizing: 'border-box',
      }}>
        {/* Handle bar */}
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 18px' }} />

        {/* Header con back button (tranne al primo step) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, minHeight: 28 }}>
          {step !== 'muscle' ? (
            <button onClick={goBack} className="btn-icon" style={{ padding: 4 }}>
              <span className="material-icons-round" style={{ fontSize: 22 }}>arrow_back</span>
            </button>
          ) : <div style={{ width: 30 }} />}
          <div style={{ flex: 1, textAlign: 'center', fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>
            {step === 'muscle' && 'Che muscolo alleni?'}
            {step === 'exercise' && (MUSCLE_GROUPS[muscleKey]?.label || ALTRO_GROUP.label)}
            {step === 'reps' && (exercise ? `${exercise.emoji} ${exercise.name}` : '')}
          </div>
          <div style={{ width: 30 }} />
        </div>

        {/* ── STEP 1: gruppo muscolare ── */}
        {step === 'muscle' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {muscleKeys.map(key => {
              const info = key === 'altro' ? ALTRO_GROUP : MUSCLE_GROUPS[key]
              const count = grouped[key].length
              return (
                <button
                  key={key}
                  onClick={() => pickMuscle(key)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '16px 10px', borderRadius: 14, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--text)',
                  }}
                >
                  <span style={{ fontSize: '1.8em' }}>{info?.emoji || '🏋️'}</span>
                  <span style={{ fontSize: '0.85em', fontWeight: 700 }}>{info?.label || key}</span>
                  <span style={{ fontSize: '0.65em', color: '#666' }}>{count} eserciz{count === 1 ? 'io' : 'i'}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── STEP 2: esercizio filtrato per gruppo ── */}
        {step === 'exercise' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(grouped[muscleKey] || []).map(ex => (
              <button
                key={ex.id}
                onClick={() => pickExercise(ex)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text)',
                }}
              >
                <span style={{ fontSize: '1.4em' }}>{ex.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9em' }}>{ex.name}</div>
                  <div style={{ fontSize: '0.65em', color: 'var(--theme-color)' }}>{parseFloat(ex.pointsPerRep)} pt/rep</div>
                </div>
                <span className="material-icons-round" style={{ fontSize: 18, color: '#444' }}>chevron_right</span>
              </button>
            ))}
          </div>
        )}

        {/* ── STEP 3: ripetizioni (invariato) ── */}
        {step === 'reps' && exercise && (
          <>
            {/* Reps counter */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 14 }}>
              <button onClick={() => changeReps(-5)} style={btnStyle}>−5</button>
              <button onClick={() => changeReps(-1)} style={{ ...btnStyle, width: 52, height: 52, fontSize: '1.4em' }}>−</button>

              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: '3.4em', fontWeight: 900, color: 'var(--theme-color)', lineHeight: 1 }}>{reps}</div>
                <div style={{ fontSize: '0.65em', color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>reps</div>
              </div>

              <button onClick={() => changeReps(1)} style={{ ...btnStyle, width: 52, height: 52, fontSize: '1.4em' }}>+</button>
              <button onClick={() => changeReps(5)} style={btnStyle}>+5</button>
            </div>

            {/* Sforzo percepito */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, textAlign: 'center' }}>
                Sforzo percepito
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {EFFORT_LEVELS.map(lvl => (
                  <button
                    key={lvl.level}
                    onClick={() => setEffort(lvl.level)}
                    style={{
                      flex: 1, padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                      background: effort === lvl.level ? 'var(--theme-glow)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${effort === lvl.level ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`,
                      color: effort === lvl.level ? 'var(--theme-color)' : 'var(--text)',
                    }}
                  >
                    <div style={{ fontSize: '1.3em', marginBottom: 2 }}>{lvl.emoji}</div>
                    <div style={{ fontSize: '0.72em', fontWeight: 700 }}>{lvl.label}</div>
                    <div style={{ fontSize: '0.58em', color: '#777', marginTop: 2 }}>{lvl.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Points preview */}
            <div style={{ textAlign: 'center', marginBottom: 8, fontSize: '1.2em', fontWeight: 800, color: 'var(--success)' }}>
              = +{pts} pt
            </div>

            {/* Confronto live con la media personale dell'esercizio */}
            {avgReps > 0 && (
              <div style={{
                textAlign: 'center', marginBottom: 14, fontSize: '0.78em', fontWeight: 600,
                color: Math.round(avgReps) === reps ? '#888' : (reps > avgReps ? 'var(--success)' : '#EF9F27'),
              }}>
                {Math.round(avgReps) === reps
                  ? `● in linea con la tua media (${Math.round(avgReps)} reps)`
                  : `${reps > avgReps ? '▲' : '▼'} ${Math.abs(Math.round((reps - avgReps) / avgReps * 100))}% ${reps > avgReps ? 'sopra' : 'sotto'} la tua media (${Math.round(avgReps)} reps)`}
              </div>
            )}

            {/* Date picker */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Data</div>
              <input
                type="date"
                value={exerciseDate}
                max={toDateString(new Date())}
                onChange={e => setExerciseDate(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9em', boxSizing: 'border-box', colorScheme: 'dark' }}
              />
              {exerciseDate !== toDateString(new Date()) && (
                <div style={{ fontSize: '0.65em', color: '#EF9F27', marginTop: 4 }}>
                  ⚠️ Data retrodatata: non farà parte della sessione di allenamento live
                </div>
              )}
            </div>

            {/* Save button */}
            <button
              className="btn-main"
              style={{ width: '100%', padding: '14px', fontSize: '1.05em', marginBottom: 10 }}
              onClick={handleAdd}
              disabled={saving}
            >
              {saving ? '⏳ Salvataggio...' : `Aggiungi ${exercise.emoji}`}
            </button>
          </>
        )}

        {/* Stats link */}
        <button
          onClick={() => { actions.closeModal(); setTimeout(() => actions.openModal('exerciseStats'), 60) }}
          style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#888', cursor: 'pointer', fontSize: '0.85em', marginTop: 4 }}
        >
          📊 Statistiche complete
        </button>
      </div>
    </div>
  )
}

const btnStyle = {
  width: 44, height: 44, borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff', fontSize: '0.9em', fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
