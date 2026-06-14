import { useApp } from '../lib/store'
import { useAnimatedScore } from '../hooks/useAnimatedScore'

function AnimatedScore({ score, color }) {
  const { display, delta } = useAnimatedScore(score ?? 0)

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <strong style={{ color }}>{display}</strong>
      {delta && (
        <span
          key={delta.key}
          className="score-delta"
          style={{ color: delta.value >= 0 ? '#4caf50' : '#e53935' }}
        >
          {delta.value > 0 ? `+${delta.value}` : delta.value}
        </span>
      )}
    </span>
  )
}

export default function ScoreBoard() {
  const { state, actions } = useApp()
  const { currentUser, allUsersData, userColors } = state

  return (
    <div className="scoreboard-mini">
      {['flavio', 'simona'].map(u => {
        const isActive = currentUser === u
        const color = userColors[u]
        return (
          <div
            key={u}
            className={`score-row${isActive ? ' active' : ''}`}
            onClick={() => actions.switchUser(u)}
          >
            <div className="user-label">
              <div className="score-dot" style={{ background: color, boxShadow: isActive ? `0 0 6px ${color}` : 'none' }} />
              <span style={{ color: isActive ? color : undefined }}>
                {u === 'flavio' ? 'Flavio' : 'Simona'}
              </span>
            </div>
            <AnimatedScore score={allUsersData[u]?.score} color={isActive ? color : undefined} />
          </div>
        )
      })}
    </div>
  )
}
