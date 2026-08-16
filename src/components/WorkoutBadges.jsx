import { getWorkoutBadges } from '../lib/workoutStats'

export default function WorkoutBadges({ exerciseLog }) {
  const badges = getWorkoutBadges(exerciseLog)
  const unlockedCount = badges.filter(b => b.achieved).length

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: '0.65em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          🏅 Badge
        </div>
        <div style={{ fontSize: '0.68em', color: 'var(--theme-color)', fontWeight: 700 }}>
          {unlockedCount}/{badges.length}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {badges.map(b => (
          <div
            key={b.id}
            title={`${b.desc}${b.achieved ? ' — sbloccato' : ` — ${b.current}/${b.target}`}`}
            style={{
              flexShrink: 0, width: 78, textAlign: 'center', padding: '10px 6px',
              borderRadius: 12,
              background: b.achieved ? 'var(--theme-glow)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${b.achieved ? 'var(--theme-color)' : 'rgba(255,255,255,0.06)'}`,
              opacity: b.achieved ? 1 : 0.55,
            }}
          >
            <div style={{ fontSize: '1.6em', marginBottom: 4, filter: b.achieved ? 'none' : 'grayscale(1)' }}>
              {b.emoji}
            </div>
            <div style={{ fontSize: '0.6em', fontWeight: 700, color: b.achieved ? 'var(--theme-color)' : '#666', lineHeight: 1.2 }}>
              {b.label}
            </div>
            {!b.achieved && (
              <div style={{ fontSize: '0.55em', color: '#555', marginTop: 2 }}>{b.current}/{b.target}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
