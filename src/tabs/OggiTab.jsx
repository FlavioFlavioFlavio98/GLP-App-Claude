import TaskSection from '../components/TaskSection'
import HabitsSection from '../components/HabitsSection'

export default function OggiTab({ authUserId, isReadOnly, minimalMode, habitsSectionProps }) {
  return (
    <>
      {/* Task di oggi */}
      {authUserId === 'flavio' && !isReadOnly && <TaskSection minimalMode={minimalMode} />}

      {/* Abitudini di oggi */}
      <HabitsSection {...habitsSectionProps} />
    </>
  )
}
