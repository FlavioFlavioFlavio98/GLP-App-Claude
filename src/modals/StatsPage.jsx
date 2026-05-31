import { useEffect, useRef, useState } from 'react'
import { Chart } from '../lib/chartSetup'
import { useApp } from '../lib/store'
import { buildDailyNets, buildWeeklyNets, buildTagScores, buildRecords, buildMonthHeatmap, buildTagStats, buildTagWeeklyTrend, buildTagDetailStats } from '../lib/statsLogic'
import { toDateString } from '../lib/habitLogic'

function PdfExportButton({ onClose }) {
  const { actions } = useApp()
  return (
    <button
      onClick={() => { onClose(); setTimeout(() => actions.openModal('pdfReport'), 60) }}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: '0.78em', transition: 'all 0.2s' }}
      title="Esporta Report PDF"
    >
      <span className="material-icons-round" style={{ fontSize: 16 }}>picture_as_pdf</span>
      PDF
    </button>
  )
}

const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const DOW_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

export default function StatsPage() {
  const { state, actions } = useApp()
  const { modal, allUsersData, currentUser } = state
  if (modal !== 'statsPage') return null
  return <StatsPageInner allUsersData={allUsersData} currentUser={currentUser} onClose={() => actions.closeModal()} />
}

function StatsPageInner({ allUsersData, currentUser, onClose }) {
  const [section, setSection] = useState('comparison')
  const userData = allUsersData[currentUser]
  const otherUser = currentUser === 'flavio' ? 'simona' : 'flavio'
  const otherData = allUsersData[otherUser]

  const sections = [
    { id: 'comparison', icon: 'show_chart', label: 'Confronto' },
    { id: 'categories', icon: 'category', label: 'Categorie' },
    { id: 'weekly', icon: 'bar_chart', label: 'Settimane' },
    { id: 'records', icon: 'emoji_events', label: 'Record' },
    { id: 'heatmap', icon: 'calendar_month', label: 'Calendario' },
  ]

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={onClose}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.2em', color: 'var(--theme-color)', flex: 1 }}>Statistiche</h1>
        <PdfExportButton onClose={onClose} />
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0', overflowX: 'auto', background: 'var(--card)', borderBottom: '1px solid #333' }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            flex: '0 0 auto', padding: '8px 14px', border: 'none', borderRadius: '8px 8px 0 0',
            background: section === s.id ? '#2a2a2a' : 'transparent',
            color: section === s.id ? 'var(--theme-color)' : '#666',
            cursor: 'pointer', fontSize: '0.8em', display: 'flex', alignItems: 'center', gap: 4,
            borderBottom: section === s.id ? '2px solid var(--theme-color)' : '2px solid transparent',
          }}>
            <span className="material-icons-round" style={{ fontSize: 16 }}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      <div className="single-habit-body">
        {section === 'comparison' && <ComparisonSection allUsersData={allUsersData} currentUser={currentUser} />}
        {section === 'categories' && <CategoriesSection userData={userData} />}
        {section === 'weekly' && <WeeklySection userData={userData} currentUser={currentUser} />}
        {section === 'records' && <RecordsSection userData={userData} />}
        {section === 'heatmap' && <HeatmapSection userData={userData} />}
      </div>
    </div>
  )
}

