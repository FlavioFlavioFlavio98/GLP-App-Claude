import { useApp } from '../lib/store'
import { buildWeeklyRecap } from '../lib/statsLogic'

export default function WeeklyRecapModal() {
  const { state, actions } = useApp()
  const { modal, globalData, currentUser } = state
  if (modal !== 'weeklyRecap' || !globalData) return null

  const recap = buildWeeklyRecap(globalData, currentUser)
  const diff = recap.thisNet - recap.prevNet
  const diffPct = recap.prevNet !== 0 ? Math.round((diff / Math.abs(recap.prevNet)) * 100) : 0
  const isUp = diff >= 0

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '2.5em', marginBottom: 8 }}>📊</div>
          <h3 style={{ margin: 0, marginBottom: 4 }}>Riepilogo Settimana</h3>
          <div style={{ fontSize: '0.8em', color: '#555' }}>Questa settimana</div>
        </div>

        {/* Net vs prev week */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: '1.8em', fontWeight: 800, color: recap.thisNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {recap.thisNet > 0 ? '+' : ''}{Math.round(recap.thisNet)}
            </div>
            <div style={{ fontSize: '0.65em', color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>Punti netti</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: '1.8em', fontWeight: 800, color: isUp ? 'var(--success)' : 'var(--danger)' }}>
              {isUp ? '↑' : '↓'} {Math.abs(diffPct)}%
            </div>
            <div style={{ fontSize: '0.65em', color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>vs settimana scorsa</div>
          </div>
        </div>

        {/* Stats rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {[
            { icon: '🔥', label: 'Streak attuale', val: `${recap.currentStreak} giorni` },
            { icon: '✅', label: 'Abitudine top', val: recap.topHabit },
            { icon: '❌', label: 'Fallita più spesso', val: recap.topFail },
            { icon: '📂', label: 'Categoria forte', val: recap.bestTag },
          ].map(({ icon, label, val }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px' }}>
              <span style={{ fontSize: '1.1em' }}>{icon}</span>
              <span style={{ color: '#666', fontSize: '0.85em', flex: 1 }}>{label}</span>
              <span style={{ fontWeight: 700, fontSize: '0.88em' }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Motivational message */}
        <div style={{ background: 'var(--theme-glow)', border: '1px solid var(--theme-color)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontSize: '0.88em', textAlign: 'center', color: 'var(--theme-color)' }}>
          {recap.msg}
        </div>

        <button className="btn-main" onClick={() => { actions.closeModal(); setTimeout(() => actions.openModal('statsPage'), 60) }}>
          Vedi statistiche complete
        </button>
        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}
