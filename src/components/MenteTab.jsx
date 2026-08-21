import WillpowerSection from './WillpowerSection'

export default function MenteTab({ actions, authUserId, isReadOnly, globalData }) {
  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione non disponibile</div>
  }

  const willpowerLog = globalData?.willpowerLog || {}

  return (
    <div style={{ paddingTop: 8 }}>
      <WillpowerSection willpowerLog={willpowerLog} actions={actions} />
    </div>
  )
}
