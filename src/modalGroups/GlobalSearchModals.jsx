import GlobalSearchModal from '../modals/GlobalSearchModal'

export const GLOBAL_SEARCH_MODALS = ['globalSearch']

export default function GlobalSearchModals({ authUserId }) {
  return authUserId === 'flavio' ? <GlobalSearchModal /> : null
}
