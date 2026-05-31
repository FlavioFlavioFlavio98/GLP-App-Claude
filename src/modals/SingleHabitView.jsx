import { useEffect, useRef } from 'react'
import { Chart } from '../lib/chartSetup'
import { useApp } from '../lib/store'
import { buildHabitStats } from '../lib/statsLogic'
import { parseEntry } from '../lib/habitLogic'

const DOW_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

export default function SingleHabitView() {
  const { state, actions } = useApp()
  const { modal, modalPayload, globalData } = state

  if (modal !== 'singleHabit' || !globalData) return null

  const habitId = modalPayload
  const habit = globalData.habits?.find(h => h.id === habitId || h.name === habitId)
  if (!habit) return null

  const stats = buildHabitStats(habit, globalData)
  const stableId = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')

  // Collect last 10 notes for this habit across all days
  const notes = Object.keys(globalData.dailyLogs || {})
    .sort((a, b) => b.localeCompare(a))
    .reduce((acc, dateStr) => {
      if (acc.length >= 10) return acc
      const entry = parseEntry(globalData.dailyLogs[dateStr])
      const note = entry.habitNotes?.[stableId]
      if (note) acc.push({ dateStr, note })
      return acc
    }, [])

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.1em', color: 'var(--theme-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {habit.name}
        </h1>
      </div>

      <div className="single-habit-body">
        {/* KPI grid */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <KpiBox value={stats.totalDone} label="Volte Fatto" color="var(--success)" />
          <KpiBox value={`${stats.winRate}%`} label="Win Rate" color={stats.winRate >= 80 ? 'var(--success)' : '#ffca28'} />
          <KpiBox
            label="Best Streak"
            color="#ff9800"
            value={<span>{stats.bestStreak} <span style={{ fontSize: '0.6em' }}>🔥</span></span>}
          />
          <KpiBox value={`${stats.currentStreak} 🔥`} label="Streak Attuale" color={stats.currentStreak > 0 ? '#ff9800' : '#555'} />
          <KpiBox value={stats.totalPoints} label="Punti Generati" color="var(--theme-color)" />
          <KpiBox value={`${stats.weightPct}%`} label="% sul Totale" color="#d05ce3" />
        </div>

        {/* Giorno della settimana preferito */}
        <InfoRow icon="📅" label="Completata più spesso di" value={stats.bestDOWLabel} />

        {/* Trend 10 giorni */}
        <SectionLabel>Ultimi 10 Giorni</SectionLabel>
        <div className="trend-dots" style={{ marginBottom: 20 }}>
          {stats.heatmap90.slice(-10).map(({ key, status }) => (
            <div key={key} className={`trend-dot st-${status}`} title={key} />
          ))}
        </div>

        {/* Grafico barre settimanali */}
        <SectionLabel>Punti per Settimana (ultime 12)</SectionLabel>
        <WeeklyBarChart data={stats.last12Weeks} />

        {/* Heatmap 90 giorni */}
        <SectionLabel>Heatmap 90 Giorni</SectionLabel>
        <div className="heatmap-grid" style={{ marginBottom: 24 }}>
          {stats.heatmap90.map(({ key, status }) => (
            <div key={key} className={`heat-box st-${status}`} title={key} />
          ))}
        </div>

        {/* Ultime note */}
        {notes.length > 0 && (
          <>
            <SectionLabel>Ultime Note 📝</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {notes.map(({ dateStr, note }) => (
                <div key={dateStr} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.68em', color: 'var(--theme-color)', marginBottom: 4 }}>
                    {dateStr.split('-').reverse().join('/')}
                  </div>
                  <div style={{ fontSize: '0.88em', color: 'var(--text-sec)' }}>{note}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function WeeklyBarChart({ data }) {
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
          data: data.map(d => d.pts),
          backgroundColor: data.map(d => d.pts > 0 ? 'rgba(76,175,80,0.7)' : 'rgba(255,255,255,0.1)'),
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: '#2a2a2a' }, ticks: { color: '#666', font: { size: 10 } }, beginAtZero: true },
          x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 } } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [data])

  return <div style={{ height: 130, marginBottom: 20, position: 'relative' }}><canvas ref={canvasRef} /></div>
}

function KpiBox({ value, label, color }) {
  return (
    <div className="stat-box">
      <span className="stat-num" style={{ color: color || 'var(--text)' }}>{value}</span>
      <span className="stat-lbl">{label}</span>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>{children}</div>
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a2a', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.9em' }}>
      <span>{icon}</span>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontWeight: 'bold', color: 'var(--theme-color)' }}>{value}</span>
    </div>
  )
}
