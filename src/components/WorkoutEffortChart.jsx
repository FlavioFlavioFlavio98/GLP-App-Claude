import { useEffect, useMemo, useRef, useState } from 'react'
import { Chart } from '../lib/chartSetup'
import { toDateString } from '../lib/habitLogic'
import { getDayEffort } from '../lib/workoutStats'

const PERIODS = [30, 90, 180]

export default function WorkoutEffortChart({ exerciseLog }) {
  const [days, setDays] = useState(30)
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

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

  const totalPeriod = useMemo(() => Math.round(effortData.reduce((a, b) => a + b, 0) * 10) / 10, [effortData])
  const trainedDays = useMemo(() => effortData.filter(e => e > 0).length, [effortData])

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
          pointRadius: days > 60 ? 0 : 2,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666' } },
          x: { grid: { display: false }, ticks: { color: '#666', maxTicksLimit: 8 } },
        },
      },
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [dates, effortData, days])

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          📈 Sforzo nel tempo
        </div>
        <div className="switch-group" style={{ margin: 0, width: 'auto' }}>
          {PERIODS.map(d => (
            <div key={d} className={`switch-opt${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>{d}gg</div>
          ))}
        </div>
      </div>

      <div style={{ height: 150 }}>
        <canvas ref={canvasRef} />
      </div>

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
    </div>
  )
}
