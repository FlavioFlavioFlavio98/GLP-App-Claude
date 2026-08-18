import { useState } from 'react'
import { getDailyGoal, setDailyGoalOverride, getDayEffort } from '../lib/workoutStats'
import { toDateString } from '../lib/habitLogic'

export default function WorkoutGoalProgress({ exerciseLog }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [showInfo, setShowInfo] = useState(false)

  const todayStr = toDateString(new Date())
  const todayEffort = getDayEffort(exerciseLog, todayStr)
  const goal = getDailyGoal(exerciseLog)
  const pct = goal.value > 0 ? Math.min(100, Math.round((todayEffort / goal.value) * 100)) : 0
  const reached = todayEffort >= goal.value && goal.value > 0

  function startEdit() {
    setDraft(String(goal.value))
    setEditing(true)
  }

  function saveEdit() {
    const n = parseFloat(draft.replace(',', '.'))
    if (!isNaN(n) && n > 0) setDailyGoalOverride(n)
    setEditing(false)
  }

  function resetToSuggested() {
    setDailyGoalOverride(null)
    setEditing(false)
  }

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
            🎯 Obiettivo di oggi
          </div>
          {!editing && !goal.isCustom && (
            <button
              onClick={() => setShowInfo(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, display: 'flex' }}
              title="Come viene calcolato"
            >
              <span className="material-icons-round" style={{ fontSize: 14 }}>help_outline</span>
            </button>
          )}
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72em', padding: 2 }}
            title="Modifica obiettivo"
          >
            <span className="material-icons-round" style={{ fontSize: 15 }}>edit</span>
            {goal.isCustom ? 'personalizzato' : 'suggerito'}
          </button>
        )}
      </div>

      {showInfo && !editing && (
        <div style={{ fontSize: '0.68em', color: '#888', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', marginBottom: 10, lineHeight: 1.5 }}>
          È la media del tuo sforzo negli ultimi 14 giorni allenati (oggi escluso), aumentata del 5% per spingerti a migliorare gradualmente. Si ricalcola ogni giorno — puoi anche impostarne uno tuo con la matita.
        </div>
      )}

      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 8, boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--theme-color)',
              color: 'var(--text)', fontSize: '0.95em',
            }}
          />
          <span style={{ fontSize: '0.75em', color: '#666' }}>pt</span>
          <button onClick={saveEdit} className="btn-icon" title="Salva">
            <span className="material-icons-round" style={{ fontSize: 20, color: 'var(--success, #4caf50)' }}>check</span>
          </button>
          <button onClick={() => setEditing(false)} className="btn-icon" title="Annulla">
            <span className="material-icons-round" style={{ fontSize: 20, color: '#888' }}>close</span>
          </button>
          {goal.isCustom && (
            <button onClick={resetToSuggested} className="btn-icon" title="Torna al suggerito">
              <span className="material-icons-round" style={{ fontSize: 18, color: '#888' }}>restart_alt</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: '1.6em', fontWeight: 900, color: reached ? 'var(--success, #4caf50)' : 'var(--theme-color)' }}>
              {todayEffort}
            </span>
            <span style={{ fontSize: '0.85em', color: '#666' }}>/ {goal.value}pt</span>
            {reached && <span style={{ fontSize: '0.9em' }}>✅</span>}
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 5,
              width: `${pct}%`,
              background: reached ? 'var(--success, #4caf50)' : 'linear-gradient(90deg, var(--theme-color), var(--accent2))',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.62em', color: '#555', marginTop: 3 }}>{pct}%</div>
        </>
      )}
    </div>
  )
}
