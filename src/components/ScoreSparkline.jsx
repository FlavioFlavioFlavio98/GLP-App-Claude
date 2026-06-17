import { getDailyNet, toDateString } from '../lib/habitLogic'

export default function ScoreSparkline({ habits, rewards, dailyLogs }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return toDateString(d)
  })

  const values = days.map(date => getDailyNet({ habits, rewards, dailyLogs }, date))
  const max = Math.max(...values.map(Math.abs), 1)
  const w = 120, h = 36, pad = 4

  const pts = values.map((v, i) => {
    const x = pad + (i / 6) * (w - pad * 2)
    const y = h / 2 - (v / max) * (h / 2 - pad)
    return `${x},${y}`
  })
  const pointsStr = pts.join(' ')
  const lastPt = pts[pts.length - 1].split(',')

  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2,2" />
      <polyline
        points={pointsStr}
        fill="none"
        stroke="var(--theme-color)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3" fill="var(--theme-color)" />
    </svg>
  )
}
