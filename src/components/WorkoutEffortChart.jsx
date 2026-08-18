import { useEffect, useMemo, useRef, useState } from 'react'
import { Chart } from '../lib/chartSetup'
import { toDateString } from '../lib/habitLogic'
import { getDayEffort } from '../lib/workoutStats'

const PERIODS_COMPACT = [7, 15, 30]
const PERIODS_EXPANDED = [30, 90, 180]

function useEffortData(exerciseLog, days) {
  const dates = useMemo(() => {
    const arr = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      arr.push(toDateString(d))
    }
    return arr
  }, [days])

  const effortData = useMemo(
    () => dates.map(d => getDayEffort(exerciseLog, d)),
    [dates, exerciseLog] // eslint-disable-line react-hooks/exhaustive-deps
  )

  return { dates, effortData }
}

// Canvas + istanza Chart.js riutilizzabile sia dalla card compatta che dalla
// vista espansa — stessa logica di disegno, solo dimensioni/periodo diversi.
function EffortLineChart({ exerciseLog, days, height, wide }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const { dates, effortData } = useEffortData(exerciseLog, days)

  useEffect(() => {
    if (!canvasRef.current) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim() || '#ffca28'
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: dates.map(d => { const [, m, dd] = d.split('-'); return `${parseInt(dd)}/${parseInt(m)}` }),
        datasets: [{
          data: effortData,
          borderColor: themeColor,
          backgroundColor: `${themeColor}22`,
          fill: true, tension: 0.3,
          pointRadius: days > 60 ? 0 : (days > 20 ? 1 : 2),
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666' } },
          x: { grid: { display: false }, ticks: { color: '#666', maxTicksLimit: wide ? 16 : 8 } },
        },
      },
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [dates, effortData, days, wide])

  const width = wide ? Math.max(600, days * 8) : undefined

  return (
    <div style={{ height, width, minWidth: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  )
}

function EffortTotals({ exerciseLog, days }) {
  const { effortData } = useEffortData(exerciseLog, days)
  const totalPeriod = useMemo(() => Math.round(effortData.reduce((a, b) => a + b, 0) * 10) / 10, [effortData])
  const trainedDays = useMemo(() => effortData.filter(e => e > 0).length, [effortData])

  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.1em', fontWeight: 900, color: 'var(--theme-color)' }}>{totalPeriod}</div>
        <div style={{ fontSize: '0.6em', color: '#666' }}>pt totali</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.1em', fontWeight: 900, color: 'var(--theme-color)' }}>{trainedDays}</div>
        <div style={{ fontSize: '0.6em', color: '#666' }}>giorni allenati</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.1em', fontWeight: 900, color: 'var(--theme-color)' }}>
          {trainedDays > 0 ? Math.round(totalPeriod / trainedDays * 10) / 10 : '–'}
        </div>
        <div style={{ fontSize: '0.6em', color: '#666' }}>media/giorno allenato</div>
      </div>
    </div>
  )
}

export default function WorkoutEffortChart({ exerciseLog }) {
  const [days, setDays] = useState(7)
  const [expanded, setExpanded] = useState(false)
  const [expandedDays, setExpandedDays] = useState(30)

  return (
    <>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--card-border)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div
            onClick={() => setExpanded(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}
          >
            📈 Sforzo nel tempo
            <span className="material-icons-round" style={{ fontSize: 14 }}>open_in_full</span>
          </div>
          <div className="switch-group" style={{ margin: 0, width: 'auto' }}>
            {PERIODS_COMPACT.map(d => (
              <div key={d} className={`switch-opt${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>{d}gg</div>
            ))}
          </div>
        </div>

        <div onClick={() => setExpanded(true)} style={{ cursor: 'pointer' }}>
          <EffortLineChart exerciseLog={exerciseLog} days={days} height={150} />
        </div>

        <EffortTotals exerciseLog={exerciseLog} days={days} />
      </div>

      {/* Vista espansa — grafico più grande, intervalli lunghi, scroll orizzontale per i periodi più ampi */}
      {expanded && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 6000, display: 'flex', flexDirection: 'column' }}
          onClick={() => setExpanded(false)}
        >
          <div
            style={{ background: 'var(--card-solid)', margin: 'auto auto', width: '100%', maxWidth: 900, maxHeight: '92vh', overflowY: 'auto', borderRadius: '18px 18px 0 0', padding: '18px 16px 28px', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: '0.9em', fontWeight: 800, color: 'var(--theme-color)' }}>📈 Sforzo nel tempo</div>
              <button className="btn-icon" onClick={() => setExpanded(false)}>
                <span className="material-icons-round" style={{ fontSize: 22 }}>close</span>
              </button>
            </div>

            <div className="switch-group" style={{ marginBottom: 14 }}>
              {PERIODS_EXPANDED.map(d => (
                <div key={d} className={`switch-opt${expandedDays === d ? ' active' : ''}`} onClick={() => setExpandedDays(d)}>{d}gg</div>
              ))}
            </div>

            <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
              <EffortLineChart exerciseLog={exerciseLog} days={expandedDays} height={280} wide />
            </div>

            <EffortTotals exerciseLog={exerciseLog} days={expandedDays} />
          </div>
        </div>
      )}
    </>
  )
}
