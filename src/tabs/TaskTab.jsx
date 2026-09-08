import { useRef, useState } from 'react'
import TaskSection from '../components/TaskSection'
import TaskTimerCard, { readTaskTimerSession } from '../components/TaskTimerCard'
import { useApp } from '../lib/store'

function TaskFab({ actions }) {
  const longPressTimer = useRef(null)
  const didLongPress = useRef(false)

  function onPointerDown() {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      actions.showToast('Nuova Task', '📋')
      navigator.vibrate?.([30])
    }, 500)
  }
  function onPointerUp() {
    clearTimeout(longPressTimer.current)
    if (!didLongPress.current) actions.openModal('taskAdd')
  }
  function onPointerLeave() { clearTimeout(longPressTimer.current) }

  return (
    <button
      className="fab fab-tertiary"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      title="Nuova Task"
    >
      <span style={{ fontSize: '1.3em', lineHeight: 1 }}>📋</span>
    </button>
  )
}

export default function TaskTab({ authUserId, isReadOnly, actions }) {
  const { state } = useApp()
  // Stato sollevato qui (non dentro TaskTimerCard) perché serve anche a
  // TaskSection per disabilitare il pulsante ▶️ sulle altre task mentre un
  // timer è già attivo — inizializzato da localStorage per ripristinare una
  // sessione già in corso anche dopo un reload della pagina.
  const [timerTaskId, setTimerTaskId] = useState(() => readTaskTimerSession()?.taskId || null)

  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione task non disponibile</div>
  }

  const timerTask = (state.globalData?.tasks || []).find(t => t.id === timerTaskId)
  const timerTaskTitle = timerTask?.title || readTaskTimerSession()?.taskTitle || ''

  return (
    <>
      <TaskSection
        minimalMode={false}
        activeTimerTaskId={timerTaskId}
        onStartTimer={taskId => setTimerTaskId(taskId)}
      />
      <TaskFab actions={actions} />
      {timerTaskId && (
        <TaskTimerCard
          taskId={timerTaskId}
          taskTitle={timerTaskTitle}
          actions={actions}
          onFinish={seconds => {
            actions.addTaskTimeSpent(timerTaskId, seconds)
            setTimerTaskId(null)
          }}
          onCancel={() => setTimerTaskId(null)}
        />
      )}
    </>
  )
}
