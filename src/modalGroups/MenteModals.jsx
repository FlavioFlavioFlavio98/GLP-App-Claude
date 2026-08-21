import WillpowerEntryModal from '../modals/WillpowerEntryModal'

export const MENTE_MODALS = ['willpowerEntry']

export default function MenteModals({ authUserId }) {
  return (
    <>
      {authUserId === 'flavio' && <WillpowerEntryModal />}
    </>
  )
}
