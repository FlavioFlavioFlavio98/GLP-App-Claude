import { useEffect, useRef } from 'react'
import { Chart } from '../lib/chartSetup'
import { useApp } from '../lib/store'
import { parseEntry, getItemValueAtDate } from '../lib/habitLogic'

const DAYS_NAME = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

export default function StatsModal() {
  const { state, actions } = useApp()
  const { modal, globalData } = state
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (modal !== 'stats' || !globalData || !canvasRef.current) return
    const { stats, tagScores } = computeStats(globalData)
    window.__glpStats = stats

    const tagsMap = {}
    ;(globalData.tags || []).forEach(t => { tagsMap[t.id] = t })

    if (chartRef.current) chartRef.current.destroy()
    const labels = [], data = [], colors = []
    Object.keys(tagScores).forEach(tId => {
      if (tId === 'uncategorized') { labels.push('Senza Categoria'); colors.push('#666') }
      else { const t = tagsMap[tId]; if (t) { labels.push(t.name); colors.push(t.color) } }
      data.push(tagScores[tId])
    })
    if (data.length > 0) {
      chartRef.current = new Chart(canvasRef.current, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      })
    }
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [modal, globalData])

  if (modal !== 'stats' || !globalData) return null

  const { stats } = computeStats(globalData)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <h3>📊 Statistiche</h3>
        <div className="stats-container">
          <div className="stat-card"><span className="stat-val">{stats.avg}</span><span className="stat-label">Media Netta</span></div>
          <div className="stat-card"><span className="stat-val">{stats.daysCount}</span><span className="stat-label">Giorni Attivi</span></div>
          <div className="stat-card" style={{ borderColor: 'var(--success)' }}>
            <span className="stat-val" style={{ color: 'var(--success)' }}>{stats.bestDow}</span>
            <span className="stat-label">Giorno Top ({stats.bestDowAvg})</span>
          </div>
          <div className="stat-card" style={{ borderColor: 'var(--danger)' }}>
            <span className="stat-val" style={{ color: 'var(--danger)' }}>{stats.worstDow}</span>
            <span className="stat-label">Giorno Flop ({stats.worstDowAvg})</span>
          </div>
          <div className="stat-card span2" style={{ borderColor: 'var(--theme-color)' }}>
            <span className="stat-val" style={{ color: 'var(--theme-color)', fontSize: '1em' }}>+{stats.maxNet} ({stats.bestDay})</span>
            <span className="stat-label">Record Assoluto</span>
          </div>
          <div className="stat-card span2"><span className="stat-val" style={{ fontSize: '1.1em' }}>{stats.bestHabit}</span><span className="stat-label">Abitudine Costante</span></div>
          <div className="stat-card span2"><span className="stat-val" style={{ fontSize: '1.1em' }}>{stats.favReward}</span><span className="stat-label">Premio Preferito</span></div>
        </div>

        <div style={{ height: 180, marginTop: 20, position: 'relative' }}>
          <canvas ref={canvasRef} />
        </div>
        <p style={{ textAlign: 'center', fontSize: '0.75em', color: '#666', marginTop: 8 }}>Distribuzione punti per tag</p>

        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}

function computeStats(globalData) {
  let totalNet = 0, daysCount = 0
  let maxNet = -Infinity, bestDay = '-'
  let habitCounts = {}, rewardCounts = {}, tagScores = {}
  const dowStats = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }))

  const dates = Object.keys(globalData.dailyLogs || {}).sort()
  dates.forEach(date => {
    daysCount++
    const entry = parseEntry(globalData.dailyLogs[date])
    let dayEarn = 0, daySpent = 0
    entry.habits.forEach(hId => {
      const h = globalData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h) {
        habitCounts[h.name] = (habitCounts[h.name] || 0) + 1
        const isM = getItemValueAtDate(h, 'isMulti', date)
        const rMin = getItemValueAtDate(h, 'rewardMin', date)
        const rMax = getItemValueAtDate(h, 'reward', date)
        const lvl = entry.habitLevels[hId] || 'max'
        const pts = isM && lvl === 'min' ? rMin : rMax
        dayEarn += pts
        const tId = h.tagId || 'uncategorized'
        tagScores[tId] = (tagScores[tId] || 0) + pts
      }
    })
    entry.failedHabits.forEach(hId => {
      const h = globalData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h) daySpent += getItemValueAtDate(h, 'penalty', date)
    })
    entry.purchases.forEach(p => { rewardCounts[p.name] = (rewardCounts[p.name] || 0) + 1; daySpent += parseInt(p.cost || 0) })
    const dayNet = dayEarn - daySpent
    totalNet += dayNet
    if (dayNet > maxNet) { maxNet = dayNet; bestDay = date.split('-').reverse().join('/') }
    const dow = new Date(date).getDay()
    dowStats[dow].sum += dayNet; dowStats[dow].count++
  })

  let bestDowIdx = -1, maxAvg = -Infinity, worstDowIdx = -1, minAvg = Infinity
  dowStats.forEach((d, i) => {
    if (d.count > 0) {
      const avg = d.sum / d.count
      if (avg > maxAvg) { maxAvg = avg; bestDowIdx = i }
      if (avg < minAvg) { minAvg = avg; worstDowIdx = i }
    }
  })

  const avg = daysCount > 0 ? (totalNet / daysCount).toFixed(1) : '0'
  const bestHabit = Object.keys(habitCounts).length > 0 ? Object.keys(habitCounts).reduce((a, b) => habitCounts[a] > habitCounts[b] ? a : b) : '-'
  const favReward = Object.keys(rewardCounts).length > 0 ? Object.keys(rewardCounts).reduce((a, b) => rewardCounts[a] > rewardCounts[b] ? a : b) : '-'

  return {
    stats: {
      avg, daysCount,
      bestDow: bestDowIdx >= 0 ? DAYS_NAME[bestDowIdx] : '-',
      bestDowAvg: bestDowIdx >= 0 ? maxAvg.toFixed(0) : '0',
      worstDow: worstDowIdx >= 0 ? DAYS_NAME[worstDowIdx] : '-',
      worstDowAvg: worstDowIdx >= 0 ? minAvg.toFixed(0) : '0',
      maxNet: maxNet === -Infinity ? 0 : maxNet,
      bestDay,
      bestHabit, favReward,
    },
    tagScores,
  }
}
