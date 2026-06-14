import { useState } from 'react'

export default function MissionsCard({ missions }) {
  const [expanded, setExpanded] = useState(true)

  if (!missions?.list?.length) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 12,
    }}>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: expanded ? 12 : 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '0.9em' }}>🎯 Missioni di oggi</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75em', color: '#666' }}>
            {missions.list.filter(m => m.done).length}/{missions.list.length}
          </span>
          <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--theme-color)' }}>
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {missions.list.map(m => (
            <MissionRow key={m.id} mission={m} />
          ))}
        </div>
      )}
    </div>
  )
}

function MissionRow({ mission }) {
  const { title, pts, progress, target, done, type } = mission
  const pct = type === 'no_failures'
    ? (done ? 100 : 0)
    : Math.min(100, target > 0 ? Math.round((progress / target) * 100) : 0)

  return (
    <div style={{ opacity: done ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{
          fontSize: '0.82em',
          textDecoration: done ? 'line-through' : 'none',
          color: done ? '#aaa' : 'inherit',
          flex: 1,
        }}>
          {done && <span style={{ color: '#4caf50', marginRight: 4 }}>✓</span>}
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: '0.72em', color: '#777' }}>
            {done ? 'completata' : (type === 'no_failures' ? '0/1' : `${progress}/${target}`)}
          </span>
          <span style={{ fontSize: '0.75em', color: done ? '#4caf50' : 'var(--theme-color)', fontWeight: 700 }}>
            +{pts}pt
          </span>
        </div>
      </div>
      <div style={{
        height: 6,
        borderRadius: 3,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 3,
          background: done ? '#4caf50' : 'var(--theme-color)',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}
