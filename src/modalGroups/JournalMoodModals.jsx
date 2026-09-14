import EveningReviewModal from '../modals/EveningReviewModal'
import MoodModal from '../modals/MoodModal'
import InsightModal from '../modals/InsightModal'
import JournalModal from '../modals/JournalModal'
import JournalViewModal from '../modals/JournalViewModal'

export const JOURNAL_MOOD_MODALS = ['eveningReview', 'mood', 'insights', 'journal', 'journalView']

export default function JournalMoodModals({ isReadOnly }) {
  return (
    <>
      <EveningReviewModal />
      <MoodModal />
      <InsightModal />
      {!isReadOnly && <JournalModal />}
      {!isReadOnly && <JournalViewModal />}
    </>
  )
}
