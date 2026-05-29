import { useApp } from '../lib/store'

export default function Header() {
  const { state, actions } = useApp()
  const { currentUser } = state

  return (
    <div className="identity-bar">
      <div className="offline-badge">OFFLINE</div>
      <div className="user-info">
        <div className="avatar">{currentUser === 'flavio' ? 'F' : 'S'}</div>
        <div className="username">{currentUser === 'flavio' ? 'Flavio' : 'Simona'}</div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="icon-btn" onClick={() => actions.openModal('statsPage')} title="Statistiche">
          <span className="material-icons-round">bar_chart</span>
        </button>
        <button className="icon-btn" onClick={() => actions.openModal('settings')}>
          <span className="material-icons-round">settings</span>
        </button>
      </div>
    </div>
  )
}
