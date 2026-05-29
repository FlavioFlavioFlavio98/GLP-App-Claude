export default function ProgressCircle({ earned, total }) {
  const r = 42
  const circ = r * 2 * Math.PI
  let pct = total > 0 ? Math.min(100, Math.max(0, (earned / total) * 100)) : 0
  const offset = circ - (pct / 100) * circ

  return (
    <div className="progress-container">
      <svg className="progress-ring" width="100" height="100">
        <circle stroke="#2a2a2a" strokeWidth="8" fill="transparent" r={r} cx="50" cy="50" />
        <circle
          className="progress-ring__circle"
          stroke="var(--theme-color)"
          strokeWidth="8"
          fill="transparent"
          r={r} cx="50" cy="50"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="progress-text">{Math.round(pct)}%</div>
    </div>
  )
}
