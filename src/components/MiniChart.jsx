import { useEffect, useRef } from 'react'
import { Chart } from '../lib/chartSetup'
import { getDailyNet, toDateString } from '../lib/habitLogic'

export default function MiniChart({ allUsersData }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!allUsersData.flavio || !allUsersData.simona) return
    const labels = [], dates = []
    for (let i = 9; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dates.push(toDateString(d))
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`)
    }
    const flavioPoints = dates.map(dt => getDailyNet(allUsersData.flavio, dt))
    const simonaPoints = dates.map(dt => getDailyNet(allUsersData.simona, dt))

    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Flavio', data: flavioPoints, borderColor: '#ffca28', backgroundColor: 'rgba(255,202,40,0.1)', fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2 },
          { label: 'Simona', data: simonaPoints, borderColor: '#d05ce3', backgroundColor: 'rgba(208,92,227,0.1)', fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: '#333' }, ticks: { color: '#666', font: { size: 10 } }, beginAtZero: true },
          x: { grid: { display: false }, ticks: { color: '#666', font: { size: 10 } } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [allUsersData.flavio, allUsersData.simona])

  return (
    <div className="chart-box">
      <canvas ref={canvasRef} />
    </div>
  )
}
