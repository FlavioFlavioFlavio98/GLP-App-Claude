import TaskModal from '../modals/TaskModal'
import TaskHistoryModal from '../modals/TaskHistoryModal'
import RecurringTasksModal from '../modals/RecurringTasksModal'

export const TASK_MODALS = ['taskAdd', 'taskEdit', 'taskHistory', 'recurringTasks']

export default function TaskModals({ authUserId }) {
  return (
    <>
      {authUserId === 'flavio' && <TaskModal />}
      {authUserId === 'flavio' && <TaskHistoryModal />}
      {authUserId === 'flavio' && <RecurringTasksModal />}
    </>
  )
}
