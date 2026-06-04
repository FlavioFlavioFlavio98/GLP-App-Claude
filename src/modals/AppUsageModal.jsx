import { useState, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import '../lib/chartSetup'
import { Bar } from 'react-chartjs-2'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateRange(days) {
  const result = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    result.push(toDateString(d))
  }
  return result
}

function calcStreak(appUsage) {
  let current = 0
  let record = 0
  let temp = 0
  const today = new Date()
  // Current streak: count backwards from today
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = toDateString(d)
    if ((appUsage[key] || 0) > 0) {
      current++
    } else if (i > 0) {
      break
    }
  }
  // Record streak: scan all dates
  const allDates = Object.keys(appUsage).filter(k => appUsage[k] > 0).sort()
  for (let i = 0; i < allDates.length; i++) {
    if (i === 0) { temp = 1; continue }
    const prev = new Date(allDates[i - 1])
    const cur = new Date(allDates[i])
    const diff = Math.round((cur - prev) / 86400000)
    if (diff === 1) { temp++ } else { temp = 1 }
    if (temp > record) record = temp
  }
  if (current > record) record = current
  return { current, record }
}

function getWeekdayStats(appUsage) {
  const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
  const sums = [0, 0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0, 0]
  Object.entries(appUsage).forEach(([dateStr, val]) => {
    const dow = new Date(dateStr).getDay()
    sums[dow] += val
    counts[dow]++
  })
  return DAYS.map((name, i) => ({
    name,
    avg: counts[i] > 0 ? Math.round((sums[i] / counts[i]) * 10) / 10 : 0,
  }))
}

