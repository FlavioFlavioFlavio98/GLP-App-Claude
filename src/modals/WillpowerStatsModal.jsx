import { useState } from 'react'
import { useApp } from '../lib/store'
import { computeWillpowerStats, computeWillpowerBreakdown } from '../lib/willpowerStats'

function fmtDate(dateStr) {
  if (!dateStr) return '-'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

const PERIOD_OPTS = [
  { v: 7, label: '7 GG' }, { v: 30, label: '30 GG' }, { v: 'all', label: 'Tutto' },
]

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.25em', fontWeight: 800, color: color || 'var(--theme-color)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.68em', color: '#555', marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: '0.62em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default function WillpowerStatsModal() {
  const { state, actions } = useApp()
  const { modal, authUserId, allUsersData } = state

  if (modal !== 'willpowerStats' || authUserId !== 'flavio') return null
  return <WillpowerStatsInner actions={actions} willpowerLog={allUsersData?.flavio?.willpowerLog || {}} />
}

function WillpowerStatsInner({ actions, willpowerLog }) {
  const [period, setPeriod] = useState(30)

  const stats = computeWillpowerStats(willpowerLog, period)
  const breakdown = computeWillpowerBreakdown(willpowerLog)

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.2em', color: 'var(--theme-color)', flex: 1 }}>🔥 Statistiche Willpower</h1>
      </div>

      <div className="single-habit-body">
        <div className="switch-group" style={{ marginBottom: 16 }}>
          {PERIOD_OPTS.map(opt => (
            <div key={opt.v} className={`switch-opt${period === opt.v ? ' active' : ''}`} onClick={() => setPeriod(opt.v)}>
              {opt.label}
            </div>
          ))}
        </div>

        {stats.total === 0 ? (
          <div className="empty-state">Nessuna voce nel periodo selezionato</div>
        ) : (
          <>
            <div style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
              Statistiche ({period === 'all' ? 'tutti i dati' : `ultimi ${period} giorni`})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <StatCard label="Fatte" value={stats.successCount} color="var(--success, #4caf50)" />
              <StatCard label="Non fatte" value={stats.failCount} color="var(--danger, #e53935)" />
              <StatCard label="Tasso di successo" value={stats.successRate !== null ? `${stats.successRate}%` : '-'} />
              <StatCard label="Punti netti" value={`${stats.netPts > 0 ? '+' : ''}${stats.netPts}pt`} color={stats.netPts >= 0 ? 'var(--success, #4caf50)' : 'var(--danger, #e53935)'} />
              <StatCard label="Streak giorni puliti" value={stats.streak > 0 ? `${stats.streak}🔥` : '0'} sub="giorni senza fallimenti" />
              <StatCard label="Voci totali (lifetime)" value={stats.lifetimeEntries} />
            </div>
          </>
        )}

        {breakdown.length > 0 && (
          <>
            <div style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
              Per tipo (lifetime)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {breakdown.map(b => (
                <div key={b.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85em', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</div>
                    <div style={{ fontSize: '0.68em', color: '#888', marginTop: 2 }}>
                      ✅ {b.success} · ❌ {b.fail} su {b.total}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.85em', fontWeight: 800, color: b.netPts >= 0 ? 'var(--success, #4caf50)' : 'var(--danger, #e53935)', flexShrink: 0 }}>
                    {b.netPts > 0 ? '+' : ''}{b.netPts}pt
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {stats.total > 0 && (
          <>
            <div style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
              Cronologia
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
              {[...stats.entries].reverse().map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
                  <span>{e.succeeded ? '✅' : '❌'}</span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: '0.8em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.text}</div>
                  <span style={{ fontSize: '0.72em', color: '#888' }}>{fmtDate(e.date)}</span>
                  <span style={{ fontSize: '0.78em', fontWeight: 700, color: e.succeeded ? 'var(--success, #4caf50)' : 'var(--danger, #e53935)' }}>
                    {e.pts > 0 ? '+' : ''}{e.pts}pt
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
