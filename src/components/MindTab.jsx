import YouTubeSocialSection from './YouTubeSocialSection'

export default function MindTab({ authUserId, isReadOnly, globalData, actions }) {
  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione non disponibile</div>
  }

  const mindSocialLog = globalData?.mindSocialLog || {}

  return (
    <div style={{ paddingTop: 8 }}>
      <YouTubeSocialSection mindSocialLog={mindSocialLog} actions={actions} />
    </div>
  )
}
