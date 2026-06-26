import { useApp } from '../lib/store'
import LevelBar from './LevelBar'
import { useCountUp } from '../hooks/useCountUp'
import { trackEvent } from '../lib/achievementLogic'

export default function Header({ isReadOnly, onOpenPsych }) {
  const { state, actions } = useApp()
  const { currentUser, authUserId, userColors, globalData, allUsersData } = state
  const color = userColors[currentUser]
  const score = globalData?.score ?? 0
  const { displayVal: scoreDisplay, animClass: scoreAnim } = useCountUp(score)

  // Avatar: from profile, fallback to default emoji
  const authData = allUsersData[authUserId]
  const avatar = authData?.profile?.avatar || (authUserId === 'flavio' ? '🔥' : '⭐')

  const displayName = currentUser === 'flavio' ? 'Flavio' : 'Simona'

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
          <div className="username" style={{ color }}>
            {displayName}
            {' '}
            <span className={scoreAnim} style={{ fontSize: '0.75em', fontWeight: 800, opacity: 0.9 }}>
              {scoreDisplay} pt
            </span>
          </div>
          <LevelBar score={score} />
        </div>
      </div>
      <div className="header-actions">
        {/* Psicologo AI — solo Flavio, solo non read-only */}
        {authUserId === 'flavio' && !isReadOnly && onOpenPsych && (
          <button className="icon-btn" onClick={onOpenPsych} title="Psicologo AI">
            <span style={{ fontSize: 18 }}>🧠</span>
          </button>
        )}
        {/* Coach — solo Flavio, solo non read-only */}
        {authUserId === 'flavio' && !isReadOnly && (
          <button className="icon-btn" onClick={() => actions.openModal('coach')} title="Coach AI">
            <span style={{ fontSize: 18 }}>🤖</span>
          </button>
        )}
        <button className="icon-btn" onClick={() => actions.openModal('weeklyView')} title="Dashboard Settimanale">
          <span className="material-icons-round" style={{ fontSize: 20 }}>calendar_view_week</span>
        </button>
        <button className="icon-btn" onClick={() => actions.openModal('settings')}>
          <span className="material-icons-round" style={{ fontSize: 20 }}>settings</span>
        </button>
      </div>
    </div>
  )
}
