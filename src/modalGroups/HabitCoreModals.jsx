import AddModal from '../modals/AddModal'
import EditModal from '../modals/EditModal'
import TagModal from '../modals/TagModal'
import RewardCategoryModal from '../modals/RewardCategoryModal'
import SingleHabitView from '../modals/SingleHabitView'
import SingleRewardView from '../modals/SingleRewardView'

export const HABIT_CORE_MODALS = ['add', 'edit', 'tags', 'rewardCategories', 'singleHabit', 'singleReward']

export default function HabitCoreModals() {
  return (
    <>
      <AddModal />
      <EditModal />
      <TagModal />
      <RewardCategoryModal />
      <SingleHabitView />
      <SingleRewardView />
    </>
  )
}
