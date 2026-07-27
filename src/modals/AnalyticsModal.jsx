import { useEffect, useRef, useState } from 'react'
import { Chart } from '../lib/chartSetup'
import { useApp } from '../lib/store'
import { getDailyNet, toDateString } from '../lib/habitLogic'

export default function AnalyticsModal() {
  const { state, actions } = useApp()
  const { modal, allUsersData } = state
  const [days, setDays] = useState(30)
  const [nodeInfo, setNodeInfo] = useState(null)
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (modal !== 'analytics') return
    if (!allUsersData.flavio) return
    buildChart(days)
  }, [modal, days, allUsersData.flavio])

  function buildChart(d) {
    const labels = [], dates = []
    for (let i = d - 1; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i)
      dates.push(toDateString(dt))
      labels.push(`${dt.getDate()}/${dt.getMonth() + 1}`)
    }
    const fPoints = dates.map(dt => getDailyNet(allUsersData.flavio, dt))

    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Flavio', data: fPoints, borderColor: '#ffca28', backgroundColor: 'rgba(255,202,40,0.1)', borderWidth: 2, pointRadius: 5 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: { y: { grid: { color: '#333' } }, x: { grid: { color: '#333' } } },
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index
            setNodeInfo({ date: labels[idx] + '/' + new Date().getFullYear(), fVal: fPoints[idx] })
          }
        },
      },
    })
  }

  if (modal !== 'analytics') return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box modal-box-wide">
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>📉 Analisi Dettagliata</h3>
          <button className="btn-icon" onClick={() => actions.closeModal()}><span className="material-icons-round">close</span></button>
        </div>
        <div className="switch-group" style={{ marginBottom: 15 }}>
          {[7, 14, 30].map(d => (
            <div key={d} className={`switch-opt${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>{d} GG</div>
          ))}
        </div>
        <div className="analytics-wrap">
          <canvas ref={canvasRef} />
        </div>
        {nodeInfo && (
          <div className="node-info">
            <div className="node-info-row">
              <strong>{nodeInfo.date}</strong>
              <div>
                <span style={{ color: '#ffca28' }}>{nodeInfo.fVal > 0 ? '+' : ''}{nodeInfo.fVal}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
