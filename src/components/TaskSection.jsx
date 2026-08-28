import { useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../lib/taskColors'

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

export default function TaskSection({ minimalMode }) {
  const { state, actions } = useApp()
  const { globalData, authUserId } = state
  const isReadOnly = state.viewUserId !== state.authUserId
  const [expanded, setExpanded] = useState(() => localStorage.getItem('glp_tasks_expanded') !== 'false')
  const [showExpired, setShowExpired] = useState(() => localStorage.getItem('glp_tasks_show_expired') !== 'false')

  if (authUserId !== 'flavio' || isReadOnly) return null

  const todayStr = toDateString(new Date())
  const viewDate = state.viewDate || todayStr
  const isToday = viewDate === todayStr
  const allTasks = globalData?.tasks || []
  const PRIO = { high: 0, medium: 1, low: 2 }
  const recurringByTaskId = Object.fromEntries((globalData?.recurringTasks || []).map(r => [r.id, r]))

  // Su OGGI: task di oggi + quelle ancora attive ma scadute + tutte le
  // scadute + completate oggi — la vista "non perdere nulla" di default.
  // Su un altro giorno (passato o futuro): solo le task programmate per
  // quella data esatta, qualunque sia il loro stato — è la vista "cosa era/
  // sarà previsto per quel giorno", non un riepilogo generale.
  const dayTasks = isToday
    ? allTasks.filter(t =>
        (t.status === 'active' && t.deadline <= todayStr) ||
        t.status === 'expired' ||
        (t.status === 'completed' && typeof t.completedAt === 'string' && t.completedAt.startsWith(todayStr))
      )
    : allTasks.filter(t => t.deadline === viewDate)

  const activeTasks = dayTasks
    .filter(t => t.status === 'active')
    .sort((a, b) => {
      if (a.deadline !== b.deadline) return a.deadline.localeCompare(b.deadline)
      return (PRIO[a.priority] || 1) - (PRIO[b.priority] || 1)
    })

  const expiredTasks = dayTasks
    .filter(t => t.status === 'expired')
    .sort((a, b) => (b.expiredAt || '').localeCompare(a.expiredAt || ''))

  const completedToday = dayTasks
    .filter(t => t.status === 'completed')
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))

  const totalCount = activeTasks.length + completedToday.length
  const hasActive = totalCount > 0 || expiredTasks.length > 0

  function toggle() {
    const next = !expanded
    setExpanded(next)
    localStorage.setItem('glp_tasks_expanded', String(next))
  }

  function toggleExpired() {
    const next = !showExpired
    setShowExpired(next)
    localStorage.setItem('glp_tasks_show_expired', String(next))
  }

  const dayLabel = isToday ? '' : ` · ${viewDate.split('-').reverse().slice(0, 2).join('/')}`
  const counterLabel = expiredTasks.length > 0
    ? `📋 Task (${activeTasks.length}/${totalCount}) · ${expiredTasks.length} scad.${dayLabel}`
    : `📋 Task (${activeTasks.length}/${totalCount})${dayLabel}`

  return (
    <div style={{ marginTop: 28, marginBottom: 8 }}>
      <div className="section-header" style={{ marginBottom: 10 }}>
        <button
          onClick={toggle}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--theme-color)' }}
        >
          <div className="section-title" style={{ margin: 0 }}>{counterLabel}</div>
          <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--theme-color)' }}>{expanded ? 'expand_less' : 'expand_more'}</span>
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-icon" onClick={() => actions.openModal('recurringTasks')} title="Task ricorrenti">
            <span className="material-icons-round" style={{ fontSize: 18 }}>repeat</span>
          </button>
          <button className="btn-icon" onClick={() => actions.openModal('taskAdd')} title="Aggiungi task">
            <span className="material-icons-round" style={{ fontSize: 18 }}>add</span>
          </button>
        </div>
      </div>

      {expanded && (
        !hasActive ? (
          <div className="empty-state" style={{ fontSize: '0.82em' }}>
            {isToday ? 'Nessuna task attiva — aggiungine una con +' : 'Nessuna task programmata per questo giorno'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                variant="active"
                recurring={recurringByTaskId[task.recurringId]}
                onComplete={() => actions.confirmCompleteTask(task)}
                onEdit={() => actions.openModal('taskEdit', { task })}
                onDelete={() => actions.deleteTask(task.id)}
              />
            ))}

            {/* Sezione task scadute */}
            {expiredTasks.length > 0 && (
              <>
                <div
                  onClick={toggleExpired}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginTop: 4, cursor: 'pointer',
                    fontSize: '0.72em', color: '#e53935', fontWeight: 700,
                    userSelect: 'none',
                  }}
                >
                  <span>⚠️ SCADUTE ({expiredTasks.length})</span>
                  <span className="material-icons-round" style={{ fontSize: 14 }}>
                    {showExpired ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
                {showExpired && expiredTasks.map(task => {
                  const rec = recurringByTaskId[task.recurringId]
                  return (
                    <TaskItem
                      key={task.id}
                      task={task}
                      variant="expired"
                      recurring={rec}
                      onComplete={() => {
                        const recNote = rec ? `\n\n🔁 Ricorrente: si ripresenterà tra ${rec.intervalDays} giorn${rec.intervalDays === 1 ? 'o' : 'i'}.` : ''
                        if (window.confirm(`Chiudi "${task.title}" come completata?\n(Nessun punto aggiuntivo — la penalità di ${task.penalty}pt è già stata applicata.)${recNote}`)) {
                          actions.dismissExpiredTask(task)
                        }
                      }}
                      onEdit={() => actions.openModal('taskEdit', { task })}
                      onDelete={() => actions.deleteTask(task.id)}
                    />
                  )
                })}
              </>
            )}

            {!minimalMode && completedToday.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                variant="completed"
                recurring={recurringByTaskId[task.recurringId]}
                onComplete={() => actions.uncompleteTask(task)}
                onEdit={null}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}

