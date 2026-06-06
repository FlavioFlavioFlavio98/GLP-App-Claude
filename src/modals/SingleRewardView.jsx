import { useEffect, useRef } from 'react'
import { Chart } from '../lib/chartSetup'
import { useApp } from '../lib/store'
import { buildRewardStats } from '../lib/statsLogic'
import { toDateString } from '../lib/habitLogic'

export default function SingleRewardView() {
  const { state, actions } = useApp()
  const { modal, modalPayload, globalData } = state

  if (modal !== 'singleReward' || !globalData) return null

  const rewardId = modalPayload
  const reward = globalData.rewards?.find(r => r.id === rewardId)
  if (!reward) return null

  if (reward.type === 'tracked') {
    return <TrackedRewardView reward={reward} globalData={globalData} actions={actions} />
  }

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
            <SectionLabel>Acquisti per Mese (ultimi 12)</SectionLabel>
            <MonthlyBarChart data={stats.monthlyData} />
          </>
        )}
      </div>
    </div>
  )
}

function TrackedRewardView({ reward, globalData, actions }) {
  // Build last 30 days data
  const days = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    days.push(toDateString(d))
  }

  const entries = days.map(date => {
    const tr = globalData.dailyLogs?.[date]?.trackedRewards?.[reward.id]
    return { date, quantity: tr?.quantity ?? null, cost: tr?.cost ?? 0 }
  })

  const daysWithData = entries.filter(e => e.quantity !== null)
  const totalQty = daysWithData.reduce((s, e) => s + e.quantity, 0)
  const totalCost = daysWithData.reduce((s, e) => s + e.cost, 0)
  const avgQty = daysWithData.length > 0 ? Math.round(totalQty / daysWithData.length) : 0
  const maxEntry = daysWithData.reduce((max, e) => e.quantity > (max?.quantity ?? -1) ? e : max, null)

  const months = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
  function fmt(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getDate()} ${months[d.getMonth()]}`
  }

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.1em', color: 'var(--theme-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📊 {reward.name}
        </h1>
      </div>

      <div className="single-habit-body">
        <div style={{ fontSize: '0.7em', color: '#555', marginBottom: 16 }}>
          {reward.costPerThreshold}pt ogni {reward.threshold} {reward.unit}
        </div>

        {daysWithData.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div style={{ fontSize: '2em', marginBottom: 8 }}>📊</div>
            <div>Nessun dato registrato per questo tracciamento</div>
          </div>
        ) : (
          <>
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              <KpiBox value={`${avgQty} ${reward.unit}`} label="Media giornaliera" color="var(--theme-color)" />
              <KpiBox value={`-${totalCost}pt`} label="Punti totali spesi" color="var(--danger)" />
              <KpiBox value={daysWithData.length} label="Giorni registrati" color="#aaa" />
              <KpiBox
                value={maxEntry ? `${maxEntry.quantity} ${reward.unit}` : '-'}
                label={maxEntry ? `Max (${fmt(maxEntry.date)})` : 'Max'}
                color="#ff7043"
              />
            </div>

            <SectionLabel>Quantità giornaliera (ultimi 30 giorni)</SectionLabel>
            <TrackedBarChart days={days} entries={entries} unit={reward.unit} />
          </>
        )}
      </div>
    </div>
  )
}

function TrackedBarChart({ days, entries, unit }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()
    const labels = days.map(d => {
      const dt = new Date(d + 'T00:00:00')
      return `${dt.getDate()}/${dt.getMonth()+1}`
    })
    const data = entries.map(e => e.quantity ?? 0)
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: entries.map(e => e.quantity !== null ? 'rgba(229,57,53,0.5)' : 'rgba(255,255,255,0.05)'),
          borderColor: entries.map(e => e.quantity !== null ? '#e53935' : 'rgba(255,255,255,0.1)'),
          borderWidth: 1, borderRadius: 3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.raw} ${unit}` } },
        },
        scales: {
          y: { grid: { color: '#2a2a2a' }, ticks: { color: '#666', font: { size: 9 } }, beginAtZero: true },
          x: { grid: { display: false }, ticks: { color: '#555', font: { size: 8 }, maxRotation: 0 } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [days, entries])

  return <div style={{ height: 160, position: 'relative' }}><canvas ref={canvasRef} /></div>
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
      <span className="stat-num" style={{ color: color || 'var(--text)', fontSize: '1.1em' }}>{value}</span>
      <span className="stat-lbl">{label}</span>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600, marginTop: 8 }}>{children}</div>
}
