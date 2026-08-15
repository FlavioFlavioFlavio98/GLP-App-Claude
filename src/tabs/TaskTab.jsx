import { useRef } from 'react'
import TaskSection from '../components/TaskSection'

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
  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione task non disponibile</div>
  }
  return (
    <>
      <TaskSection minimalMode={false} />
      <TaskFab actions={actions} />
    </>
  )
}
