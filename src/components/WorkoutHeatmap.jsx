import { useState, useMemo } from 'react'
import { buildWorkoutHeatmap, computeGlobalWorkoutStreak } from '../lib/workoutStats'
import { toDateString } from '../lib/habitLogic'

const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const CELL_SIZE = 11
const CELL_GAP = 2

export default function WorkoutHeatmap({ exerciseLog }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [popup, setPopup] = useState(null)

  const cells = useMemo(() => buildWorkoutHeatmap(exerciseLog, year), [exerciseLog, year])
  const streak = useMemo(() => computeGlobalWorkoutStreak(exerciseLog), [exerciseLog])
  const todayStr = toDateString(today)

  const daysWithData = cells.filter(c => c.hasData && c.inYear).length
  const maxEffort = Math.max(...cells.filter(c => c.hasData).map(c => c.effort), 1)
  const bestCell = cells.filter(c => c.hasData).reduce((best, c) => (!best || c.effort > best.effort) ? c : best, null)

  const weeks = {}
  cells.forEach(c => {
    if (!weeks[c.week]) weeks[c.week] = Array(7).fill(null)
    weeks[c.week][c.dow === 0 ? 6 : c.dow - 1] = c
  })
  const weekKeys = Object.keys(weeks).map(Number).sort((a, b) => a - b)

  const monthCols = {}
  cells.filter(c => c.inYear && c.day === 1).forEach(c => { if (!monthCols[c.month]) monthCols[c.month] = c.week })

  function cellColor(c) {
    if (!c || !c.inYear) return 'transparent'
    if (!c.hasData) return '#2a2a2a'
    const intensity = Math.min(c.effort / maxEffort, 1)
    if (intensity >= 0.75) return '#e65100'
    if (intensity >= 0.5) return '#f57c00'
    if (intensity >= 0.25) return '#ffa726'
    return '#ffcc80'
  }

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          🗓️ Costanza allenamenti
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-icon" onClick={() => setYear(y => y - 1)} style={{ padding: 2 }}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>chevron_left</span>
          </button>
          <span style={{ fontWeight: 700, color: 'var(--theme-color)', fontSize: '0.85em' }}>{year}</span>
          <button className="btn-icon" onClick={() => setYear(y => y + 1)} disabled={year >= today.getFullYear()} style={{ padding: 2 }}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>chevron_right</span>
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{ display: 'flex', marginBottom: 4 }}>
            {weekKeys.map(w => {
              const monthIdx = Object.keys(monthCols).find(m => monthCols[m] === w)
              return (
                <div key={w} style={{ width: CELL_SIZE + CELL_GAP, flexShrink: 0, fontSize: '0.55em', color: '#666' }}>
                  {monthIdx !== undefined ? MONTH_NAMES[monthIdx] : ''}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: CELL_GAP }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CELL_GAP, marginRight: 4 }}>
              {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} style={{ width: 10, height: CELL_SIZE, fontSize: '0.5em', color: '#555', display: 'flex', alignItems: 'center', lineHeight: 1 }}>{d}</div>
              ))}
            </div>

            {weekKeys.map(w => (
              <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: CELL_GAP }}>
                {weeks[w].map((c, dow) => (
                  <div
                    key={dow}
                    onClick={() => c?.hasData && setPopup(c)}
                    style={{
                      width: CELL_SIZE, height: CELL_SIZE, borderRadius: 2,
                      background: cellColor(c),
                      cursor: c?.hasData ? 'pointer' : 'default',
                      border: c?.dateStr === todayStr ? '1px solid var(--theme-color)' : '1px solid transparent',
                      flexShrink: 0,
                    }}
                    title={c?.inYear ? `${c.dateStr}: ${c.effort}pt` : ''}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: '0.62em', color: '#555' }}>
        <span>Meno</span>
        {['#2a2a2a', '#ffcc80', '#ffa726', '#f57c00', '#e65100'].map((c, i) => (
          <div key={i} style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />
        ))}
        <span>Di più</span>
      </div>

      {/* Riepilogo */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.1em', fontWeight: 900, color: 'var(--theme-color)' }}>{daysWithData}</div>
          <div style={{ fontSize: '0.6em', color: '#666' }}>giorni allenati</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.1em', fontWeight: 900, color: streak.current > 0 ? 'var(--theme-color)' : '#444' }}>
            {streak.current > 0 ? `${streak.current}🔥` : '0'}
          </div>
          <div style={{ fontSize: '0.6em', color: '#666' }}>streak attuale</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.1em', fontWeight: 900, color: '#ff7043' }}>{streak.best}</div>
          <div style={{ fontSize: '0.6em', color: '#666' }}>record streak</div>
        </div>
      </div>

      {/* Popup giorno */}
      {popup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPopup(null)}>
          <div style={{ background: 'var(--card-solid)', borderRadius: 16, padding: 20, minWidth: 220, border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, color: 'var(--theme-color)', marginBottom: 12, fontSize: '1em' }}>{popup.dateStr}</div>
            <div style={{ fontSize: '0.85em' }}>
              Sforzo: <strong style={{ color: 'var(--theme-color)' }}>{popup.effort}pt</strong>
            </div>
            <button className="btn-icon" style={{ marginTop: 14, width: '100%' }} onClick={() => setPopup(null)}>Chiudi</button>
          </div>
        </div>
      )}
    </div>
  )
}
