import { useApp } from '../lib/store'

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
            <strong style={{ color: isActive ? color : undefined }}>
              {allUsersData[u]?.score ?? '--'}
            </strong>
          </div>
        )
      })}
    </div>
  )
}
