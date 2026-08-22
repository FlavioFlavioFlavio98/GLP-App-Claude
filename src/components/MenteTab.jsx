import WillpowerSection from './WillpowerSection'
import DayRecapSection from './DayRecapSection'

export default function MenteTab({ actions, authUserId, isReadOnly, globalData }) {
  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione non disponibile</div>
  }

  const willpowerLog = globalData?.willpowerLog || {}
  const dayRecapLog = globalData?.dayRecapLog || {}

  return (
    <div style={{ paddingTop: 8 }}>
      <DayRecapSection dayRecapLog={dayRecapLog} actions={actions} />
      <WillpowerSection willpowerLog={willpowerLog} actions={actions} />
    </div>
  )
}
