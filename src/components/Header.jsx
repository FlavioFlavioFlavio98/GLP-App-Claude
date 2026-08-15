import { useApp } from '../lib/store'
import { useCountUp } from '../hooks/useCountUp'

export default function Header({ isReadOnly }) {
  const { state, actions } = useApp()
  const { currentUser, authUserId, userColors, globalData, allUsersData } = state
  const color = userColors[currentUser]
  const score = globalData?.score ?? 0
  const { displayVal: scoreDisplay, animClass: scoreAnim } = useCountUp(score)

  // Avatar: from profile, fallback to default emoji
  const authData = allUsersData[authUserId]
  const avatar = authData?.profile?.avatar || (authUserId === 'flavio' ? '🔥' : '⭐')

  return (
    <div className="identity-bar">
      <div className="offline-badge">OFFLINE</div>
      <div className="user-info">
        {/* Avatar — tap to customize (only own user) */}
        <div
          className="avatar"
          style={{
            background: color + '33', border: `2px solid ${color}`,
            boxShadow: `0 0 14px ${color}55`,
            cursor: !isReadOnly ? 'pointer' : 'default',
            fontSize: '1.2em',
          }}
          onClick={() => !isReadOnly && actions.openModal('avatar')}
          title={!isReadOnly ? 'Cambia avatar' : undefined}
        >
          {avatar}
        </div>
        <div>
          <span className={scoreAnim} style={{ color, fontSize: '1.1em', fontWeight: 800 }}>
            {scoreDisplay} pt
          </span>
        </div>
      </div>
      <div className="header-actions">
        {!isReadOnly && (
          <button className="icon-btn" onClick={() => actions.openModal('insights')} title="Insight">
            <span style={{ fontSize: 18 }}>💡</span>
          </button>
        )}
        <button className="icon-btn" onClick={() => actions.openModal('settings')}>
          <span className="material-icons-round" style={{ fontSize: 20 }}>settings</span>
        </button>
      </div>
    </div>
  )
}
