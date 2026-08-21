import WillpowerEntryModal from '../modals/WillpowerEntryModal'
import WillpowerStatsModal from '../modals/WillpowerStatsModal'

export const MENTE_MODALS = ['willpowerEntry', 'willpowerStats']

export default function MenteModals({ authUserId }) {
  return (
    <>
      {authUserId === 'flavio' && <WillpowerEntryModal />}
      {authUserId === 'flavio' && <WillpowerStatsModal />}
    </>
  )
}
