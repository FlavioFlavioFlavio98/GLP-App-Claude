import { useApp } from '../lib/store'
import { useCountUp } from '../hooks/useCountUp'
import { APP_VERSION } from '../version'

const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

function formatBuildTime(raw) {
  if (!raw) return null
  // Formato atteso: "2026-08-24 15:42 UTC"
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (!m) return raw
  return `${parseInt(m[3])} ${MONTHS_IT[parseInt(m[2]) - 1]} ${m[1]}, ${m[4]}:${m[5]}`
}

// Visibile su ogni tab (a differenza del BuildInfo dentro DailySummaryPanel,
// nascosto su Workout/Benessere/Mente/Nutrizione) — per sapere sempre, con
// un'occhiata, se si sta usando l'ultima versione pubblicata.
function VersionBadge() {
  const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
  const buildTime = isNative
    ? (typeof window !== 'undefined' ? window.__ANDROID_BUILD_TIME__ : null)
    : (typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null)
  const formatted = formatBuildTime(buildTime)

  return (
    <div style={{
      fontSize: '0.6em', color: 'var(--text-sec)', opacity: 0.5,
      fontFamily: 'monospace', textAlign: 'center', padding: '2px 0 0',
      userSelect: 'text',
    }}>
      v{APP_VERSION}{formatted ? ` · ${formatted}` : ''}
    </div>
  )
}

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
    <>
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
    <VersionBadge />
    </>
  )
}
