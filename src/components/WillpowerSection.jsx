import { computeWillpowerWeekStats, getWillpowerRate, setWillpowerRate } from '../lib/willpowerStats'
import ActivityRateEditor from './ActivityRateEditor'

function fmtDate(dateStr) {
  if (!dateStr) return '-'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

function StatCell({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.15em', fontWeight: 800, color: color || 'var(--theme-color)' }}>{value}</div>
      <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>{label}</div>
    </div>
  )
}

export default function WillpowerSection({ willpowerLog, actions }) {
  const stats = computeWillpowerWeekStats(willpowerLog)

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          🔥 Willpower — ultimi 7gg
        </div>
        <ActivityRateEditor getRate={getWillpowerRate} setRate={setWillpowerRate} unit="pt" label="Punti Willpower" />
      </div>

      <button
        onClick={() => actions.openModal('willpowerEntry')}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '12px 14px', marginBottom: 12,
          background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
          borderRadius: 12, cursor: 'pointer', color: 'var(--text)',
          fontSize: '0.9em', fontWeight: 700,
        }}
      >
        <span className="material-icons-round" style={{ fontSize: 20 }}>add_circle</span>
        Registra un momento
      </button>

      {stats.total === 0 ? (
        <div style={{ fontSize: '0.78em', color: '#888', textAlign: 'center', padding: '6px 0' }}>
          Nessuna voce negli ultimi 7 giorni
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
            <StatCell label="Fatte" value={stats.successCount} color="var(--success, #4caf50)" />
            <StatCell label="Non fatte" value={stats.failCount} color="var(--danger, #e53935)" />
            <StatCell label="Netto" value={`${stats.netPts > 0 ? '+' : ''}${stats.netPts}pt`} color={stats.netPts >= 0 ? 'var(--success, #4caf50)' : 'var(--danger, #e53935)'} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...stats.entries].reverse().map(e => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
              }}>
                <span style={{ fontSize: '1.1em', flexShrink: 0 }}>{e.succeeded ? '✅' : '❌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.text}</div>
                  <div style={{ fontSize: '0.62em', color: '#666' }}>{fmtDate(e.date)}</div>
                </div>
                <span style={{ fontSize: '0.75em', fontWeight: 700, color: e.succeeded ? 'var(--success, #4caf50)' : 'var(--danger, #e53935)', flexShrink: 0 }}>
                  {e.pts > 0 ? '+' : ''}{e.pts}pt
                </span>
                <button
                  className="btn-icon"
                  style={{ padding: 2 }}
                  onClick={async () => {
                    if (!window.confirm(`Eliminare "${e.text}"?`)) return
                    await actions.deleteWillpowerEntry(e.date, e.id)
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: 14, color: '#444' }}>delete</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
