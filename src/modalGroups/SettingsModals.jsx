import SettingsModal from '../modals/SettingsModal'
import ThemeModal from '../modals/ThemeModal'
import NotificationsModal from '../modals/NotificationsModal'
import AchievementsModal from '../modals/AchievementsModal'
import AvatarModal from '../modals/AvatarModal'
import BackupModal from '../modals/BackupModal'
import AppUsageModal from '../modals/AppUsageModal'
import QuotesModal from '../modals/QuotesModal'

export const SETTINGS_MODALS = ['settings', 'themeModal', 'notifications', 'achievements', 'avatar', 'backup', 'appUsage', 'quotesModal']

export default function SettingsModals({ authUserId, onOpenPsych, onOpenReadings }) {
  return (
    <>
      <SettingsModal onOpenPsych={onOpenPsych} onOpenReadings={onOpenReadings} />
      <ThemeModal />
      <NotificationsModal />
      <AchievementsModal />
      <AvatarModal />
      <BackupModal />
      {authUserId === 'flavio' && <AppUsageModal />}
      {authUserId === 'flavio' && <QuotesModal />}
    </>
  )
}
