import WillpowerSection from './WillpowerSection'
import DayRecapSection from './DayRecapSection'
import DiscoveriesSection from './DiscoveriesSection'
import MeditationSection from './MeditationSection'

export default function MenteTab({ actions, authUserId, isReadOnly, globalData }) {
  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione non disponibile</div>
  }

  const willpowerLog = globalData?.willpowerLog || {}
  const dayRecapLog = globalData?.dayRecapLog || {}
  const discoveries = globalData?.discoveries || []
  const meditationLog = globalData?.meditationLog || {}
  const meditationNotes = globalData?.meditationNotes || {}

  return (
    <div style={{ paddingTop: 8 }}>
      <DayRecapSection dayRecapLog={dayRecapLog} actions={actions} />
      <MeditationSection meditationLog={meditationLog} meditationNotes={meditationNotes} actions={actions} />
      <DiscoveriesSection discoveries={discoveries} actions={actions} />
      <WillpowerSection willpowerLog={willpowerLog} actions={actions} />
    </div>
  )
}
