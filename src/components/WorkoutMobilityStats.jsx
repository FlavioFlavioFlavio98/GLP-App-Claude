import { computeMobilityStats } from '../lib/workoutStats'
import { toDateString } from '../lib/habitLogic'

function StatCell({ label, value, sub }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.15em', fontWeight: 800, color: 'var(--theme-color)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.58em', color: '#555', marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>{label}</div>
    </div>
  )
}

// Nessuna sessione registrata finora — non mostrare una card statistiche vuota
export default function WorkoutMobilityStats({ mobilityLog, actions }) {
  const hasAny = Object.keys(mobilityLog || {}).length > 0
  if (!hasAny) return null

  const stats = computeMobilityStats(mobilityLog)
  const todayStr = toDateString(new Date())
  const todaySessions = (mobilityLog?.[todayStr] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
        🧘 Mobility
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: todaySessions.length > 0 ? 12 : 0 }}>
        <StatCell label="Oggi" value={`${stats.todayMinutes}′`} sub={`+${stats.todayPts}pt`} />
        <StatCell label="Ultimi 7gg" value={`${stats.weekMinutes}′`} />
        <StatCell label="Lifetime" value={`${stats.lifetimeMinutes}′`} sub={`+${stats.lifetimePts}pt`} />
        <StatCell label="Streak" value={stats.streak.current > 0 ? `${stats.streak.current}🔥` : '0'} />
      </div>

      {todaySessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {todaySessions.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
            }}>
              <span style={{ fontSize: '0.72em', color: '#666', minWidth: 40 }}>{s.time?.slice(0, 5) || ''}</span>
              <span style={{ flex: 1, fontSize: '0.8em' }}>{s.duration} minuti</span>
              <span style={{ fontSize: '0.72em', color: 'var(--success)' }}>+{s.pts}pt</span>
              <button
                className="btn-icon"
                style={{ padding: 2 }}
                onClick={async () => {
                  if (!window.confirm(`Eliminare la sessione da ${s.duration} minuti?`)) return
                  await actions.deleteMobilitySession(todayStr, s.id)
                }}
              >
                <span className="material-icons-round" style={{ fontSize: 14, color: '#444' }}>delete</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
