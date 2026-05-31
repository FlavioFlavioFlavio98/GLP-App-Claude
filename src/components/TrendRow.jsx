import { useState } from 'react'
import { buildWeekTrend } from '../lib/statsLogic'

export default function TrendRow({ userData }) {
  const [tooltip, setTooltip] = useState(false)
  if (!userData) return null

  const { recent, prev, recentAvg, prevAvg, pct } = buildWeekTrend(userData)

  let arrow, color, label
  if (Math.abs(pct) < 5) {
    arrow = '→'; color = '#666'; label = 'Stabile'
  } else if (pct > 0) {
    arrow = '↑'; color = 'var(--success)'; label = `+${Math.round(pct)}%`
  } else {
    arrow = '↓'; color = 'var(--danger)'; label = `${Math.round(pct)}%`
  }

  return (
    <div style={{ textAlign: 'center', marginTop: -14, marginBottom: 14, position: 'relative' }}>
      <button
        onClick={() => setTooltip(v => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.72em', color: '#555',
          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
        }}
      >
        vs settimana scorsa
        <span style={{ color, fontWeight: 700 }}>{arrow} {label}</span>
      </button>

      {tooltip && (
        <div
          style={{
            position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--card-solid)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '12px 16px', fontSize: '0.78em',
            zIndex: 500, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={() => setTooltip(false)}
        >
          <div style={{ marginBottom: 4, color: '#aaa' }}>
            Ultimi 7 gg: <strong style={{ color: recent >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {recent > 0 ? '+' : ''}{Math.round(recent)} ({recentAvg > 0 ? '+' : ''}{recentAvg.toFixed(1)}/gg)
            </strong>
          </div>
          <div style={{ color: '#aaa' }}>
            Prec. 7 gg:&nbsp; <strong style={{ color: prev >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {prev > 0 ? '+' : ''}{Math.round(prev)} ({prevAvg > 0 ? '+' : ''}{prevAvg.toFixed(1)}/gg)
            </strong>
          </div>
        </div>
      )}
    </div>
  )
}
