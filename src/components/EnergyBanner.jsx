import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'

const LEVELS = [
  { value: 1, emoji: '⚡', label: 'Bassa', color: '#E24B4A' },
  { value: 2, emoji: '🔋', label: 'Media', color: '#EF9F27' },
  { value: 3, emoji: '⚡⚡', label: 'Alta', color: '#1D9E75' },
]

function getSession() {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 18 && h <= 23) return 'evening'
  return null
}

export default function EnergyBanner() {
  const { state, actions } = useApp()
  const { globalData, currentUser } = state
  const today = toDateString(new Date())

  const session = getSession()
  if (!session) return null

  const energy = globalData?.dailyLogs?.[today]?.energy?.[currentUser] || {}
  const value = energy[session]

  const greeting = session === 'morning' ? 'Buongiorno! Come ti senti?' : 'Come ti senti stasera?'

  // If already set → show compact indicator
  if (value !== null && value !== undefined) {
    const level = LEVELS.find(l => l.value === value)
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, padding: '6px 12px', marginBottom: 10, cursor: 'pointer',
        }}
        onClick={() => actions.saveEnergy(session, null)} // tap to reset for re-selection
      >
        <span style={{ fontSize: '1em' }}>{level?.emoji}</span>
        <span style={{ fontSize: '0.75em', color: level?.color, fontWeight: 600 }}>
          Energia {session === 'morning' ? 'mattutina' : 'serale'}: {level?.label}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.68em', color: '#444' }}>tocca per cambiare</span>
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '10px 14px', marginBottom: 12,
    }}>
      <div style={{ fontSize: '0.78em', color: '#aaa', marginBottom: 8 }}>{greeting}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {LEVELS.map(l => (
          <button
            key={l.value}
            onClick={() => actions.saveEnergy(session, l.value)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              transition: 'all 0.18s',
            }}
          >
            <span style={{ fontSize: '1.3em' }}>{l.emoji}</span>
            <span style={{ fontSize: '0.6em', color: '#666' }}>{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
