import { useEffect, useState } from 'react'
import { useApp } from '../lib/store'
import LevelBar from './LevelBar'
import { useCountUp } from '../hooks/useCountUp'
import { trackEvent } from '../lib/achievementLogic'
import { db } from '../lib/firebase'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { readingUrgency } from '../modals/ReadingsPage'

function useReadingsBadge(authUserId) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!authUserId) return
    const q = query(collection(db, 'users', authUserId, 'readings'))
    return onSnapshot(q, snap => {
      const urgent = snap.docs.filter(d => readingUrgency({ id: d.id, ...d.data() }).level >= 1).length
      setCount(urgent)
    })
  }, [authUserId])
  return count
}

export default function Header({ isReadOnly, onOpenPsych, onOpenReadings }) {
  const { state, actions } = useApp()
  const { currentUser, authUserId, userColors, globalData, allUsersData } = state
  const color = userColors[currentUser]
  const score = globalData?.score ?? 0
  const { displayVal: scoreDisplay, animClass: scoreAnim } = useCountUp(score)

  // Avatar: from profile, fallback to default emoji
  const authData = allUsersData[authUserId]
  const avatar = authData?.profile?.avatar || (authUserId === 'flavio' ? '🔥' : '⭐')

  const displayName = currentUser === 'flavio' ? 'Flavio' : 'Simona'
  const readingsBadge = useReadingsBadge(!isReadOnly ? authUserId : null)

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
        {/* Salute — solo Flavio */}
        {authUserId === 'flavio' && !isReadOnly && (
          <button className="icon-btn" onClick={() => actions.openModal('health')} title="Salute">
            <span style={{ fontSize: 18 }}>❤️</span>
          </button>
        )}
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
        {!isReadOnly && onOpenReadings && (
          <button className="icon-btn" onClick={onOpenReadings} title="Letture" style={{ position: 'relative' }}>
            <span style={{ fontSize: 18 }}>📚</span>
            {readingsBadge > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                minWidth: 16, height: 16, borderRadius: 8,
                background: '#e53935', color: '#fff',
                fontSize: '0.6em', fontWeight: 800, lineHeight: '16px',
                textAlign: 'center', padding: '0 3px',
              }}>
                {readingsBadge}
              </span>
            )}
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
