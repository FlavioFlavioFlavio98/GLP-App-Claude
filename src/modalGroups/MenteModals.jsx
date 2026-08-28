import WillpowerEntryModal from '../modals/WillpowerEntryModal'
import WillpowerStatsModal from '../modals/WillpowerStatsModal'
import DiscoveriesModal from '../modals/DiscoveriesModal'

export const MENTE_MODALS = ['willpowerEntry', 'willpowerStats', 'discoveries']

export default function MenteModals({ authUserId }) {
  return (
    <>
      {authUserId === 'flavio' && <WillpowerEntryModal />}
      {authUserId === 'flavio' && <WillpowerStatsModal />}
      {authUserId === 'flavio' && <DiscoveriesModal />}
    </>
  )
}
