import { MUSCLE_GROUPS } from '../lib/muscleMapping'

function muscleLabel(key) {
  if (key === 'altro') return { label: 'Altro', emoji: '🏋️' }
  return MUSCLE_GROUPS[key] || { label: key, emoji: '🏋️' }
}

export default function WorkoutSessionSummary({ summary, onClose }) {
  if (!summary) return null
  const { totalEffort, durationMin, muscleGroups, focus, recordsBroken, comparison } = summary

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <h3>🏁 Riepilogo sessione</h3>

        {/* Sforzo totale */}
        <div style={{ textAlign: 'center', padding: '14px 0', marginBottom: 14 }}>
          <div style={{ fontSize: '2.4em', fontWeight: 900, color: 'var(--theme-color)', lineHeight: 1 }}>
            {totalEffort}pt
          </div>
          <div style={{ fontSize: '0.75em', color: '#888', marginTop: 4 }}>
            sforzo totale · {durationMin} min di allenamento
          </div>
        </div>

        {/* Record battuti */}
        {recordsBroken.length > 0 && (
          <div style={{
            marginBottom: 14, padding: '10px 14px', borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(255,202,40,0.15), rgba(255,112,67,0.1))',
            border: '2px solid var(--theme-color)',
          }}>
            <div style={{ fontWeight: 800, fontSize: '0.85em', color: 'var(--theme-color)', marginBottom: 6 }}>
              🏆 Record battuti in questa sessione
            </div>
            {recordsBroken.map(r => (
              <div key={r.exercise.id} style={{ fontSize: '0.78em', color: 'var(--text-sec)' }}>
                {r.exercise.emoji} {r.exercise.name}: {r.status.todayReps} rip. (prima {r.status.prevBestReps})
              </div>
            ))}
          </div>
        )}

        {/* Gruppi muscolari coinvolti */}
        {muscleGroups.length > 0 && (
          <>
            <div style={{ fontSize: '0.65em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>
              Muscoli allenati
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {muscleGroups.map(g => {
                const info = muscleLabel(g.key)
                const isFocus = g.key === focus
                return (
                  <span key={g.key} style={{
                    padding: '5px 10px', borderRadius: 20, fontSize: '0.72em', fontWeight: isFocus ? 700 : 500,
                    background: isFocus ? 'var(--theme-glow)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isFocus ? 'var(--theme-color)' : 'rgba(255,255,255,0.1)'}`,
                    color: isFocus ? 'var(--theme-color)' : '#888',
                  }}>
                    {info.emoji} {info.label} · {g.reps} rip.
                  </span>
                )
              })}
            </div>
          </>
        )}

        {/* Confronto storico */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
          {comparison ? (
            <>
              <div style={{ fontSize: '0.65em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                {comparison.type === 'focus'
                  ? `vs le tue ${comparison.count} sessioni focus ${muscleLabel(comparison.focus).label.toLowerCase()}`
                  : `vs le tue ${comparison.count} sessioni registrate`}
              </div>
              <div style={{ fontSize: '0.85em', color: 'var(--text)' }}>
                Media storica: <strong>{comparison.avgEffort}pt</strong>
                {comparison.deltaPct !== null && (
                  <span style={{ color: comparison.deltaPct >= 0 ? 'var(--success, #4caf50)' : 'var(--danger, #e53935)', fontWeight: 700, marginLeft: 6 }}>
                    {comparison.deltaPct >= 0 ? '▲' : '▼'} {Math.abs(comparison.deltaPct)}%
                  </span>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.8em', color: '#888' }}>
              Prima sessione registrata — da qui in poi potrai confrontare i tuoi progressi! 💪
            </div>
          )}
        </div>

        <button className="btn-main" onClick={onClose} style={{ width: '100%' }}>Chiudi</button>
      </div>
    </div>
  )
}
