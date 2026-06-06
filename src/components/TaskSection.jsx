import { useRef } from 'react'
import { useApp } from '../lib/store'

function getDeadlineColor(deadline) {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(deadline + 'T00:00:00')
  const diff = Math.floor((d - today) / 86400000)
  if (diff <= 0) return '#e53935'
  if (diff <= 3) return '#ff7043'
  if (diff <= 7) return '#ffca28'
  return '#555'
}

function formatDeadline(deadline) {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(deadline + 'T00:00:00')
  const diff = Math.floor((d - today) / 86400000)
  if (diff === 0) return 'oggi'
  if (diff === 1) return 'domani'
  if (diff < 0) return `${Math.abs(diff)}gg fa`
  const months = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

const PRIORITY_LABELS = { high: 'ALTA', medium: 'MEDIA', low: 'BASSA' }
const PRIORITY_COLORS = { high: '#e53935', medium: '#ff7043', low: '#42a5f5' }

export default function TaskSection() {
  const { state, actions } = useApp()
  const { globalData, authUserId } = state
  const isReadOnly = state.viewUserId !== state.authUserId

  if (authUserId !== 'flavio' || isReadOnly) return null

  const tasks = (globalData?.tasks || []).filter(t => t.status === 'active')
  const PRIO = { high: 0, medium: 1, low: 2 }
  const sorted = [...tasks].sort((a, b) => {
    if (a.deadline !== b.deadline) return a.deadline.localeCompare(b.deadline)
    return (PRIO[a.priority] || 1) - (PRIO[b.priority] || 1)
  })

  return (
    <div style={{ marginTop: 28, marginBottom: 8 }}>
      <div className="section-header" style={{ marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>📋 Task</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-icon" onClick={() => actions.openModal('taskHistory')} title="Storico task">
            <span className="material-icons-round" style={{ fontSize: 18 }}>history</span>
          </button>
          <button className="btn-icon" onClick={() => actions.openModal('taskAdd')} title="Aggiungi task">
            <span className="material-icons-round" style={{ fontSize: 18 }}>add</span>
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state" style={{ fontSize: '0.82em' }}>
          Nessuna task attiva — aggiungine una con +
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onComplete={() => actions.confirmCompleteTask(task)}
              onEdit={() => actions.openModal('taskEdit', { task })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskItem({ task, onComplete, onEdit }) {
  const color = getDeadlineColor(task.deadline)
  const deadline = formatDeadline(task.deadline)
  const pColor = PRIORITY_COLORS[task.priority] || '#ff7043'
  const pLabel = PRIORITY_LABELS[task.priority] || 'MEDIA'

  const longPressTimer = useRef(null)
  const didLong = useRef(false)

  function onPD() {
    didLong.current = false
    longPressTimer.current = setTimeout(() => {
      didLong.current = true
      onEdit()
      navigator.vibrate?.([30, 20, 30])
    }, 500)
  }
  function onPU() { clearTimeout(longPressTimer.current) }
  function onPL() { clearTimeout(longPressTimer.current) }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--card)', borderRadius: 12, padding: '10px 12px',
        border: '1px solid var(--card-border)', overflow: 'hidden',
      }}
      onPointerDown={onPD}
      onPointerUp={onPU}
      onPointerLeave={onPL}
    >
      <div style={{ width: 4, minHeight: 44, borderRadius: 2, background: color, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9em', color: 'var(--text)' }}>{task.title}</span>
          <span style={{
            fontSize: '0.63em', fontWeight: 700, color: pColor,
            background: `${pColor}22`, borderRadius: 4, padding: '1px 5px',
          }}>{pLabel}</span>
        </div>
        {task.description && (
          <div style={{ fontSize: '0.72em', color: '#555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.description}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: '0.7em', color, fontWeight: 600 }}>📅 {deadline}</span>
          <span style={{ fontSize: '0.68em', color: '#555' }}>+{task.reward}pt / -{task.penalty}pt</span>
        </div>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onComplete() }}
        onPointerDown={e => e.stopPropagation()}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.05)', color: '#888',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0, fontSize: '1em',
          transition: 'all 0.15s',
        }}
        title="Completa task"
      >
        ✓
      </button>
    </div>
  )
}
