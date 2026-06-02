import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { _getPPR } from '../lib/store'
import { toDateString } from '../lib/habitLogic'

export default function QuickExerciseModal() {
  const { state, actions } = useApp()
  const { modal, allUsersData, authUserId } = state

  const [selId, setSelId] = useState(null)
  const [reps, setReps] = useState(10)
  const [saving, setSaving] = useState(false)

  const gd = allUsersData?.flavio
  const exercises = (gd?.quickExercises || []).filter(e => e.active !== false)

  // Pick first exercise on open / when list loads
  useEffect(() => {
    if (modal === 'quickExercise' && exercises.length > 0 && !selId) {
      setSelId(exercises[0].id)
    }
  }, [modal, exercises.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (modal !== 'quickExercise') return null
  if (authUserId !== 'flavio') return null

  const today = toDateString(new Date())
  const exercise = exercises.find(e => e.id === selId) || exercises[0]
  const ppr = exercise ? _getPPR(exercise, today) : 0
  const pts = exercise ? Math.round(reps * ppr * 100) / 100 : 0

  function changeReps(delta) {
    setReps(prev => Math.max(1, Math.min(200, prev + delta)))
  }

  async function handleAdd() {
    if (!exercise) return
    setSaving(true)
    await actions.addExerciseSession(exercise.id, reps)
    setSaving(false)
    actions.closeModal()
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

        {/* Exercise chip selector */}
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

        {/* Exercise name (if only one) */}
        {exercises.length === 1 && exercise && (
          <div style={{ textAlign: 'center', fontSize: '1em', fontWeight: 700, color: 'var(--theme-color)', marginBottom: 16 }}>
            {exercise.emoji} {exercise.name}
          </div>
        )}

        {/* Reps counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 12 }}>
          <button
            onClick={() => changeReps(-5)}
            style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '1.3em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >−5</button>
          <button
            onClick={() => changeReps(-1)}
            style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '1.5em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >−</button>

          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: '3.2em', fontWeight: 900, color: 'var(--theme-color)', lineHeight: 1 }}>{reps}</div>
            <div style={{ fontSize: '0.7em', color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>reps</div>
          </div>

          <button
            onClick={() => changeReps(1)}
            style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '1.5em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >+</button>
          <button
            onClick={() => changeReps(5)}
            style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '1.3em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >+5</button>
        </div>

        {/* Points preview */}
        <div style={{ textAlign: 'center', marginBottom: 20, fontSize: '1.1em', fontWeight: 700, color: pts > 0 ? 'var(--success)' : '#666' }}>
          = +{pts} pt
        </div>

        {/* Buttons */}
        <button
          className="btn-main"
          style={{ width: '100%', padding: '14px', fontSize: '1.05em', marginBottom: 10 }}
          onClick={handleAdd}
          disabled={saving || !exercise || reps < 1}
        >
          {saving ? '⏳ Salvataggio...' : `Aggiungi ${exercise?.emoji || '💪'}`}
        </button>

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
