import LifeAreaLogModal from '../modals/LifeAreaLogModal'
import LifeAreaManageModal from '../modals/LifeAreaManageModal'
import LifeAreaDetailModal from '../modals/LifeAreaDetailModal'

export const LIFEAREA_MODALS = ['lifeAreaLog', 'lifeAreaManage', 'lifeAreaDetail']

export default function LifeAreaModals({ authUserId }) {
  return authUserId === 'flavio' ? (
    <>
      <LifeAreaLogModal />
      <LifeAreaManageModal />
      <LifeAreaDetailModal />
    </>
  ) : null
}
