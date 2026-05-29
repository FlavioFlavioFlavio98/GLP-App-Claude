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
      <button className="icon-btn" onClick={() => actions.openModal('settings')}>
        <span className="material-icons-round">settings</span>
      </button>
    </div>
  )
}
