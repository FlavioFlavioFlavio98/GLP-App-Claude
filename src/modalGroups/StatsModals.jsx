import AnalyticsModal from '../modals/AnalyticsModal'
import StatsModal from '../modals/StatsModal'
import StatsPage from '../modals/StatsPage'
import PurchaseHistoryView from '../modals/PurchaseHistoryView'
import WeeklyView from '../modals/WeeklyView'
import PdfReportModal from '../modals/PdfReportModal'
import ActivityLogModal from '../modals/ActivityLogModal'

export const STATS_MODALS = ['analytics', 'stats', 'statsPage', 'purchaseHistory', 'weeklyView', 'pdfReport', 'activityLog']

export default function StatsModals() {
  return (
    <>
      <AnalyticsModal />
      <StatsModal />
      <StatsPage />
      <PurchaseHistoryView />
      <WeeklyView />
      <PdfReportModal />
      <ActivityLogModal />
    </>
  )
}
