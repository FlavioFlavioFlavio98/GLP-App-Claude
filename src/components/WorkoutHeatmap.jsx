import { useState, useMemo } from 'react'
import { buildWorkoutHeatmap, buildRecentWeeksHeatmap, computeGlobalWorkoutStreak } from '../lib/workoutStats'
import { toDateString } from '../lib/habitLogic'

const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const COMPACT_WEEKS = 14

function cellColor(c, maxEffort) {
  if (!c || !c.inYear) return 'transparent'
  if (!c.hasData) return '#2a2a2a'
  const intensity = Math.min(c.effort / maxEffort, 1)
  if (intensity >= 0.75) return '#e65100'
  if (intensity >= 0.5) return '#f57c00'
  if (intensity >= 0.25) return '#ffa726'
  return '#ffcc80'
}

// Griglia settimane×giorni condivisa tra vista compatta ed espansa — entrambe
// producono celle nella stessa forma (vedi buildWorkoutHeatmap/buildRecentWeeksHeatmap).
function HeatmapGrid({ cells, cellSize, showMonthLabels, onCellClick, todayStr }) {
  const maxEffort = Math.max(...cells.filter(c => c.hasData).map(c => c.effort), 1)

  const weeks = {}
  cells.forEach(c => {
    if (!weeks[c.week]) weeks[c.week] = Array(7).fill(null)
    weeks[c.week][c.dow] = c
  })
  const weekKeys = Object.keys(weeks).map(Number).sort((a, b) => a - b)

  const monthCols = {}
  if (showMonthLabels) {
    cells.filter(c => c.inYear && c.day === 1).forEach(c => { if (!monthCols[c.month]) monthCols[c.month] = c.week })
  }

  const gap = 2

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ position: 'relative', paddingLeft: 18 }}>
        {showMonthLabels && (
          <div style={{ display: 'flex', marginBottom: 4 }}>
            {weekKeys.map(w => {
              const monthIdx = Object.keys(monthCols).find(m => monthCols[m] === w)
              return (
                <div key={w} style={{ width: cellSize + gap, flexShrink: 0, fontSize: '0.55em', color: '#666' }}>
                  {monthIdx !== undefined ? MONTH_NAMES[monthIdx] : ''}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap, marginRight: 4 }}>
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
              <div key={i} style={{ width: 10, height: cellSize, fontSize: '0.5em', color: '#555', display: 'flex', alignItems: 'center', lineHeight: 1 }}>{d}</div>
            ))}
          </div>

          {weekKeys.map(w => (
            <div key={w} style={{ display: 'flex', flexDirection: 'column', gap }}>
              {weeks[w].map((c, dow) => (
                <div
                  key={dow}
                  onClick={() => c?.hasData && onCellClick?.(c)}
                  style={{
                    width: cellSize, height: cellSize, borderRadius: 2,
                    background: cellColor(c, maxEffort),
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
  )
}

function Legend() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: '0.62em', color: '#555' }}>
      <span>Meno</span>
      {['#2a2a2a', '#ffcc80', '#ffa726', '#f57c00', '#e65100'].map((c, i) => (
        <div key={i} style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />
      ))}
      <span>Di più</span>
    </div>
  )
}

function StreakSummary({ daysWithData, streak }) {
  return (
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
  )
}

export default function WorkoutHeatmap({ exerciseLog }) {
  const today = new Date()
  const todayStr = toDateString(today)
  const [expanded, setExpanded] = useState(false)
  const [year, setYear] = useState(today.getFullYear())
  const [popup, setPopup] = useState(null)

  const compactCells = useMemo(() => buildRecentWeeksHeatmap(exerciseLog, COMPACT_WEEKS), [exerciseLog])
  const expandedCells = useMemo(() => buildWorkoutHeatmap(exerciseLog, year), [exerciseLog, year])
  const streak = useMemo(() => computeGlobalWorkoutStreak(exerciseLog), [exerciseLog])

  const compactDaysWithData = compactCells.filter(c => c.hasData).length
  const expandedDaysWithData = expandedCells.filter(c => c.hasData && c.inYear).length

  return (
    <>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--card-border)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 12,
      }}>
        <div
          onClick={() => setExpanded(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 10 }}
        >
          <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
            🗓️ Costanza allenamenti · ultime {COMPACT_WEEKS} sett.
          </div>
          <span className="material-icons-round" style={{ fontSize: 14, color: '#666' }}>open_in_full</span>
        </div>

        <HeatmapGrid cells={compactCells} cellSize={13} showMonthLabels={false} todayStr={todayStr} onCellClick={() => setExpanded(true)} />
        <Legend />
        <StreakSummary daysWithData={compactDaysWithData} streak={streak} />
      </div>

      {/* Vista espansa — griglia annuale completa con navigazione anno */}
      {expanded && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 6000, display: 'flex', flexDirection: 'column' }}
          onClick={() => setExpanded(false)}
        >
          <div
            style={{ background: 'var(--card-solid)', margin: 'auto 0', width: '100%', maxHeight: '92vh', overflowY: 'auto', borderRadius: '18px 18px 0 0', padding: '18px 16px 28px', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: '0.9em', fontWeight: 800, color: 'var(--theme-color)' }}>🗓️ Costanza allenamenti</div>
              <button className="btn-icon" onClick={() => setExpanded(false)}>
                <span className="material-icons-round" style={{ fontSize: 22 }}>close</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
              <button className="btn-icon" onClick={() => setYear(y => y - 1)} style={{ padding: 2 }}>
                <span className="material-icons-round" style={{ fontSize: 18 }}>chevron_left</span>
              </button>
              <span style={{ fontWeight: 700, color: 'var(--theme-color)', fontSize: '0.9em' }}>{year}</span>
              <button className="btn-icon" onClick={() => setYear(y => y + 1)} disabled={year >= today.getFullYear()} style={{ padding: 2 }}>
                <span className="material-icons-round" style={{ fontSize: 18 }}>chevron_right</span>
              </button>
            </div>

            <HeatmapGrid cells={expandedCells} cellSize={12} showMonthLabels todayStr={todayStr} onCellClick={setPopup} />
            <Legend />
            <StreakSummary daysWithData={expandedDaysWithData} streak={streak} />
          </div>
        </div>
      )}

      {/* Popup giorno (solo vista espansa) */}
      {popup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 6100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPopup(null)}>
          <div style={{ background: 'var(--card-solid)', borderRadius: 16, padding: 20, minWidth: 220, border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, color: 'var(--theme-color)', marginBottom: 12, fontSize: '1em' }}>{popup.dateStr}</div>
            <div style={{ fontSize: '0.85em' }}>
              Sforzo: <strong style={{ color: 'var(--theme-color)' }}>{popup.effort}pt</strong>
            </div>
            <button className="btn-icon" style={{ marginTop: 14, width: '100%' }} onClick={() => setPopup(null)}>Chiudi</button>
          </div>
        </div>
      )}
    </>
  )
}
