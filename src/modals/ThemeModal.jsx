import { useApp } from '../lib/store'
import { THEMES } from '../lib/themes'

export default function ThemeModal() {
  const { state, actions } = useApp()
  const { modal, theme: activeTheme } = state

  if (modal !== 'themeModal') return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <h3>🎨 Scegli Tema</h3>
        <div className="theme-grid">
          {Object.values(THEMES).map(t => (
            <ThemeCard
              key={t.id}
              theme={t}
              active={activeTheme === t.id}
              onSelect={() => {
                actions.setTheme(t.id)
                actions.vibrate('light')
              }}
            />
          ))}
        </div>
        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}

function ThemeCard({ theme, active, onSelect }) {
  return (
    <div
      className={`theme-card${active ? ' active' : ''}`}
      style={{ background: theme.bg }}
      onClick={onSelect}
    >
      <div className="theme-card-preview" style={{ background: `linear-gradient(135deg, ${theme.bg}, ${theme.cardSolid})` }}>
        <div className="theme-dot" style={{ background: theme.themeColor, boxShadow: `0 0 10px ${theme.themeGlow}` }} />
        <div className="theme-bar" style={{ background: `linear-gradient(90deg, ${theme.themeColor}, ${theme.accent2})`, opacity: 0.7 }} />
      </div>
      <div className="theme-card-label" style={{ background: theme.cardSolid, color: active ? theme.themeColor : '#aaa' }}>
        <span>{theme.name}</span>
        <span className="material-icons-round theme-check" style={{ fontSize: 16 }}>check_circle</span>
      </div>
    </div>
  )
}
