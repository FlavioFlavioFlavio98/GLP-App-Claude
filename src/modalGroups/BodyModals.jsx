import BarefootSessionModal from '../modals/BarefootSessionModal'
import HangSessionModal from '../modals/HangSessionModal'

export const BODY_MODALS = ['barefoot', 'hang']

export default function BodyModals({ authUserId }) {
  return (
    <>
      {authUserId === 'flavio' && <BarefootSessionModal />}
      {authUserId === 'flavio' && <HangSessionModal />}
    </>
  )
}
