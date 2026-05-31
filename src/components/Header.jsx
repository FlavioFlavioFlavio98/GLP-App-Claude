import { useApp } from '../lib/store'
import LevelBar from './LevelBar'
import { useCountUp } from '../hooks/useCountUp'

export default function Header() {
  const { state, actions } = useApp()
  const { currentUser, userColors, globalData } = state
  const color = userColors[currentUser]
  const score = globalData?.score ?? 0
  const { displayVal: scoreDisplay, animClass: scoreAnim } = useCountUp(score)

  return (
    <div className="identity-bar">
      <div className="offline-badge">OFFLINE</div>
      <div className="user-info">
        <div className="avatar" style={{ background: color, boxShadow: `0 0 14px ${color}55` }}>
          {currentUser === 'flavio' ? 'F' : 'S'}
        </div>
        <div>
          <div className="username" style={{ color }}>
            {currentUser === 'flavio' ? 'Flavio' : 'Simona'}
            {' '}
            <span className={scoreAnim} style={{ fontSize: '0.75em', fontWeight: 800, opacity: 0.9 }}>
              {scoreDisplay} pt
            </span>
          </div>
          <LevelBar score={score} />
        </div>
      </div>
      <div className="header-actions">
        <button className="icon-btn" onClick={() => actions.openModal('weeklyView')} title="Dashboard Settimanale">
          <span className="material-icons-round" style={{ fontSize: 20 }}>calendar_view_week</span>
        </button>
        <button className="icon-btn" onClick={() => actions.openModal('statsPage')} title="Statistiche">
          <span className="material-icons-round" style={{ fontSize: 20 }}>bar_chart</span>
        </button>
        <button className="icon-btn" onClick={() => actions.openModal('purchaseHistory')} title="Storico acquisti">
          <span className="material-icons-round" style={{ fontSize: 20 }}>receipt_long</span>
        </button>
        <button className="icon-btn" onClick={() => actions.openModal('settings')}>
          <span className="material-icons-round" style={{ fontSize: 20 }}>settings</span>
        </button>
      </div>
    </div>
  )
}
