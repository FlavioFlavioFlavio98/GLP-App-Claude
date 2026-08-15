import TaskModal from '../modals/TaskModal'
import TaskHistoryModal from '../modals/TaskHistoryModal'

export const TASK_MODALS = ['taskAdd', 'taskEdit', 'taskHistory']

export default function TaskModals({ authUserId }) {
  return (
    <>
      {authUserId === 'flavio' && <TaskModal />}
      {authUserId === 'flavio' && <TaskHistoryModal />}
    </>
  )
}