function TaskItem({ task, variant, recurring, onComplete, onEdit, onDelete }) {
  const isCompleted = variant === 'completed'
  const isExpired   = variant === 'expired'
  const isActive    = variant === 'active'

  // Scadute: solo il badge "SCADUTA" resta rosso come avviso puntuale — il
  // resto della card è identico a una task normale (sfondo/bordo/colori), per
  // non dare l'impressione di una situazione di allarme ogni volta che una
  // task resta indietro.
  const borderColor = isCompleted ? 'rgba(76,175,80,0.2)' : 'var(--card-border)'
  const bgColor = isCompleted ? 'rgba(76,175,80,0.06)' : 'var(--card)'
  const accentColor = isCompleted ? '#4caf50' : getDeadlineColor(task.deadline)

  const pColor = PRIORITY_COLORS[task.priority] || '#ff7043'
  const pLabel = PRIORITY_LABELS[task.priority] || 'MEDIA'
  const deadline = formatDeadline(task.deadline)
  const [menuOpen, setMenuOpen] = useState(false)

  const longPressTimer = useRef(null)
  const didLong = useRef(false)

  function onPD() {
    if (isCompleted || (!onEdit && !isExpired)) return
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
        background: bgColor,
        borderRadius: 12, padding: '10px 12px',
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
        opacity: isCompleted ? 0.75 : 1,
        transition: 'opacity 0.2s',
      }}
      onPointerDown={onPD}
      onPointerUp={onPU}
      onPointerLeave={onPL}
    >
      {/* Barra colorata sinistra */}
      <div style={{ width: 4, minHeight: 44, borderRadius: 2, background: accentColor, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontWeight: 600, fontSize: '0.9em', color: 'var(--text)',
            textDecoration: isCompleted ? 'line-through' : 'none',
          }}>{task.title}</span>

          {isActive && (
            <span style={{
              fontSize: '0.63em', fontWeight: 700, color: pColor,
              background: `${pColor}22`, borderRadius: 4, padding: '1px 5px',
            }}>{pLabel}</span>
          )}
          {isCompleted && (
            <span style={{
              fontSize: '0.63em', fontWeight: 700, color: '#4caf50',
              background: 'rgba(76,175,80,0.15)', borderRadius: 4, padding: '1px 6px',
            }}>✓ {task.rewardApplied ? `+${task.reward}pt` : 'chiusa'}</span>
          )}
          {isExpired && (
            <span style={{
              fontSize: '0.63em', fontWeight: 700, color: '#e53935',
              background: 'rgba(229,57,53,0.15)', borderRadius: 4, padding: '1px 6px',
            }}>⚠️ SCADUTA</span>
          )}
          {recurring && (
            <span
              title={recurring.intervalDays === 1 ? 'Ricorrente: ogni giorno' : `Ricorrente: ogni ${recurring.intervalDays} giorni`}
              style={{ fontSize: '0.85em', flexShrink: 0 }}
            >🔁</span>
          )}
        </div>

        {task.description && (
          <div style={{ fontSize: '0.72em', color: '#555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.description}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {isActive && (
            <>
              <span style={{ fontSize: '0.7em', color: accentColor, fontWeight: 600 }}>📅 {deadline}</span>
              <span style={{ fontSize: '0.68em', color: '#555' }}>+{task.reward}pt / -{task.penalty}pt</span>
              {recurring && (
                <span style={{ fontSize: '0.68em', color: '#888' }}>
                  · {recurring.intervalDays === 1 ? 'ogni giorno' : `ogni ${recurring.intervalDays}gg`}
                </span>
              )}
            </>
          )}
          {isExpired && (
            <>
              <span style={{ fontSize: '0.7em', color: accentColor, fontWeight: 600 }}>📅 scad. {deadline}</span>
              <span style={{ fontSize: '0.68em', color: '#555' }}>-{task.penalty}pt applicati</span>
            </>
          )}
        </div>
      </div>

      {/* Azioni destra */}
      {isActive && (
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
      )}

      {isExpired && (
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
            title="Segna come completata (nessun punto)"
          >✓</button>
          {menuOpen ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit() }}
                onPointerDown={e => e.stopPropagation()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1em', padding: 2 }}
                title="Modifica (es. sposta a un'altra data)"
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
      )}

      {isCompleted && (
        <button
          onClick={e => { e.stopPropagation(); onComplete?.() }}
          onPointerDown={e => e.stopPropagation()}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '2px solid rgba(76,175,80,0.4)',
            background: 'rgba(76,175,80,0.1)', color: '#4caf50',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: '1em', cursor: onComplete ? 'pointer' : 'default',
          }}
          title="Completata per errore? Tocca per annullare"
        >✓</button>
      )}
    </div>
  )
}
