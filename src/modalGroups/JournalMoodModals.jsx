import EveningReviewModal from '../modals/EveningReviewModal'
import MoodModal from '../modals/MoodModal'
import InsightModal from '../modals/InsightModal'
import WeeklyRecapModal from '../modals/WeeklyRecapModal'
import JournalModal from '../modals/JournalModal'
import JournalViewModal from '../modals/JournalViewModal'

export const JOURNAL_MOOD_MODALS = ['eveningReview', 'mood', 'insights', 'weeklyRecap', 'journal', 'journalView']

export default function JournalMoodModals({ isReadOnly }) {
  return (
    <>
      <EveningReviewModal />
      <MoodModal />
      <InsightModal />
      <WeeklyRecapModal />
      {!isReadOnly && <JournalModal />}
      {!isReadOnly && <JournalViewModal />}
    </>
  )
}
