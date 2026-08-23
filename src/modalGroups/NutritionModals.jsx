import ProteinEntryModal from '../modals/ProteinEntryModal'
import ProteinFoodsManageModal from '../modals/ProteinFoodsManageModal'

export const NUTRITION_MODALS = ['proteinEntry', 'proteinFoodsManage']

export default function NutritionModals({ authUserId }) {
  return (
    <>
      {authUserId === 'flavio' && <ProteinEntryModal />}
      {authUserId === 'flavio' && <ProteinFoodsManageModal />}
    </>
  )
}
