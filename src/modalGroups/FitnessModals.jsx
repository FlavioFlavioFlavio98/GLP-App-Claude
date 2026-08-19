import QuickExerciseModal from '../modals/QuickExerciseModal'
import ExerciseStatsModal from '../modals/ExerciseStatsModal'
import ExerciseSingleView from '../modals/ExerciseSingleView'
import WeightModal from '../modals/WeightModal'
import CoachPage from '../modals/CoachPage'
import MobilitySessionModal from '../modals/MobilitySessionModal'
import StudySessionModal from '../modals/StudySessionModal'

export const FITNESS_MODALS = ['quickExercise', 'exerciseStats', 'exerciseSingle', 'weight', 'coach', 'mobility', 'study']

export default function FitnessModals({ authUserId }) {
  return (
    <>
      <QuickExerciseModal />
      <ExerciseStatsModal />
      {authUserId === 'flavio' && <ExerciseSingleView />}
      {authUserId === 'flavio' && <WeightModal />}
      {authUserId === 'flavio' && <CoachPage />}
      {authUserId === 'flavio' && <MobilitySessionModal />}
      {authUserId === 'flavio' && <StudySessionModal />}
    </>
  )
}
