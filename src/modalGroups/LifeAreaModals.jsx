import LifeAreaLogModal from '../modals/LifeAreaLogModal'
import LifeAreaManageModal from '../modals/LifeAreaManageModal'

export const LIFEAREA_MODALS = ['lifeAreaLog', 'lifeAreaManage']

export default function LifeAreaModals({ authUserId }) {
  return authUserId === 'flavio' ? (
    <>
      <LifeAreaLogModal />
      <LifeAreaManageModal />
    </>
  ) : null
}