/* ---- SEZIONE CONFRONTO ---- */
function ComparisonSection({ allUsersData, currentUser }) {
  const [days, setDays] = useState(30)
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const fData = buildDailyNets(allUsersData.flavio, days)
    const sData = buildDailyNets(allUsersData.simona, days)
    const labels = fData.map(d => d.label)

    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Flavio', data: fData.map(d => d.net), borderColor: '#ffca28', backgroundColor: 'rgba(255,202,40,0.08)', fill: true, tension: 0.3, pointRadius: days > 30 ? 2 : 4, borderWidth: 2 },
          { label: 'Simona', data: sData.map(d => d.net), borderColor: '#d05ce3', backgroundColor: 'rgba(208,92,227,0.08)', fill: true, tension: 0.3, pointRadius: days > 30 ? 2 : 4, borderWidth: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#aaa', boxWidth: 12 } } },
        scales: {
          y: { grid: { color: '#2a2a2a' }, ticks: { color: '#666' } },
          x: { grid: { display: false }, ticks: { color: '#666', maxTicksLimit: 10 } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [days, allUsersData.flavio, allUsersData.simona])

  // Aggregates
  const fNets = buildDailyNets(allUsersData.flavio, days)
  const sNets = buildDailyNets(allUsersData.simona, days)
  const fAvg = fNets.length ? (fNets.reduce((a, d) => a + d.net, 0) / fNets.length).toFixed(1) : 0
  const sAvg = sNets.length ? (sNets.reduce((a, d) => a + d.net, 0) / sNets.length).toFixed(1) : 0

  return (
    <>
      <SectionTitle>Flavio vs Simona</SectionTitle>
      <div className="switch-group" style={{ marginBottom: 12 }}>
        {[30, 60, 90].map(d => (
          <div key={d} className={`switch-opt${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>{d} GG</div>
        ))}
      </div>
      <div style={{ height: 200, marginBottom: 16, position: 'relative' }}><canvas ref={canvasRef} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard color="#ffca28" label="Media Flavio" value={`${fAvg > 0 ? '+' : ''}${fAvg}`} />
        <StatCard color="#d05ce3" label="Media Simona" value={`${sAvg > 0 ? '+' : ''}${sAvg}`} />
      </div>
    </>
  )
}

/* ---- SEZIONE TAG ---- */
function TagSection({ allUsersData, currentUser }) {
  const [user, setUser] = useState(currentUser)
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const userData = allUsersData[user]
  const tagsMap = {}
  ;(userData?.tags || []).forEach(t => { tagsMap[t.id] = t })

  useEffect(() => {
    if (!canvasRef.current || !userData) return
    const scores = buildTagScores(userData)
    const labels = [], data = [], colors = []
    Object.keys(scores).forEach(tId => {
      if (tId === '__none__') { labels.push('Nessun tag'); colors.push('#555') }
      else { const t = tagsMap[tId]; if (t) { labels.push(t.name); colors.push(t.color) } else return }
      data.push(scores[tId])
    })
    if (chartRef.current) chartRef.current.destroy()
    if (data.length === 0) return
    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#aaa', boxWidth: 12, font: { size: 11 } } } },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [user, allUsersData.flavio, allUsersData.simona])

  const scores = buildTagScores(userData)
  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  const sortedTags = Object.keys(scores)
    .map(tId => ({ tId, pts: scores[tId], label: tId === '__none__' ? 'Nessun tag' : (tagsMap[tId]?.name || '?'), color: tId === '__none__' ? '#555' : (tagsMap[tId]?.color || '#888') }))
    .sort((a, b) => b.pts - a.pts)

  return (
    <>
      <SectionTitle>Punti per Categoria</SectionTitle>
      <div className="switch-group" style={{ marginBottom: 12 }}>
        <div className={`switch-opt${user === 'flavio' ? ' active' : ''}`} onClick={() => setUser('flavio')}>Flavio</div>
        <div className={`switch-opt${user === 'simona' ? ' active' : ''}`} onClick={() => setUser('simona')}>Simona</div>
      </div>
      <div style={{ height: 200, marginBottom: 16, position: 'relative' }}><canvas ref={canvasRef} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sortedTags.map(({ tId, pts, label, color }) => (
          <div key={tId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85em' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{label}</span>
            <span style={{ color, fontWeight: 'bold' }}>{pts}</span>
            <span style={{ color: '#555', fontSize: '0.8em', minWidth: 32, textAlign: 'right' }}>
              {total > 0 ? `${Math.round(pts / total * 100)}%` : '0%'}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

/* ---- SEZIONE SETTIMANALE ---- */
function WeeklySection({ userData, currentUser }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !userData) return
    const weeks = buildWeeklyNets(userData, 12)
    const avg = weeks.reduce((a, w) => a + w.net, 0) / weeks.length
    const colors = weeks.map(w => w.net >= avg ? 'rgba(76,175,80,0.7)' : 'rgba(239,83,80,0.7)')

    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: weeks.map(w => w.label),
        datasets: [
          { label: 'Punti netti', data: weeks.map(w => w.net), backgroundColor: colors, borderRadius: 4 },
          { label: 'Media', data: weeks.map(() => Math.round(avg)), borderColor: 'var(--theme-color)', borderWidth: 1, borderDash: [4, 4], type: 'line', pointRadius: 0, fill: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: '#aaa', boxWidth: 12, font: { size: 11 } } } },
        scales: {
          y: { grid: { color: '#2a2a2a' }, ticks: { color: '#666' } },
          x: { grid: { display: false }, ticks: { color: '#666', font: { size: 10 } } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [userData])

  const weeks = buildWeeklyNets(userData, 12)
  const avg = weeks.length ? Math.round(weeks.reduce((a, w) => a + w.net, 0) / weeks.length) : 0
  const thisWeekNet = weeks[weeks.length - 1]?.net || 0
  const diff = thisWeekNet - avg
  const color = currentUser === 'flavio' ? '#ffca28' : '#d05ce3'

  return (
    <>
      <SectionTitle>Trend Settimanale (ultime 12 settimane)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <StatCard label="Questa settimana" value={`${thisWeekNet > 0 ? '+' : ''}${thisWeekNet}`} color={thisWeekNet >= avg ? 'var(--success)' : 'var(--danger)'} />
        <StatCard label={`vs media (${avg > 0 ? '+' : ''}${avg})`} value={`${diff > 0 ? '+' : ''}${diff}`} color={diff >= 0 ? 'var(--success)' : 'var(--danger)'} />
      </div>
      <div style={{ height: 200, position: 'relative' }}><canvas ref={canvasRef} /></div>
    </>
  )
}

/* ---- SEZIONE RECORD ---- */
function RecordsSection({ userData }) {
  if (!userData) return <div className="empty-state">Nessun dato</div>
  const r = buildRecords(userData)

  return (
    <>
      <SectionTitle>Record Personali</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <RecordRow icon="🏆" label="Giorno Migliore" value={r.bestDay ? `+${r.maxNet} (${r.bestDay.split('-').reverse().join('/')})` : '-'} color="var(--success)" />
        <RecordRow icon="📉" label="Giorno Peggiore" value={r.worstDay ? `${r.minNet} (${r.worstDay.split('-').reverse().join('/')})` : '-'} color="var(--danger)" />
        <RecordRow icon="🔥" label="Streak Più Lunga" value={`${r.bestStreakEver} giorni`} color="#ff9800" />
        <RecordRow icon="⚡" label="Streak Attuale" value={`${r.currentStreak} giorni`} color="#ffca28" />
        <RecordRow icon="🛍️" label="Premio Preferito" value={r.favReward ? `${r.favReward} (×${r.favRewardCount})` : '-'} />
        {r.neverFailed.length > 0 && (
          <div style={{ background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.2)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>✨ Mai Fallita</div>
            {r.neverFailed.map(name => (
              <div key={name} style={{ color: 'var(--success)', fontSize: '0.9em', padding: '2px 0' }}>• {name}</div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

/* ---- SEZIONE HEATMAP ---- */
function HeatmapSection({ userData }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  function changeMonth(dir) {
    let m = month + dir, y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m); setYear(y)
  }

  const days = buildMonthHeatmap(userData, year, month)
  const firstDOW = new Date(year, month, 1).getDay() // 0=Sun
  const maxNet = Math.max(...days.map(d => d.net), 1)
  const minNet = Math.min(...days.map(d => d.net), -1)

  function cellColor(d) {
    if (!d.hasData) return '#1a1a1a'
    if (d.net > 0) {
      const intensity = Math.min(d.net / maxNet, 1)
      return `rgba(76,175,80,${0.2 + intensity * 0.8})`
    }
    if (d.net < 0) {
      const intensity = Math.min(Math.abs(d.net) / Math.abs(minNet), 1)
      return `rgba(239,83,80,${0.2 + intensity * 0.8})`
    }
    return '#2a2a2a'
  }

  const todayStr = toDateString(today)

  return (
    <>
      <SectionTitle>Calendario Mensile</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button className="btn-icon" onClick={() => changeMonth(-1)}><span className="material-icons-round">chevron_left</span></button>
        <span style={{ fontWeight: 'bold', color: 'var(--theme-color)' }}>{MONTH_NAMES[month]} {year}</span>
        <button className="btn-icon" onClick={() => changeMonth(1)} disabled={year === today.getFullYear() && month >= today.getMonth()}>
          <span className="material-icons-round">chevron_right</span>
        </button>
      </div>

      {/* DOW headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 3 }}>
        {['D','L','M','M','G','V','S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: '0.65em', color: '#555', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {/* Empty cells before first day */}
        {Array.from({ length: firstDOW }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(d => (
          <div key={d.dateStr} style={{
            aspectRatio: '1', borderRadius: 4, background: cellColor(d),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65em', color: d.hasData ? '#fff' : '#444',
            border: d.dateStr === todayStr ? '1px solid var(--theme-color)' : '1px solid transparent',
            position: 'relative',
          }} title={d.hasData ? `${d.dateStr}: ${d.net > 0 ? '+' : ''}${d.net}` : d.dateStr}>
            <span style={{ fontWeight: d.dateStr === todayStr ? 'bold' : 'normal' }}>{d.dayNum}</span>
            {d.hasData && (
              <span style={{ position: 'absolute', bottom: 1, right: 2, fontSize: '0.7em', opacity: 0.7 }}>
                {d.net > 0 ? '+' : ''}{d.net}
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12, fontSize: '0.7em', color: '#666', justifyContent: 'center' }}>
        <span>🟢 Positivo</span><span>🔴 Negativo</span><span>⬛ Zero/Nessun dato</span>
      </div>
    </>
  )
}

/* ---- SMALL REUSABLE COMPONENTS ---- */
function SectionTitle({ children }) {
  return <div style={{ fontSize: '0.85em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontWeight: 600 }}>{children}</div>
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #333', borderRadius: 10, padding: 12, textAlign: 'center' }}>
      <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: color || 'var(--theme-color)' }}>{value}</div>
      <div style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function RecordRow({ icon, label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #333', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: '1.4em' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.7em', color: '#666', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontWeight: 'bold', color: color || 'var(--text)', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}

/* ===================================================
   CATEGORIES SECTION
   =================================================== */
function CategoriesSection({ userData }) {
  const [days, setDays] = useState(30)
  const [trendTagId, setTrendTagId] = useState(null)
  const [detailTag, setDetailTag] = useState(null)
  const donutRef = useRef(null), donutChart = useRef(null)
  const radarRef = useRef(null), radarChart = useRef(null)
  const trendRef = useRef(null), trendChart = useRef(null)

  const tagsMap = {}
  ;(userData?.tags || []).forEach(t => { tagsMap[t.id] = t })

  const tagStats = buildTagStats(userData, days)
  const totalPts = Object.values(tagStats).reduce((a, b) => a + b.pts, 0)

  // Build sorted array with tag info
  const tagList = Object.keys(tagStats)
    .map(tId => {
      const t = tagsMap[tId]
      return {
        tId,
        label: tId === '__none__' ? 'Senza categoria' : (t?.name || '?'),
        color: tId === '__none__' ? '#555' : (t?.color || '#888'),
        icon: t?.icon || '', emoji: t?.emoji || '',
        pts: tagStats[tId].pts, count: tagStats[tId].count,
        pct: totalPts > 0 ? Math.round(tagStats[tId].pts / totalPts * 100) : 0,
      }
    })
    .sort((a, b) => b.pts - a.pts)

  // Donut chart
  useEffect(() => {
    if (!donutRef.current || tagList.length === 0) return
    if (donutChart.current) donutChart.current.destroy()
    donutChart.current = new Chart(donutRef.current, {
      type: 'doughnut',
      data: {
        labels: tagList.map(t => t.label),
        datasets: [{ data: tagList.map(t => t.pts), backgroundColor: tagList.map(t => t.color), borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { display: false } },
      },
    })
    return () => { if (donutChart.current) donutChart.current.destroy() }
  }, [days, userData])

  // Radar chart
  useEffect(() => {
    if (!radarRef.current || tagList.length < 3) return
    const maxPts = Math.max(...tagList.map(t => t.pts), 1)
    const normalized = tagList.map(t => Math.round(t.pts / maxPts * 100))
    if (radarChart.current) radarChart.current.destroy()
    radarChart.current = new Chart(radarRef.current, {
      type: 'radar',
      data: {
        labels: tagList.map(t => t.label),
        datasets: [{
          label: 'Equilibrio',
          data: normalized,
          backgroundColor: 'rgba(var(--theme-color-rgb, 255,202,40),0.12)',
          borderColor: 'var(--theme-color)',
          pointBackgroundColor: tagList.map(t => t.color),
          pointRadius: 5, borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          r: {
            beginAtZero: true, max: 100,
            grid: { color: 'rgba(255,255,255,0.08)' },
            ticks: { color: '#555', backdropColor: 'transparent', font: { size: 9 }, stepSize: 25 },
            pointLabels: { color: '#aaa', font: { size: 10 } },
          },
        },
        plugins: { legend: { display: false } },
      },
    })
    return () => { if (radarChart.current) radarChart.current.destroy() }
  }, [days, userData])

  // Trend chart for selected tag
  useEffect(() => {
    if (!trendRef.current || !trendTagId) return
    const trendData = buildTagWeeklyTrend(userData, trendTagId, 12)
    const tagColor = tagsMap[trendTagId]?.color || 'var(--theme-color)'
    if (trendChart.current) trendChart.current.destroy()
    trendChart.current = new Chart(trendRef.current, {
      type: 'line',
      data: {
        labels: trendData.map(d => d.label),
        datasets: [{
          data: trendData.map(d => d.pts),
          borderColor: tagColor, backgroundColor: `${tagColor}22`,
          fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2,
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
    return () => { if (trendChart.current) trendChart.current.destroy() }
  }, [trendTagId, days, userData])

  if (tagList.length === 0) return <div className="empty-state">Nessuna categoria con dati nel periodo</div>

  return (
    <>
      <SectionTitle>Distribuzione per Categoria</SectionTitle>
      <div className="switch-group" style={{ marginBottom: 12 }}>
        {[7, 30, 90].map(d => (
          <div key={d} className={`switch-opt${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>{d} GG</div>
        ))}
      </div>

      {/* Donut with center total */}
      <div style={{ position: 'relative', height: 180, marginBottom: 16 }}>
        <canvas ref={donutRef} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: '1.4em', fontWeight: 700, color: 'var(--theme-color)' }}>{totalPts}</div>
          <div style={{ fontSize: '0.62em', color: '#666', textTransform: 'uppercase' }}>pt totali</div>
        </div>
      </div>

      {/* Horizontal bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {tagList.map(t => (
          <div
            key={t.tId}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}
            onClick={() => { setTrendTagId(t.tId); setDetailTag(t.tId) }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
              {t.emoji ? <span>{t.emoji}</span> : t.icon ? <i className={`ti ${t.icon}`} style={{ color: t.color, fontSize: '0.9em' }} /> : null}
              <span style={{ flex: 1, fontWeight: 500, fontSize: '0.88em' }}>{t.label}</span>
              <span style={{ color: t.color, fontWeight: 700 }}>{t.pts}</span>
              <span style={{ color: '#555', fontSize: '0.75em' }}>{t.pct}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
              <div style={{ background: t.color, height: '100%', width: `${t.pct}%`, borderRadius: 4, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: '0.68em', color: '#555', marginTop: 4 }}>{t.count} completamenti</div>
          </div>
        ))}
      </div>

      {/* Radar chart */}
      {tagList.length >= 3 ? (
        <>
          <SectionTitle>Radar Equilibrio</SectionTitle>
          <div style={{ height: 220, marginBottom: 20, position: 'relative' }}><canvas ref={radarRef} /></div>
        </>
      ) : (
        <div style={{ fontSize: '0.8em', color: '#555', textAlign: 'center', marginBottom: 16 }}>
          Il radar richiede almeno 3 categorie con dati
        </div>
      )}

      {/* Trend per tag selezionato */}
      {trendTagId && (
        <>
          <SectionTitle>
            Trend: {tagList.find(t => t.tId === trendTagId)?.label || ''} (12 settimane)
          </SectionTitle>
          <div style={{ height: 140, marginBottom: 20, position: 'relative' }}><canvas ref={trendRef} /></div>
        </>
      )}

      {/* Tag detail mini-modal */}
      {detailTag && (
        <TagDetailOverlay
          tId={detailTag}
          label={tagList.find(t => t.tId === detailTag)?.label || ''}
          color={tagList.find(t => t.tId === detailTag)?.color || '#888'}
          userData={userData}
          onClose={() => setDetailTag(null)}
        />
      )}
    </>
  )
}

function TagDetailOverlay({ tId, label, color, userData, onClose }) {
  const stats = buildTagDetailStats(userData, tId)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 6000, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div style={{ background: 'var(--card-solid)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxHeight: '70vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
          <h3 style={{ margin: 0, color }}>{label}</h3>
          <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={onClose}><span className="material-icons-round">close</span></button>
        </div>
        <div className="stats-grid">
          <div className="stat-box"><span className="stat-num" style={{ color }}>{stats.totalPts}</span><span className="stat-lbl">Punti Lifetime</span></div>
          <div className="stat-box"><span className="stat-num" style={{ color: 'var(--success)' }}>{stats.avgCompletion}%</span><span className="stat-lbl">% Completamento</span></div>
          <div className="stat-box"><span className="stat-num">{stats.bestStreak} 🔥</span><span className="stat-lbl">Streak Record</span></div>
          <div className="stat-box"><span className="stat-num" style={{ fontSize: '0.9em' }}>{stats.bestDOW}</span><span className="stat-lbl">Giorno Top</span></div>
        </div>
        {stats.bestHabit !== '-' && (
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.65em', color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>Abitudine Top</div>
            <div style={{ fontWeight: 600, color }}>{stats.bestHabit}</div>
          </div>
        )}
      </div>
    </div>
  )
}
