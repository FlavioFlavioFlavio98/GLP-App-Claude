import { useApp } from '../lib/store'

export default function ScoreBoard() {
  const { state, actions } = useApp()
  const { currentUser, allUsersData } = state

  return (
    <div className="scoreboard-mini">
      <div className={`score-row${currentUser === 'flavio' ? ' active' : ''}`} onClick={() => actions.switchUser('flavio')}>
        <span>Flavio</span>
        <strong>{allUsersData.flavio?.score ?? '--'}</strong>
      </div>
      <div className={`score-row${currentUser === 'simona' ? ' active' : ''}`} onClick={() => actions.switchUser('simona')}>
        <span>Simona</span>
        <strong>{allUsersData.simona?.score ?? '--'}</strong>
      </div>
    </div>
  )
}
