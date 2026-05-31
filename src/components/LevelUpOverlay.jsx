import { useEffect } from 'react'

export default function LevelUpOverlay({ levelInfo, onClose }) {
  useEffect(() => {
    import('canvas-confetti').then(m => {
      const confetti = m.default
      const end = Date.now() + 3000
      const colors = ['#ffca28', '#d05ce3', '#4caf50', '#ff7043', '#7986cb']
      ;(function frame() {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
        if (Date.now() < end) requestAnimationFrame(frame)
      })()
    })
  }, [])

  return (
    <div className="levelup-overlay" onClick={onClose}>
      <div className="levelup-box" onClick={e => e.stopPropagation()}>
        <div className="levelup-icon">⚡</div>
        <div className="levelup-title">LEVEL UP!</div>
        <div className="levelup-sub">Sei diventato</div>
        <div className="levelup-name">{levelInfo.name}</div>
        <div className="levelup-badge">Lv.{levelInfo.level}</div>
        <button className="btn-main" style={{ marginTop: 28 }} onClick={onClose}>
          Continua 🎉
        </button>
      </div>
    </div>
  )
}