function getHeatmapColor(val) {
  if (!val || val === 0) return 'rgba(255,255,255,0.05)'
  if (val <= 2)  return 'rgba(74,222,128,0.3)'
  if (val <= 5)  return 'rgba(74,222,128,0.6)'
  return 'rgba(74,222,128,0.95)'
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AppUsageModal() {
  const { state, actions } = useApp()
  const { modal, authUserId, allUsersData } = state
  const [period, setPeriod] = useState(7)
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear())

  if (modal !== 'appUsage') return null
  if (authUserId !== 'flavio') return null

  const appUsage = allUsersData?.flavio?.appUsage || {}

  // ── Stats cards ────────────────────────────────────────────────────────────
  const today = toDateString(new Date())
  const todayCount = appUsage[today] || 0

  const last7 = dateRange(7).reduce((s, d) => s + (appUsage[d] || 0), 0)
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const thisMonth = Object.entries(appUsage)
    .filter(([d]) => d >= monthStart)
    .reduce((s, [, v]) => s + v, 0)

  const last30 = dateRange(30)
  const last30Total = last30.reduce((s, d) => s + (appUsage[d] || 0), 0)
  const last30ActiveDays = last30.filter(d => (appUsage[d] || 0) > 0).length
  const avgDaily = last30ActiveDays > 0 ? Math.round((last30Total / 30) * 10) / 10 : 0

  const allEntries = Object.entries(appUsage)
  const lifetimeTotal = allEntries.reduce((s, [, v]) => s + v, 0)
  const [mostActiveDate, mostActiveCount] = allEntries.reduce(
    ([bd, bv], [d, v]) => v > bv ? [d, v] : [bd, bv],
    ['—', 0]
  )

  const { current: streakCurrent, record: streakRecord } = calcStreak(appUsage)

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartDates = dateRange(period)
  const chartData = {
    labels: chartDates.map(d => {
      const dt = new Date(d)
      return `${dt.getDate()}/${dt.getMonth() + 1}`
    }),
    datasets: [{
      data: chartDates.map(d => appUsage[d] || 0),
      backgroundColor: 'var(--theme-color)',
      borderRadius: 4,
      borderSkipped: false,
    }],
  }
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.raw} aperture` } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#555', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#555', stepSize: 1, precision: 0 }, beginAtZero: true },
    },
  }

  // ── Weekday chart ──────────────────────────────────────────────────────────
  const weekdayStats = getWeekdayStats(appUsage)
  // Riordina Lun-Dom
  const orderedWeekday = [1, 2, 3, 4, 5, 6, 0].map(i => weekdayStats[i])
  const maxAvg = Math.max(...orderedWeekday.map(d => d.avg), 1)
  const peakDayIdx = orderedWeekday.findIndex(d => d.avg === maxAvg)

  // ── Heatmap ────────────────────────────────────────────────────────────────
  // Build 52 weeks × 7 days for given year
  const heatmapWeeks = useMemo(() => {
    const jan1 = new Date(heatmapYear, 0, 1)
    // Find Monday of week containing Jan 1
    const startDow = jan1.getDay() || 7
    const start = new Date(jan1)
    start.setDate(jan1.getDate() - (startDow - 1))
    const weeks = []
    for (let w = 0; w < 53; w++) {
      const week = []
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start)
        cur.setDate(start.getDate() + w * 7 + d)
        const key = toDateString(cur)
        week.push({ key, val: appUsage[key] || 0, inYear: cur.getFullYear() === heatmapYear })
      }
      weeks.push(week)
    }
    return weeks
  }, [heatmapYear, appUsage])

  const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

  const statCards = [
    { label: 'Oggi', value: todayCount, icon: '📅' },
    { label: 'Questa settimana', value: last7, icon: '📆' },
    { label: 'Questo mese', value: thisMonth, icon: '🗓️' },
    { label: 'Media giornaliera', value: `${avgDaily}×`, icon: '📊' },
    { label: 'Giorno più attivo', value: mostActiveCount > 0 ? mostActiveCount : '—', icon: '🔥', sub: mostActiveCount > 0 ? mostActiveDate : '' },
    { label: 'Totale lifetime', value: lifetimeTotal, icon: '⭐' },
  ]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box" style={{ maxHeight: '90vh', overflowY: 'auto', paddingBottom: 40 }}>
        <h3>📱 Uso App</h3>

        {/* Stats grid 2×3 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {statCards.map(card => (
            <div key={card.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: '0.68em', color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{card.label}</div>
              <div style={{ fontSize: '1.6em', fontWeight: 800, color: 'var(--theme-color)', lineHeight: 1 }}>{card.value}</div>
              {card.sub && <div style={{ fontSize: '0.65em', color: '#555', marginTop: 3 }}>{card.sub}</div>}
            </div>
          ))}
        </div>

        {/* Streak */}
        <div style={{ background: 'var(--theme-glow)', border: '1px solid var(--theme-color)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75em', color: '#aaa' }}>Streak attuale</div>
            <div style={{ fontSize: '1.4em', fontWeight: 800, color: 'var(--theme-color)' }}>🔥 {streakCurrent} giorni</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75em', color: '#aaa' }}>Record</div>
            <div style={{ fontSize: '1.4em', fontWeight: 800, color: 'var(--theme-color)' }}>🏆 {streakRecord} giorni</div>
          </div>
        </div>

        {/* Bar chart — aperture per giorno */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: '0.88em' }}>Aperture giornaliere</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[7, 30, 90].map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '3px 10px', borderRadius: 20, border: 'none', fontSize: '0.72em', cursor: 'pointer',
                  background: period === p ? 'var(--theme-color)' : 'rgba(255,255,255,0.06)',
                  color: period === p ? '#000' : '#666', fontWeight: period === p ? 700 : 400,
                }}>
                  {p}g
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 140 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Giorno della settimana preferito */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88em', marginBottom: 10 }}>Giorno preferito</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {orderedWeekday.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, fontSize: '0.72em', color: i === peakDayIdx ? 'var(--theme-color)' : '#666', fontWeight: i === peakDayIdx ? 700 : 400 }}>
                  {d.name}
                </div>
                <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(d.avg / maxAvg) * 100}%`, height: '100%', borderRadius: 7,
                    background: i === peakDayIdx ? 'var(--theme-color)' : 'rgba(255,255,255,0.15)',
                    transition: 'width 0.4s',
                  }} />
                </div>
                <div style={{ width: 28, fontSize: '0.72em', color: i === peakDayIdx ? 'var(--theme-color)' : '#555', textAlign: 'right', fontWeight: i === peakDayIdx ? 700 : 400 }}>
                  {d.avg}×
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap annuale */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '0.88em' }}>Attività annuale</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setHeatmapYear(y => y - 1)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.1em', padding: '0 4px' }}>‹</button>
              <span style={{ fontSize: '0.82em', fontWeight: 600 }}>{heatmapYear}</span>
              <button onClick={() => setHeatmapYear(y => y + 1)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.1em', padding: '0 4px' }}>›</button>
            </div>
          </div>
          {/* Month labels */}
          <div style={{ display: 'flex', gap: 1, marginBottom: 2, paddingLeft: 18 }}>
            {MONTH_LABELS.map(m => (
              <div key={m} style={{ flex: 1, fontSize: '0.58em', color: '#444', textAlign: 'center' }}>{m}</div>
            ))}
          </div>
          {/* Grid: rows = days of week, cols = weeks */}
          <div style={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            {/* Day labels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginRight: 2 }}>
              {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((l, i) => (
                <div key={i} style={{ width: 11, height: 11, fontSize: '0.5em', color: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{l}</div>
              ))}
            </div>
            {/* Weeks */}
            <div style={{ display: 'flex', gap: 1, flex: 1, overflowX: 'auto' }}>
              {heatmapWeeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {week.map((cell, di) => (
                    <div
                      key={di}
                      title={cell.inYear ? `${cell.key}: ${cell.val} aperture` : ''}
                      style={{
                        width: 11, height: 11, borderRadius: 2,
                        background: cell.inYear ? getHeatmapColor(cell.val) : 'transparent',
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '0.62em', color: '#444' }}>Meno</span>
            {[0, 1, 3, 6].map(v => (
              <div key={v} style={{ width: 11, height: 11, borderRadius: 2, background: getHeatmapColor(v) }} />
            ))}
            <span style={{ fontSize: '0.62em', color: '#444' }}>Più</span>
          </div>
        </div>

        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}
