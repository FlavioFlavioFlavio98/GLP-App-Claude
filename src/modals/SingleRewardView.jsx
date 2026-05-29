import { useEffect, useRef } from 'react'
import { Chart } from '../lib/chartSetup'
import { useApp } from '../lib/store'
import { buildRewardStats } from '../lib/statsLogic'

export default function SingleRewardView() {
  const { state, actions } = useApp()
  const { modal, modalPayload, globalData } = state

  if (modal !== 'singleReward' || !globalData) return null

  const rewardId = modalPayload
  const reward = globalData.rewards?.find(r => r.id === rewardId)
  if (!reward) return null

  const stats = buildRewardStats(reward, globalData)

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.1em', color: 'var(--theme-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {reward.name}
        </h1>
      </div>

      <div className="single-habit-body">
        {stats.totalCount === 0 ? (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div style={{ fontSize: '2em', marginBottom: 8 }}>🛍️</div>
            <div>Nessun acquisto registrato per questo premio</div>
          </div>
        ) : (
          <>
            {/* KPI grid */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              <KpiBox value={stats.totalCount} label="Acquisti Totali" color="var(--theme-color)" />
              <KpiBox value={`-${stats.totalCost}`} label="Punti Spesi" color="var(--danger)" />
              <KpiBox
                value={stats.avgFreqDays ? `ogni ${stats.avgFreqDays}gg` : '-'}
                label="Frequenza Media"
                color="#aaa"
              />
              <KpiBox
                value={stats.lastPurchase ? stats.lastPurchase.split('-').reverse().join('/') : '-'}
                label="Ultimo Acquisto"
                color="var(--success)"
              />
            </div>

            {/* Monthly bar chart */}
            <SectionLabel>Acquisti per Mese (ultimi 12)</SectionLabel>
            <MonthlyBarChart data={stats.monthlyData} />
          </>
        )}
      </div>
    </div>
  )
}

function MonthlyBarChart({ data }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: 'rgba(208,92,227,0.6)',
          borderColor: '#d05ce3',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: '#2a2a2a' }, ticks: { color: '#666', font: { size: 10 }, stepSize: 1 }, beginAtZero: true },
          x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 } } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [data])

  return <div style={{ height: 150, position: 'relative' }}><canvas ref={canvasRef} /></div>
}

function KpiBox({ value, label, color }) {
  return (
    <div className="stat-box">
      <span className="stat-num" style={{ color: color || 'var(--text)', fontSize: '1.3em' }}>{value}</span>
      <span className="stat-lbl">{label}</span>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600, marginTop: 8 }}>{children}</div>
}
