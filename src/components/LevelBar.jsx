import { useState } from 'react'
import { getLevel } from '../lib/levels'

export default function LevelBar({ score }) {
  const [showTip, setShowTip] = useState(false)
  const info = getLevel(score)

  return (
    <div className="level-wrap">
      <div className="level-label">
        <span className="level-badge">Lv.{info.level}</span>
        <span className="level-name">{info.name}</span>
      </div>

      <div
        className="xp-bar-track"
        onClick={() => setShowTip(v => !v)}
        title="Tap per dettagli XP"
      >
        <div
          className="xp-bar-fill"
          style={{ width: `${info.progress}%` }}
        />
      </div>

      {showTip && (
        <div className="xp-tooltip">
          <div><strong>{info.xp.toLocaleString()}</strong> XP totali</div>
          {info.nextMin && (
            <>
              <div>Prossimo livello: <strong>{info.nextMin.toLocaleString()}</strong> XP</div>
              <div>Mancano: <strong style={{ color: 'var(--theme-color)' }}>{info.xpToNext.toLocaleString()}</strong> XP</div>
            </>
          )}
          {!info.nextMin && <div style={{ color: 'var(--theme-color)' }}>Livello massimo raggiunto! 🏆</div>}
          <button className="xp-tip-close" onClick={e => { e.stopPropagation(); setShowTip(false) }}>✕</button>
        </div>
      )}
    </div>
  )
}
