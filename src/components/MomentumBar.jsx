import { useState } from 'react'
import { calcMomentumScore } from '../lib/statsLogic'

function getLabel(score) {
  if (score >= 81) return { text: 'In fiamme 🔥', color: 'var(--success)', glow: true }
  if (score >= 61) return { text: 'In crescita 📈', color: '#69f0ae', glow: false }
  if (score >= 31) return { text: 'Stabile 📊', color: '#EF9F27', glow: false }
  return { text: 'In difficoltà 📉', color: 'var(--danger)', glow: false }
}

export default function MomentumBar({ userData }) {
  const [tooltip, setTooltip] = useState(false)
  if (!userData) return null

  const data = calcMomentumScore(userData)
  const { score, trend7, avgPrev7, streak, daysAboveAvg, consistency, avg30 } = data
  const { text, color, glow } = getLabel(score)

  return (
    <div style={{ marginTop: 10, marginBottom: 16, position: 'relative' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        onClick={() => setTooltip(v => !v)}
      >
        <span style={{ fontSize: '0.68em', color: '#555', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, flexShrink: 0 }}>
          Momentum
        </span>
        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: color,
            width: `${score}%`,
            transition: 'width 0.6s ease',
            boxShadow: glow ? `0 0 8px ${color}` : 'none',
          }} />
        </div>
        <span style={{ fontSize: '0.85em', fontWeight: 800, color, minWidth: 30, textAlign: 'right' }}>{score}</span>
        <span style={{ fontSize: '0.72em', color, flexShrink: 0 }}>{text}</span>
      </div>

      {tooltip && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 500,
          background: 'var(--card-solid)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: '14px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.15s ease',
        }} onClick={() => setTooltip(false)}>
          <div style={{ fontSize: '0.7em', color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>
            Dettaglio Momentum
          </div>
          {[
            { label: 'Trend 7gg vs prev 7gg', value: `${trend7 > 0 ? '+' : ''}${trend7} vs ${avgPrev7 > 0 ? '+' : ''}${avgPrev7}/gg`, weight: '35%' },
            { label: 'Streak attuale', value: `${streak} giorni`, weight: '30%' },
            { label: 'Giorni sopra media (7gg)', value: `${daysAboveAvg}/7`, weight: '20%' },
            { label: 'Consistenza (30gg)', value: `${consistency}%`, weight: '15%' },
          ].map(({ label, value, weight }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82em' }}>
              <span style={{ color: '#888' }}>{label} <span style={{ color: '#555', fontSize: '0.8em' }}>({weight})</span></span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{value}</span>
            </div>
          ))}
          <div style={{ fontSize: '0.68em', color: '#444', marginTop: 8, textAlign: 'center' }}>
            Media giornaliera 30gg: {avg30 > 0 ? '+' : ''}{avg30}
          </div>
        </div>
      )}
    </div>
  )
}
