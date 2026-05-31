import { useState } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import Accordion from './Accordion'

function daysUntil(deadline) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const end = new Date(deadline); end.setHours(0, 0, 0, 0)
  return Math.ceil((end - today) / 86400000)
}

function GoalCard({ habit }) {
  const { actions } = useApp()
  const gc = habit.goalConfig || {}
  const current = gc.currentValue || 0
  const target = gc.targetValue || 1
  const pct = Math.min(Math.round((current / target) * 100), 100)
  const days = gc.deadline ? daysUntil(gc.deadline) : null
  const isExpired = gc.expiredAt || (days !== null && days < 0 && !gc.completedAt)
  const isCompleted = Boolean(gc.completedAt)

  const [showInput, setShowInput] = useState(false)
  const [newVal, setNewVal] = useState('')

  async function handleUpdate() {
    const v = parseFloat(newVal)
    if (isNaN(v)) return
    await actions.updateGoalValue(habit.id, v)
    setShowInput(false)
    setNewVal('')
  }

  const borderColor = isCompleted ? 'var(--success)' : isExpired ? 'var(--danger)' : 'rgba(255,255,255,0.12)'

  return (
    <div style={{
      background: 'var(--card)', backdropFilter: 'blur(14px)',
      borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 10,
      border: `1px solid ${borderColor}`,
      borderLeft: `3px solid ${isCompleted ? 'var(--success)' : isExpired ? 'var(--danger)' : 'var(--theme-color)'}`,
      animation: 'slideUp 0.25s ease',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '1em', marginBottom: 4 }}>
            {isCompleted && '✅ '}
            {isExpired && !isCompleted && '⛔ '}
            {habit.name}
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: '0.78em', color: '#666', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--theme-color)', fontWeight: 700 }}>
              {current} / {target} {gc.unit}
            </span>
            {days !== null && !isCompleted && (
              <span style={{ color: isExpired ? 'var(--danger)' : days <= 7 ? '#EF9F27' : '#666' }}>
                {isExpired ? 'Scaduto' : `${days} giorni`}
              </span>
            )}
            <span style={{ color: 'var(--success)' }}>🎯 {gc.rewardOnComplete || 0}pt</span>
            {(gc.penaltyOnFail > 0) && <span style={{ color: 'var(--danger)' }}>-{gc.penaltyOnFail}pt</span>}
          </div>
        </div>
        {!isCompleted && !isExpired && (
          <button className="btn-icon" onClick={() => setShowInput(v => !v)} title="Aggiorna valore">
            <span className="material-icons-round" style={{ fontSize: 20, color: 'var(--theme-color)' }}>add_circle</span>
          </button>
        )}
        <button className="btn-icon" onClick={() => actions.openModal('edit', { id: habit.id, type: 'habit' })}>
          <span className="material-icons-round" style={{ fontSize: 18 }}>edit</span>
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginTop: 10 }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: isCompleted ? 'var(--success)' : isExpired ? 'var(--danger)' : 'var(--theme-color)',
          width: `${pct}%`, transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ fontSize: '0.68em', color: '#555', marginTop: 3, textAlign: 'right' }}>{pct}%</div>

      {/* Input row */}
      {showInput && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <input
            type="number"
            inputMode="decimal"
            value={newVal}
            onChange={e => setNewVal(e.target.value)}
            placeholder={`Nuovo valore (${gc.unit})`}
            style={{ flex: 1 }}
            autoFocus
          />
          <button className="btn-main" style={{ width: 'auto', padding: '8px 16px', marginTop: 0 }} onClick={handleUpdate}>
            OK
          </button>
          <button className="btn-sec" style={{ width: 'auto', padding: '8px', marginTop: 0 }} onClick={() => setShowInput(false)}>✕</button>
        </div>
      )}
    </div>
  )
}

export default function GoalSection({ habits }) {
  const today = toDateString(new Date())
  const goals = (habits || []).filter(h => h.type === 'goal' && (!h.archivedAt || h.archivedAt > today))
  if (goals.length === 0) return null

  return (
    <Accordion label="🎯 Obiettivi" defaultOpen={true}>
      {goals.map(h => <GoalCard key={h.id} habit={h} />)}
    </Accordion>
  )
}
