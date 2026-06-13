import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'

export default function QuickExerciseModal() {
  const { state, actions } = useApp()
  const { modal, allUsersData, authUserId } = state

  const [selId, setSelId] = useState(null)
  const [reps, setReps] = useState(10)
  const [saving, setSaving] = useState(false)
  const [exerciseDate, setExerciseDate] = useState(toDateString(new Date()))

  const gd = allUsersData?.flavio
  const exercises = (gd?.quickExercises || []).filter(e => e.active !== false)

  // Sync selId when exercises load or modal opens
  useEffect(() => {
    if (modal === 'quickExercise') {
      setReps(10)
      setExerciseDate(toDateString(new Date()))
      if (exercises.length > 0) setSelId(exercises[0].id)
    }
  }, [modal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep selId valid when exercises list changes
  useEffect(() => {
    if (exercises.length > 0 && (!selId || !exercises.find(e => e.id === selId))) {
      setSelId(exercises[0].id)
    }
  }, [exercises.length, selId])

  if (modal !== 'quickExercise') return null
  if (authUserId !== 'flavio') return null

  const exercise = exercises.find(e => e.id === selId) ?? exercises[0] ?? null

  // ppr: always parseFloat to handle Firestore string/number ambiguity
  const ppr = parseFloat(exercise?.pointsPerRep) || 0.1
  const pts = parseFloat((reps * ppr).toFixed(2))

  console.log('[QuickExercise] exercise:', exercise, 'ppr:', ppr, 'reps:', reps, 'pts:', pts)

  function changeReps(delta) {
    setReps(prev => Math.max(1, Math.min(200, prev + delta)))
  }

  async function handleAdd() {
    if (!exercise) { actions.showToast('Nessun esercizio selezionato', '⚠️'); return }
    console.log('[QuickExercise] handleAdd', exercise.id, reps, pts)
    setSaving(true)
    await actions.addExerciseSession(exercise.id, reps, exerciseDate)
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
      }}>
        {/* Handle bar */}
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 18px' }} />

        {/* Exercise chip selector (only when >1 exercise) */}
        {exercises.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, justifyContent: 'center' }}>
            {exercises.map(ex => (
              <button
                key={ex.id}
                onClick={() => setSelId(ex.id)}
                style={{
                  padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: '0.88em', fontWeight: 600,
                  background: selId === ex.id ? 'var(--theme-glow)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${selId === ex.id ? 'var(--theme-color)' : 'rgba(255,255,255,0.1)'}`,
                  color: selId === ex.id ? 'var(--theme-color)' : '#888',
                  transition: 'all 0.15s',
                }}
              >{ex.emoji} {ex.name}</button>
            ))}
          </div>
        )}

        {/* Exercise name + ppr info */}
        {exercise && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: '1em', fontWeight: 700, color: 'var(--theme-color)' }}>
              {exercise.emoji} {exercise.name}
            </div>
            <div style={{ fontSize: '0.65em', color: '#444', marginTop: 2 }}>
              {ppr} pt / rep
            </div>
          </div>
        )}

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

        {/* Points preview */}
        <div style={{ textAlign: 'center', marginBottom: 22, fontSize: '1.2em', fontWeight: 800, color: 'var(--success)' }}>
          = +{pts} pt
        </div>

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
        </div>

        {/* Save button */}
        <button
          className="btn-main"
          style={{ width: '100%', padding: '14px', fontSize: '1.05em', marginBottom: 10 }}
          onClick={handleAdd}
          disabled={saving || !exercise}
        >
          {saving ? '⏳ Salvataggio...' : `Aggiungi ${exercise?.emoji || '💪'}`}
        </button>

        {/* Stats link */}
        <button
          onClick={() => { actions.closeModal(); setTimeout(() => actions.openModal('exerciseStats'), 60) }}
          style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#888', cursor: 'pointer', fontSize: '0.85em' }}
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
