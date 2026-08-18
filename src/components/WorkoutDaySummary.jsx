import { calculateWorkoutEffort, getEffortEmoji } from '../lib/workoutStats'

const MONTH_NAMES = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
function fmtDateLong(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(d)} ${MONTH_NAMES[parseInt(m) - 1]} ${y}`
}

// Mostrato al posto dei widget "live" (sessione/banner/obiettivo/timer) quando si
// naviga a un giorno diverso da oggi con le frecce accanto alla data — quei widget
// non hanno senso per il passato, qui si vedono invece gli allenamenti fatti quel
// giorno con la possibilità di modificarli/cancellarli.
export default function WorkoutDaySummary({ exerciseLog, quickExercises, mobilityLog, dateStr, actions }) {
  const entries = (exerciseLog?.[dateStr] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const mobilityEntries = (mobilityLog?.[dateStr] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const totalEffort = calculateWorkoutEffort(entries)

  const exMap = {}
  ;(quickExercises || []).forEach(e => { exMap[e.id] = e })

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
        📅 {fmtDateLong(dateStr)}
      </div>

      {entries.length === 0 && mobilityEntries.length === 0 ? (
        <div style={{ fontSize: '0.85em', color: '#555', textAlign: 'center', padding: '10px 0' }}>
          Nessun allenamento registrato in questo giorno
        </div>
      ) : (
        <>
          {entries.length > 0 && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: '2em', fontWeight: 900, color: 'var(--theme-color)', lineHeight: 1 }}>{totalEffort}pt</div>
                <div style={{ fontSize: '0.65em', color: '#666', marginTop: 2 }}>sforzo totale</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: mobilityEntries.length > 0 ? 14 : 0 }}>
                {entries.map(s => {
                  const ex = exMap[s.exerciseId]
                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
                    }}>
                      <span style={{ fontSize: '1.1em' }}>{ex?.emoji || '💪'}</span>
                      <span style={{ fontSize: '0.72em', color: '#666', minWidth: 40 }}>{s.time?.slice(0, 5) || ''}</span>
                      {s.effort && <span style={{ fontSize: '0.75em' }}>{getEffortEmoji(s.effort)}</span>}
                      <span style={{ flex: 1, fontSize: '0.82em', minWidth: 0 }}>
                        <strong>{ex?.name || '—'}</strong> · {s.reps} reps{s.load > 0 ? ` · ${s.load}kg` : ''}
                      </span>
                      <span style={{ fontSize: '0.75em', color: 'var(--success)', fontWeight: 600 }}>+{s.pts}pt</span>
                      <button
                        className="btn-icon"
                        style={{ padding: 2 }}
                        title="Modifica ripetizioni"
                        onClick={async () => {
                          const val = window.prompt(`Ripetizioni (attuali: ${s.reps}):`, s.reps)
                          if (val === null) return
                          await actions.editExerciseSession(dateStr, s.id, val)
                        }}
                      >
                        <span className="material-icons-round" style={{ fontSize: 15, color: '#555' }}>edit</span>
                      </button>
                      <button
                        className="btn-icon"
                        style={{ padding: 2 }}
                        title="Elimina serie"
                        onClick={async () => {
                          if (!window.confirm(`Eliminare ${s.reps} reps (-${s.pts} pt)?`)) return
                          await actions.deleteExerciseSession(dateStr, s.id)
                        }}
                      >
                        <span className="material-icons-round" style={{ fontSize: 15, color: '#555' }}>delete</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {mobilityEntries.length > 0 && (
            <>
              <div style={{ fontSize: '0.62em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>
                🧘 Mobility
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {mobilityEntries.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
                  }}>
                    <span style={{ fontSize: '1.1em' }}>🧘</span>
                    <span style={{ fontSize: '0.72em', color: '#666', minWidth: 40 }}>{s.time?.slice(0, 5) || ''}</span>
                    <span style={{ flex: 1, fontSize: '0.82em' }}>{s.duration} minuti</span>
                    <span style={{ fontSize: '0.75em', color: 'var(--success)', fontWeight: 600 }}>+{s.pts}pt</span>
                    <button
                      className="btn-icon"
                      style={{ padding: 2 }}
                      title="Modifica durata"
                      onClick={async () => {
                        const val = window.prompt(`Durata in minuti (attuale: ${s.duration}):`, s.duration)
                        if (val === null) return
                        await actions.editMobilitySession(dateStr, s.id, val)
                      }}
                    >
                      <span className="material-icons-round" style={{ fontSize: 15, color: '#555' }}>edit</span>
                    </button>
                    <button
                      className="btn-icon"
                      style={{ padding: 2 }}
                      title="Elimina sessione"
                      onClick={async () => {
                        if (!window.confirm(`Eliminare la sessione da ${s.duration} minuti?`)) return
                        await actions.deleteMobilitySession(dateStr, s.id)
                      }}
                    >
                      <span className="material-icons-round" style={{ fontSize: 15, color: '#555' }}>delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
