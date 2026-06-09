import { useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'

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

export default function TaskSection({ minimalMode }) {
  const { state, actions } = useApp()
  const { globalData, authUserId } = state
  const isReadOnly = state.viewUserId !== state.authUserId
  const [expanded, setExpanded] = useState(() => localStorage.getItem('glp_tasks_expanded') !== 'false')

  if (authUserId !== 'flavio' || isReadOnly) return null

  const todayStr = toDateString(new Date())
  const allTasks = globalData?.tasks || []
  const PRIO = { high: 0, medium: 1, low: 2 }

  const activeTasks = allTasks
    .filter(t => t.status === 'active')
    .sort((a, b) => {
      if (a.deadline !== b.deadline) return a.deadline.localeCompare(b.deadline)
      return (PRIO[a.priority] || 1) - (PRIO[b.priority] || 1)
    })

  const completedToday = allTasks
    .filter(t => t.status === 'completed' && t.completedAt?.startsWith(todayStr))
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))

  const totalCount = activeTasks.length + completedToday.length
  const hasAny = totalCount > 0

  function toggle() {
    const next = !expanded
    setExpanded(next)
    localStorage.setItem('glp_tasks_expanded', String(next))
  }

  return (
    <div style={{ marginTop: 28, marginBottom: 8 }}>
      <div className="section-header" style={{ marginBottom: 10 }}>
        <button
          onClick={toggle}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)' }}
        >
          <div className="section-title" style={{ margin: 0 }}>📋 Task ({activeTasks.length}/{totalCount})</div>
          <span className="material-icons-round" style={{ fontSize: 18, color: '#666' }}>{expanded ? 'expand_less' : 'expand_more'}</span>
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-icon" onClick={() => actions.openModal('taskHistory')} title="Storico task">
            <span className="material-icons-round" style={{ fontSize: 18 }}>history</span>
          </button>
          <button className="btn-icon" onClick={() => actions.openModal('taskAdd')} title="Aggiungi task">
            <span className="material-icons-round" style={{ fontSize: 18 }}>add</span>
          </button>
        </div>
      </div>

      {expanded && (
        !hasAny ? (
          <div className="empty-state" style={{ fontSize: '0.82em' }}>
            Nessuna task attiva — aggiungine una con +
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                completed={false}
                onComplete={() => actions.confirmCompleteTask(task)}
                onEdit={() => actions.openModal('taskEdit', { task })}
                onDelete={() => actions.deleteTask(task.id)}
              />
            ))}
            {!minimalMode && completedToday.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                completed={true}
                onComplete={null}
                onEdit={null}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}

function TaskItem({ task, completed, onComplete, onEdit, onDelete }) {
  const color = completed ? '#4caf50' : getDeadlineColor(task.deadline)
  const deadline = formatDeadline(task.deadline)
  const pColor = PRIORITY_COLORS[task.priority] || '#ff7043'
  const pLabel = PRIORITY_LABELS[task.priority] || 'MEDIA'
  const [menuOpen, setMenuOpen] = useState(false)

  const longPressTimer = useRef(null)
  const didLong = useRef(false)

  function onPD() {
    if (completed || !onEdit) return
    didLong.current = false
    longPressTimer.current = setTimeout(() => {
      didLong.current = true
      setMenuOpen(true)
      navigator.vibrate?.([30, 20, 30])
    }, 500)
  }
  function onPU() { clearTimeout(longPressTimer.current) }
  function onPL() { clearTimeout(longPressTimer.current) }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: completed ? 'rgba(76,175,80,0.06)' : 'var(--card)',
        borderRadius: 12, padding: '10px 12px',
        border: completed ? '1px solid rgba(76,175,80,0.2)' : '1px solid var(--card-border)',
        overflow: 'hidden',
        opacity: completed ? 0.75 : 1,
        transition: 'opacity 0.2s',
      }}
      onPointerDown={onPD}
      onPointerUp={onPU}
      onPointerLeave={onPL}
    >
      <div style={{ width: 4, minHeight: 44, borderRadius: 2, background: color, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontWeight: 600, fontSize: '0.9em', color: 'var(--text)',
            textDecoration: completed ? 'line-through' : 'none',
          }}>{task.title}</span>
          {!completed && (
            <span style={{
              fontSize: '0.63em', fontWeight: 700, color: pColor,
              background: `${pColor}22`, borderRadius: 4, padding: '1px 5px',
            }}>{pLabel}</span>
          )}
          {completed && (
            <span style={{
              fontSize: '0.63em', fontWeight: 700, color: '#4caf50',
              background: 'rgba(76,175,80,0.15)', borderRadius: 4, padding: '1px 6px',
            }}>✓ +{task.reward}pt</span>
          )}
        </div>
        {task.description && (
          <div style={{ fontSize: '0.72em', color: '#555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.description}
          </div>
        )}
        {!completed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: '0.7em', color, fontWeight: 600 }}>📅 {deadline}</span>
            <span style={{ fontSize: '0.68em', color: '#555' }}>+{task.reward}pt / -{task.penalty}pt</span>
          </div>
        )}
      </div>

      {!completed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); onComplete() }}
            onPointerDown={e => e.stopPropagation()}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)', color: '#888',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1em',
            }}
            title="Completa task"
          >✓</button>
          {menuOpen ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit() }}
                onPointerDown={e => e.stopPropagation()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1em', padding: 2 }}
                title="Modifica"
              >✏️</button>
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete() }}
                onPointerDown={e => e.stopPropagation()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1em', padding: 2 }}
                title="Elimina"
              >🗑️</button>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(true) }}
              onPointerDown={e => e.stopPropagation()}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#555', fontSize: '1.1em', padding: 2, lineHeight: 1,
              }}
              title="Azioni"
            >⋮</button>
          )}
        </div>
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid rgba(76,175,80,0.4)',
          background: 'rgba(76,175,80,0.1)', color: '#4caf50',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: '1em',
        }}>✓</div>
      )}
    </div>
  )
}
