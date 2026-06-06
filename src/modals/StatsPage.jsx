import { useEffect, useRef, useState } from 'react'
import { Chart } from '../lib/chartSetup'
import { useApp } from '../lib/store'
import { buildDailyNets, buildWeeklyNets, buildTagScores, buildRecords, buildMonthHeatmap, buildTagStats, buildTagWeeklyTrend, buildTagDetailStats, buildMoodTimeline, buildMoodNetAverage, buildLifeMap, buildQualityRanking, qualityLabel, buildMoodToWinRate, buildHabitToMood, buildHabitCoMatrix, buildBubbleData, buildEnergyTimeline, buildEnergyCorrelations, buildLifeTimeline, buildAnnualHeatmap, buildMomentumScoreHistory, buildTimeSlotStats, calcMomentumScore } from '../lib/statsLogic'
import { toDateString } from '../lib/habitLogic'
import { MOODS } from './MoodModal'

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
  const { actions } = useApp()
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
    { id: 'timeline', icon: 'timeline', label: 'Timeline' },
    { id: 'annoheatmap', icon: 'grid_view', label: 'Anno' },
    { id: 'momentum', icon: 'trending_up', label: 'Momentum' },
    { id: 'mood', icon: 'mood', label: 'Mood' },
    { id: 'lifemap', icon: 'radar', label: 'Mappa Vita' },
    { id: 'quality', icon: 'grade', label: 'Qualità' },
    { id: 'causeffect', icon: 'insights', label: 'Cause-Effetto' },
    { id: 'bubbles', icon: 'bubble_chart', label: 'Bolle' },
    { id: 'energy', icon: 'bolt', label: 'Energia' },
    { id: 'tasks', icon: 'assignment_turned_in', label: 'Task' },
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
        {section === 'timeline' && <TimelineSection userData={userData} />}
        {section === 'annoheatmap' && <AnnualHeatmapSection userData={userData} />}
        {section === 'momentum' && <MomentumSection userData={userData} />}
        {section === 'mood' && <MoodSection allUsersData={allUsersData} currentUser={currentUser} />}
        {section === 'lifemap' && <LifeMapSection userData={userData} />}
        {section === 'quality' && <QualitySection userData={userData} onHabitClick={id => { onClose(); setTimeout(() => actions.openModal('singleHabit', id), 60) }} />}
        {section === 'causeffect' && <CauseEffectSection userData={userData} currentUser={currentUser} />}
        {section === 'bubbles' && <BubblesSection userData={userData} onHabitClick={id => { onClose(); setTimeout(() => actions.openModal('singleHabit', id), 60) }} />}
        {section === 'energy' && <EnergySection userData={userData} currentUser={currentUser} />}
        {section === 'tasks' && <TaskStatsSection userData={userData} />}
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

/* ---- SEZIONE BOLLE ---- */
function BubblesSection({ userData, onHabitClick }) {
  const [days, setDays] = useState(30)
  const [selectedTags, setSelectedTags] = useState(null) // null = show all
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  const tagsMap = {}
  ;(userData?.tags || []).forEach(t => { tagsMap[t.id] = t })
  const allData = buildBubbleData(userData, days)
  const filtered = selectedTags ? allData.filter(d => selectedTags.has(d.tagId || '__none__')) : allData
  const tagIds = [...new Set(allData.map(d => d.tagId || '__none__'))]

  const IMPORTANCE_OPACITY = { high: 0.9, medium: 0.65, low: 0.4 }
  const [hoveredId, setHoveredId] = useState(null)

  useEffect(() => {
    if (!canvasRef.current || filtered.length === 0) return
    if (chartRef.current) chartRef.current.destroy()

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bubble',
      data: {
        datasets: filtered.map(d => {
          const opacity = IMPORTANCE_OPACITY[d.importance] || 0.65
          const hex = d.color || '#888'
          return {
            label: d.name,
            data: [{ x: d.x, y: d.y, r: d.r, id: d.id }],
            backgroundColor: `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
            borderColor: d.color || '#888',
            borderWidth: 1.5,
          }
        }),
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const d = ctx.raw
                const habit = filtered[ctx.datasetIndex]
                return `${habit.name} — freq: ${d.x}/sett, win: ${d.y}%, pt: ${habit.totalPts}`
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: 'Frequenza (volte/sett)', color: '#666' }, grid: { color: '#2a2a2a' }, ticks: { color: '#666' }, beginAtZero: true },
          y: { title: { display: true, text: 'Win rate %', color: '#666' }, grid: { color: '#2a2a2a' }, ticks: { color: '#666' }, min: 0, max: 100 },
        },
        onClick(e, els) {
          if (els[0]) {
            const d = filtered[els[0].datasetIndex]
            if (d?.id) onHabitClick?.(d.id)
          }
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [days, filtered])

  function toggleTag(tagId) {
    setSelectedTags(prev => {
      if (!prev) {
        const s = new Set(tagIds)
        s.delete(tagId)
        return s.size === tagIds.length - 1 ? s : null
      }
      const s = new Set(prev)
      if (s.has(tagId)) s.delete(tagId)
      else s.add(tagId)
      return s.size === tagIds.length ? null : (s.size === 0 ? prev : s)
    })
  }

  return (
    <>
      <SectionTitle>Grafico a Bolle</SectionTitle>
      <div style={{ fontSize: '0.72em', color: '#555', marginBottom: 10 }}>
        Dimensione = punti totali · Opacità = importanza · Tocca per aprire l'abitudine
      </div>
      <div className="switch-group" style={{ marginBottom: 12 }}>
        {[30, 60, 90].map(d => (
          <div key={d} className={`switch-opt${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>{d} GG</div>
        ))}
      </div>

      {/* Tag filters */}
      {tagIds.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {tagIds.map(tid => {
            const tag = tagsMap[tid]
            const active = !selectedTags || selectedTags.has(tid)
            return (
              <button key={tid} onClick={() => toggleTag(tid)} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: '0.72em', cursor: 'pointer',
                background: active ? (tag?.color || '#666') : 'rgba(255,255,255,0.05)',
                border: `1px solid ${tag?.color || '#666'}`,
                color: active ? '#fff' : '#666', fontWeight: active ? 700 : 400,
                transition: 'all 0.18s',
              }}>
                {tag?.emoji || ''} {tag?.name || 'Senza tag'}
              </button>
            )
          })}
        </div>
      )}

      {filtered.length < 2 ? (
        <div className="empty-state">Dati insufficienti per il grafico</div>
      ) : (
        <>
          <div style={{ height: 280, marginBottom: 16, position: 'relative' }}><canvas ref={canvasRef} /></div>
          {/* Quadrant labels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.68em', color: '#555' }}>
            <div style={{ textAlign: 'left' }}>⭐ Bassa freq + alto WR<br/><span style={{ color: '#444' }}>Occasionali ma efficaci</span></div>
            <div style={{ textAlign: 'right' }}>💪 Alta freq + alto WR<br/><span style={{ color: '#444' }}>Abitudini solide</span></div>
            <div style={{ textAlign: 'left' }}>🤔 Bassa freq + basso WR<br/><span style={{ color: '#444' }}>Da rivalutare</span></div>
            <div style={{ textAlign: 'right' }}>⚠️ Alta freq + basso WR<br/><span style={{ color: '#444' }}>Da migliorare</span></div>
          </div>
        </>
      )}
    </>
  )
}

/* ---- SEZIONE ENERGIA ---- */
function EnergySection({ userData, currentUser }) {
  const [days, setDays] = useState(30)
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  const timeline = buildEnergyTimeline(userData, currentUser, days)
  const corr = buildEnergyCorrelations(userData, currentUser, 60)
  const withMorning = timeline.filter(d => d.morning !== null)
  const withEvening = timeline.filter(d => d.evening !== null)

  useEffect(() => {
    if (!canvasRef.current) return
    const withData = timeline.filter(d => d.morning !== null || d.evening !== null)
    if (withData.length < 2) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: timeline.map(d => d.label),
        datasets: [
          { label: '☀️ Mattina', data: timeline.map(d => d.morning), borderColor: '#EF9F27', backgroundColor: 'rgba(239,159,39,0.1)', fill: true, tension: 0.3, pointRadius: 4, spanGaps: true, borderWidth: 2 },
          { label: '🌙 Sera', data: timeline.map(d => d.evening), borderColor: '#7986cb', backgroundColor: 'rgba(121,134,203,0.1)', fill: true, tension: 0.3, pointRadius: 4, spanGaps: true, borderWidth: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: '#aaa', boxWidth: 12 } } },
        scales: {
          y: { min: 0.5, max: 3.5, ticks: { color: '#666', callback: v => ['', '⚡', '🔋', '⚡⚡'][Math.round(v)] || v, font: { size: 14 } }, grid: { color: '#2a2a2a' } },
          x: { grid: { display: false }, ticks: { color: '#666', maxTicksLimit: 8 } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [days, userData])

  return (
    <>
      <SectionTitle>Livelli di Energia</SectionTitle>
      <div className="switch-group" style={{ marginBottom: 12 }}>
        {[14, 30, 60].map(d => (
          <div key={d} className={`switch-opt${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>{d} GG</div>
        ))}
      </div>

      {withMorning.length < 3 && withEvening.length < 3 ? (
        <div className="empty-state">Registra l'energia per vedere le statistiche</div>
      ) : (
        <div style={{ height: 180, marginBottom: 16, position: 'relative' }}><canvas ref={canvasRef} /></div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <StatCard label="Media mattutina" value={corr.avgMorning !== null ? `${corr.avgMorning}/3` : '-'} color="#EF9F27" />
        <StatCard label="Media serale" value={corr.avgEvening !== null ? `${corr.avgEvening}/3` : '-'} color="#7986cb" />
      </div>

      {corr.bestDOW && corr.bestDOWAvg > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: '0.85em' }}>
          ⚡ Giorno con più energia: <strong style={{ color: 'var(--theme-color)' }}>{corr.bestDOW}</strong> (media {corr.bestDOWAvg}/3)
        </div>
      )}

      {/* Morning energy → win rate */}
      {corr.morningToWinRate.some(m => m.count >= 3) && (
        <>
          <SectionTitle>Energia Mattutina → Abitudini</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {corr.morningToWinRate.filter(m => m.count > 0).map(m => {
              const icons = ['', '⚡', '🔋', '⚡⚡']
              return (
                <div key={m.level} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 14px' }}>
                  <span style={{ fontSize: '1.1em' }}>{icons[m.level]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{ height: '100%', background: '#EF9F27', width: `${m.avgWinRate || 0}%`, borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.88em', minWidth: 40 }}>{m.avgWinRate !== null ? `${m.avgWinRate}%` : '-'}</span>
                  <span style={{ fontSize: '0.68em', color: '#444' }}>({m.count}gg)</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Evening energy → mood */}
      {corr.eveningToMood.some(m => m.count >= 3) && (
        <>
          <SectionTitle>Energia Serale → Mood</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {corr.eveningToMood.filter(m => m.count > 0).map(m => {
              const icons = ['', '⚡', '🔋', '⚡⚡']
              const MOODS_E = ['', '😞', '😕', '😐', '😊', '🤩']
              const moodIdx = m.avgMood !== null ? Math.round(m.avgMood) : null
              return (
                <div key={m.level} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 14px' }}>
                  <span style={{ fontSize: '1.1em' }}>{icons[m.level]}</span>
                  <span style={{ flex: 1, fontSize: '0.82em', color: '#888' }}>Mood medio quando energia {['','bassa','media','alta'][m.level]}</span>
                  <span style={{ fontSize: '1.2em' }}>{moodIdx ? MOODS_E[moodIdx] : '-'}</span>
                  <span style={{ fontSize: '0.78em', color: '#666' }}>{m.avgMood !== null ? `${m.avgMood}⭐` : '-'}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

/* ---- SEZIONE LIFE MAP ---- */
function LifeMapSection({ userData }) {
  const [days, setDays] = useState(30)
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const data = buildLifeMap(userData, days)

  const stdDev = (arr) => {
    if (arr.length < 2) return 0
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length
    return Math.sqrt(arr.reduce((acc, v) => acc + (v - avg) ** 2, 0) / arr.length)
  }
  const winRates = data.map(d => d.winRate)
  const balance = data.length > 1 ? Math.max(0, Math.round(100 - stdDev(winRates))) : 0
  const best = data[0]
  const worst = data[data.length - 1]

  useEffect(() => {
    if (!canvasRef.current || data.length < 3) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels: data.map(d => d.emoji ? `${d.emoji} ${d.name}` : d.name),
        datasets: [{
          label: 'Win Rate %',
          data: data.map(d => d.winRate),
          backgroundColor: 'rgba(var(--theme-color-rgb,255,202,40),0.15)',
          borderColor: 'var(--theme-color)',
          pointBackgroundColor: data.map(d => d.color),
          pointRadius: 5, borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          r: {
            beginAtZero: true, max: 100,
            grid: { color: 'rgba(255,255,255,0.08)' },
            ticks: { color: '#555', backdropColor: 'transparent', stepSize: 25, font: { size: 9 } },
            pointLabels: { color: '#aaa', font: { size: 10 } },
          },
        },
        plugins: { legend: { display: false } },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [days, userData])

  return (
    <>
      <SectionTitle>Mappa della Vita</SectionTitle>
      <div className="switch-group" style={{ marginBottom: 12 }}>
        {[7, 30, 90].map(d => (
          <div key={d} className={`switch-opt${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>{d} GG</div>
        ))}
      </div>
      {data.length < 3 ? (
        <div className="empty-state">Servono almeno 3 categorie con dati</div>
      ) : (
        <div style={{ height: 240, marginBottom: 20, position: 'relative' }}><canvas ref={canvasRef} /></div>
      )}

      {/* Category bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {data.map(d => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.82em' }}>{d.emoji ? `${d.emoji} ` : ''}{d.name}</span>
            <span style={{ fontSize: '0.78em', color: d.winRate < 40 ? 'var(--danger)' : 'var(--text)', fontWeight: 700 }}>
              {d.winRate}% {d.winRate >= 80 ? '⭐' : d.winRate < 40 ? '⚠️' : ''}
            </span>
            <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ height: '100%', background: d.color, width: `${d.winRate}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {best && <StatCard label="Area più forte" value={`${best.winRate}%`} color={best.color || 'var(--success)'} />}
        {worst && <StatCard label="Da migliorare" value={`${worst.winRate}%`} color={worst.winRate < 40 ? 'var(--danger)' : '#888'} />}
        <StatCard label="Equilibrio" value={`${balance}/100`} color={balance >= 70 ? 'var(--success)' : balance >= 50 ? '#EF9F27' : 'var(--danger)'} />
      </div>
    </>
  )
}

/* ---- SEZIONE QUALITY RANKING ---- */
function QualitySection({ userData, onHabitClick }) {
  const ranking = buildQualityRanking(userData)
  return (
    <>
      <SectionTitle>Classifica Qualità Abitudini</SectionTitle>
      {ranking.length === 0 ? <div className="empty-state">Nessuna abitudine attiva</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranking.map(({ habit, score }, i) => {
            const ql = qualityLabel(score)
            return (
              <div key={habit.id} onClick={() => onHabitClick?.(habit.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, cursor: 'pointer',
              }}>
                <div style={{ fontSize: '0.82em', color: '#555', minWidth: 20, textAlign: 'center' }}>#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.9em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</div>
                  <div style={{ fontSize: '0.7em', color: ql.color }}>{ql.text}</div>
                </div>
                <div style={{
                  background: ql.color + '22', border: `1px solid ${ql.color}44`,
                  borderRadius: 20, padding: '3px 10px', fontSize: '0.78em', fontWeight: 800, color: ql.color, flexShrink: 0,
                }}>
                  {score}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ---- SEZIONE CAUSA-EFFETTO ---- */
function CauseEffectSection({ userData, currentUser }) {
  const moodToWR = buildMoodToWinRate(userData, currentUser, 60)
  const habitToMood = buildHabitToMood(userData, currentUser, 60)
  const coMatrix = buildHabitCoMatrix(userData, 60)
  const MOOD_EMOJIS = ['', '😞', '😕', '😐', '😊', '🤩']

  const hasEnoughMood = moodToWR.some(m => m.count >= 3)

  if (!hasEnoughMood) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555' }}>
        <div style={{ fontSize: '3em', marginBottom: 12 }}>📊</div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Servono più dati mood</div>
        <div style={{ fontSize: '0.82em' }}>Registra il tuo mood ogni giorno per almeno 30 giorni per sbloccare questa analisi.</div>
      </div>
    )
  }

  return (
    <>
      {/* Mood → Win Rate */}
      <SectionTitle>Mood → Produttività</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {moodToWR.filter(m => m.count > 0).map(m => (
          <div key={m.mood} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px' }}>
            <span style={{ fontSize: '1.3em' }}>{MOOD_EMOJIS[m.mood]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72em', color: '#555' }}>{m.count} giorni</div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 4 }}>
                <div style={{ height: '100%', background: m.avgWinRate >= 70 ? 'var(--success)' : m.avgWinRate >= 40 ? '#EF9F27' : 'var(--danger)', width: `${m.avgWinRate}%`, borderRadius: 2 }} />
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9em', color: m.avgWinRate >= 70 ? 'var(--success)' : m.avgWinRate >= 40 ? '#EF9F27' : 'var(--danger)' }}>
              {m.avgWinRate}%
            </div>
          </div>
        ))}
      </div>

      {/* Habit → Mood */}
      {habitToMood.length > 0 && (
        <>
          <SectionTitle>Abitudini → Impatto sul Mood</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {habitToMood.slice(0, 6).map(h => (
              <div key={h.sid} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px' }}>
                <div style={{ fontWeight: 500, fontSize: '0.88em', marginBottom: 4 }}>{h.name}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.75em' }}>
                  <span>✓ Fatto: <strong style={{ color: 'var(--success)' }}>{h.avgDone} ⭐</strong></span>
                  <span>✗ Non fatto: <strong style={{ color: 'var(--danger)' }}>{h.avgNotDone} ⭐</strong></span>
                  <span style={{ color: h.diff > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                    {h.diff > 0 ? '+' : ''}{h.diff} Δ
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Co-occurrence matrix */}
      {coMatrix.habits.length >= 2 && (
        <>
          <SectionTitle>Matrice Co-occorrenza</SectionTitle>
          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: '0.68em' }}>
              <thead>
                <tr>
                  <th style={{ padding: '4px 6px', color: '#555', textAlign: 'left', maxWidth: 60, overflow: 'hidden' }}></th>
                  {coMatrix.habits.map(h => (
                    <th key={h.sid} style={{ padding: '4px 6px', color: '#555', writingMode: 'vertical-rl', maxWidth: 30 }}>
                      {h.name.slice(0, 8)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coMatrix.habits.map(ha => (
                  <tr key={ha.sid}>
                    <td style={{ padding: '4px 6px', color: '#666', whiteSpace: 'nowrap', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ha.name.slice(0, 8)}
                    </td>
                    {coMatrix.habits.map(hb => {
                      if (ha.sid === hb.sid) return <td key={hb.sid} style={{ background: '#333', width: 28, height: 28, borderRadius: 4 }} />
                      const cell = coMatrix.matrix[ha.sid]?.[hb.sid]
                      if (!cell || cell.onlyA < 10) return <td key={hb.sid} style={{ background: 'rgba(255,255,255,0.04)', width: 28, height: 28 }} />
                      const pct = Math.round(cell.both / cell.onlyA * 100)
                      const bg = pct >= 60 ? `rgba(76,175,80,${pct / 100})` : pct >= 30 ? `rgba(239,159,39,${pct / 100})` : `rgba(255,255,255,0.06)`
                      return (
                        <td key={hb.sid} title={`${ha.name} + ${hb.name}: ${pct}%`}
                          style={{ background: bg, width: 28, height: 28, textAlign: 'center', color: pct >= 40 ? '#fff' : '#555', borderRadius: 4 }}>
                          {pct >= 40 ? `${pct}%` : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: '0.65em', color: '#444', marginTop: 6 }}>🟢 = alta co-occorrenza · 🟡 = media · grigio = bassa/scarsi dati</div>
          </div>
        </>
      )}
    </>
  )
}

/* ---- SEZIONE MOOD ---- */
function MoodSection({ allUsersData, currentUser }) {
  const [user, setUser] = useState(currentUser)
  const [days, setDays] = useState(30)
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const userData = allUsersData[user]

  const timeline = buildMoodTimeline(userData, user, days)
  const correlation = buildMoodNetAverage(userData, user, days)
  const withData = timeline.filter(d => d.value !== null)
  const avgMood = withData.length ? (withData.reduce((a, b) => a + b.value, 0) / withData.length).toFixed(1) : '-'
  const dominant = withData.length ? MOODS.reduce((best, m) => {
    const cnt = withData.filter(d => d.value === m.value).length
    return cnt > best.cnt ? { mood: m, cnt } : best
  }, { mood: MOODS[2], cnt: 0 }).mood : MOODS[2]

  useEffect(() => {
    if (!canvasRef.current || timeline.length === 0) return
    if (chartRef.current) chartRef.current.destroy()
    const filtered = timeline.filter(d => d.value !== null)
    if (filtered.length < 2) return
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: filtered.map(d => d.label),
        datasets: [{
          label: 'Mood',
          data: filtered.map(d => d.value),
          borderColor: '#EF9F27',
          backgroundColor: 'rgba(239,159,39,0.1)',
          fill: true, tension: 0.3, pointRadius: 5,
          borderWidth: 2,
          pointBackgroundColor: filtered.map(d => MOODS.find(m => m.value === d.value)?.color || '#888'),
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0.5, max: 5.5, ticks: { color: '#666', callback: v => MOODS.find(m => m.value === v)?.emoji || v, font: { size: 14 } }, grid: { color: '#2a2a2a' } },
          x: { grid: { display: false }, ticks: { color: '#666', maxTicksLimit: 8 } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [user, days, allUsersData])

  return (
    <>
      <SectionTitle>Mood nel Tempo</SectionTitle>
      <div className="switch-group" style={{ marginBottom: 10 }}>
        <div className={`switch-opt${user === 'flavio' ? ' active' : ''}`} onClick={() => setUser('flavio')}>Flavio</div>
        <div className={`switch-opt${user === 'simona' ? ' active' : ''}`} onClick={() => setUser('simona')}>Simona</div>
      </div>
      <div className="switch-group" style={{ marginBottom: 12 }}>
        {[14, 30, 60].map(d => (
          <div key={d} className={`switch-opt${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>{d} GG</div>
        ))}
      </div>

      {withData.length < 2 ? (
        <div className="empty-state" style={{ padding: '30px 0' }}>Pochi dati mood nel periodo</div>
      ) : (
        <div style={{ height: 180, marginBottom: 16, position: 'relative' }}><canvas ref={canvasRef} /></div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <StatCard label="Mood medio" value={`${avgMood} ${withData.length ? MOODS[Math.round(parseFloat(avgMood)) - 1]?.emoji || '' : ''}`} color="#EF9F27" />
        <StatCard label="Mood prevalente" value={`${dominant?.emoji} ${dominant?.label}`} color={dominant?.color} />
      </div>

      {/* Correlazione mood vs punti */}
      <SectionTitle>Mood vs Punti netti</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {correlation.filter(c => c.count > 0).map(({ moodVal, avgNet, count }) => {
          const m = MOODS.find(x => x.value === moodVal)
          return (
            <div key={moodVal} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px' }}>
              <span style={{ fontSize: '1.3em' }}>{m?.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.78em', color: '#888' }}>{m?.label} ({count} giorni)</div>
              </div>
              <div style={{ fontWeight: 700, color: avgNet >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '0.95em' }}>
                {avgNet > 0 ? '+' : ''}{avgNet} pt/gg
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ---- SEZIONE TIMELINE VITA ---- */
const TIMELINE_COLORS = {
  excellent: { bg: '#1b5e20', border: '#4caf50', text: '#a5d6a7' },
  good:      { bg: '#2e7d32', border: '#81c784', text: '#c8e6c9' },
  normal:    { bg: '#f57f17', border: '#ffd54f', text: '#fff9c4' },
  difficult: { bg: '#bf360c', border: '#ff8a65', text: '#ffccbc' },
  negative:  { bg: '#b71c1c', border: '#ef9a9a', text: '#ffcdd2' },
}

function TimelineSection({ userData }) {
  const [selected, setSelected] = useState(null)
  const months = buildLifeTimeline(userData)

  if (months.length === 0) return <div className="empty-state">Nessun dato disponibile</div>

  const sel = selected !== null ? months[selected] : null

  return (
    <>
      <SectionTitle>Timeline della Vita</SectionTitle>
      <div style={{ fontSize: '0.72em', color: '#555', marginBottom: 12 }}>
        Scorri → per il presente. Tocca un mese per i dettagli.
      </div>

      {/* Horizontal scroll */}
      <div style={{ overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, width: 'max-content', paddingRight: 16 }}>
          {months.map((m, i) => {
            const colors = TIMELINE_COLORS[m.colorClass] || TIMELINE_COLORS.normal
            return (
              <div
                key={`${m.year}-${m.month}`}
                onClick={() => setSelected(selected === i ? null : i)}
                style={{
                  width: 80, minHeight: 100, borderRadius: 12, padding: '10px 8px',
                  background: colors.bg,
                  border: `2px solid ${m.isCurrentMonth ? 'var(--theme-color)' : colors.border}`,
                  boxShadow: m.isCurrentMonth ? '0 0 10px var(--theme-glow)' : 'none',
                  cursor: 'pointer', flexShrink: 0, textAlign: 'center',
                  transition: 'transform 0.15s',
                  transform: selected === i ? 'scale(1.06)' : 'scale(1)',
                }}
              >
                <div style={{ fontSize: '0.62em', color: colors.text, fontWeight: 700, marginBottom: 4, lineHeight: 1.2 }}>{m.label}</div>
                <div style={{ fontSize: '0.9em', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                  {m.totalNet > 0 ? '+' : ''}{m.totalNet}
                </div>
                {m.moodEmoji && <div style={{ fontSize: '1.1em', marginBottom: 4 }}>{m.moodEmoji}</div>}
                {m.maxStreak > 0 && (
                  <div style={{ fontSize: '0.58em', color: colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    🔥{m.maxStreak}
                  </div>
                )}
                {m.daysWithData === 0 && (
                  <div style={{ fontSize: '0.55em', color: '#888' }}>nessun dato</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, fontSize: '0.65em' }}>
        {Object.entries(TIMELINE_COLORS).map(([k, c]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1px solid ${c.border}`, display: 'inline-block' }} />
            {k === 'excellent' ? '≥15/gg' : k === 'good' ? '≥8/gg' : k === 'normal' ? '≥3/gg' : k === 'difficult' ? '≥0/gg' : '<0/gg'}
          </span>
        ))}
      </div>

      {/* Detail popup */}
      {sel && (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${TIMELINE_COLORS[sel.colorClass]?.border || '#444'}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong style={{ color: 'var(--theme-color)' }}>{sel.label}</strong>
            <button className="btn-icon" onClick={() => setSelected(null)}><span className="material-icons-round" style={{ fontSize: 16 }}>close</span></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.82em' }}>
            <div><span style={{ color: '#555' }}>Punteggio netto</span><br /><strong style={{ color: sel.totalNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>{sel.totalNet > 0 ? '+' : ''}{sel.totalNet}</strong></div>
            <div><span style={{ color: '#555' }}>Media giornaliera</span><br /><strong>{sel.avgDaily > 0 ? '+' : ''}{sel.avgDaily}/gg</strong></div>
            <div><span style={{ color: '#555' }}>Giorni tracciati</span><br /><strong>{sel.daysWithData}</strong></div>
            <div><span style={{ color: '#555' }}>Streak massima</span><br /><strong>🔥 {sel.maxStreak} giorni</strong></div>
            {sel.moodEmoji && <div><span style={{ color: '#555' }}>Mood medio</span><br /><strong>{sel.moodEmoji}</strong></div>}
            {sel.topDoneName && <div><span style={{ color: '#555' }}>Abitudine top</span><br /><strong style={{ color: 'var(--success)', fontSize: '0.88em' }}>{sel.topDoneName}</strong></div>}
            {sel.topFailedName && <div style={{ gridColumn: 'span 2' }}><span style={{ color: '#555' }}>Più fallita</span><br /><strong style={{ color: 'var(--danger)', fontSize: '0.88em' }}>{sel.topFailedName}</strong></div>}
          </div>
        </div>
      )}
    </>
  )
}

/* ---- SEZIONE HEATMAP ANNUALE ---- */
const HEATMAP_MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function AnnualHeatmapSection({ userData }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [popup, setPopup] = useState(null)

  const cells = buildAnnualHeatmap(userData, year)
  const todayStr = toDateString(today)
  const daysWithData = cells.filter(c => c.hasData && c.inYear).length
  const maxNet = Math.max(...cells.filter(c => c.hasData && c.net > 0).map(c => c.net), 1)
  const bestCell = cells.filter(c => c.hasData && c.inYear).reduce((best, c) => (!best || c.net > best.net) ? c : best, null)

  // Group by week columns (0..52), each col is 7 rows Mon..Sun
  const weeks = {}
  cells.forEach(c => {
    if (!weeks[c.week]) weeks[c.week] = Array(7).fill(null)
    weeks[c.week][c.dow === 0 ? 6 : c.dow - 1] = c  // convert Sun=0 → index 6
  })
  const weekKeys = Object.keys(weeks).map(Number).sort((a, b) => a - b)

  // Month label positions
  const monthCols = {}
  cells.filter(c => c.inYear && c.day === 1).forEach(c => { if (!monthCols[c.month]) monthCols[c.month] = c.week })

  function cellColor(c) {
    if (!c || !c.inYear) return 'transparent'
    if (!c.hasData) return '#2a2a2a'
    if (c.net < 0) return `rgba(239,83,80,${Math.min(0.3 + Math.abs(c.net) / maxNet * 0.7, 1)})`
    if (c.net === 0) return '#2a2a2a'
    const intensity = Math.min(c.net / maxNet, 1)
    if (intensity >= 0.75) return '#1b5e20'
    if (intensity >= 0.5) return '#2e7d32'
    if (intensity >= 0.25) return '#43a047'
    return '#66bb6a'
  }

  const CELL_SIZE = 11
  const CELL_GAP = 2

  return (
    <>
      <SectionTitle>Heatmap Annuale</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
        <button className="btn-icon" onClick={() => setYear(y => y - 1)}><span className="material-icons-round">chevron_left</span></button>
        <span style={{ fontWeight: 700, color: 'var(--theme-color)', fontSize: '1.1em' }}>{year}</span>
        <button className="btn-icon" onClick={() => setYear(y => y + 1)} disabled={year >= today.getFullYear()}>
          <span className="material-icons-round">chevron_right</span>
        </button>
      </div>

      {/* Month labels */}
      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ position: 'relative', paddingLeft: 18 }}>
          {/* Month labels row */}
          <div style={{ display: 'flex', marginBottom: 4, marginLeft: 0 }}>
            {weekKeys.map(w => {
              const monthIdx = Object.keys(monthCols).find(m => monthCols[m] === w)
              return (
                <div key={w} style={{ width: CELL_SIZE + CELL_GAP, flexShrink: 0, fontSize: '0.55em', color: '#666', textAlign: 'left' }}>
                  {monthIdx !== undefined ? HEATMAP_MONTH_NAMES[monthIdx] : ''}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: CELL_GAP }}>
            {/* Day-of-week labels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: CELL_GAP, marginRight: 4 }}>
              {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} style={{ width: 10, height: CELL_SIZE, fontSize: '0.5em', color: '#555', display: 'flex', alignItems: 'center', lineHeight: 1 }}>{d}</div>
              ))}
            </div>

            {/* Grid */}
            {weekKeys.map(w => (
              <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: CELL_GAP }}>
                {weeks[w].map((c, dow) => (
                  <div
                    key={dow}
                    onClick={() => c?.hasData && c?.inYear && setPopup(c)}
                    style={{
                      width: CELL_SIZE, height: CELL_SIZE, borderRadius: 2,
                      background: cellColor(c),
                      cursor: c?.hasData && c?.inYear ? 'pointer' : 'default',
                      border: c?.dateStr === todayStr ? '1px solid var(--theme-color)' : '1px solid transparent',
                      flexShrink: 0,
                    }}
                    title={c?.inYear ? `${c.dateStr}: ${c.net > 0 ? '+' : ''}${c.net}` : ''}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: '0.65em', color: '#555' }}>
        <span>Meno</span>
        {['#2a2a2a', '#66bb6a', '#43a047', '#2e7d32', '#1b5e20'].map((c, i) => (
          <div key={i} style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />
        ))}
        <span>Di più</span>
        <span style={{ marginLeft: 10, color: 'rgba(239,83,80,0.8)' }}>■ Negativo</span>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <StatCard label="Giorni con dati" value={`${daysWithData}`} />
        {bestCell && (
          <StatCard label="Giorno migliore" value={`+${bestCell.net} (${bestCell.day}/${bestCell.month + 1})`} color="var(--success)" />
        )}
      </div>

      {/* Day popup */}
      {popup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPopup(null)}>
          <div style={{ background: 'var(--card-solid)', borderRadius: 16, padding: 20, minWidth: 220, border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, color: 'var(--theme-color)', marginBottom: 12, fontSize: '1em' }}>{popup.dateStr}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85em' }}>
              <div>Punteggio netto: <strong style={{ color: popup.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{popup.net > 0 ? '+' : ''}{popup.net}</strong></div>
              <div>Abitudini ✅: <strong>{popup.completed}</strong> &nbsp; ❌: <strong>{popup.failed}</strong></div>
              {popup.mood && <div>Mood: <strong>{['', '😞', '😕', '😐', '😊', '🤩'][popup.mood]}</strong></div>}
            </div>
            <button className="btn-icon" style={{ marginTop: 14, width: '100%' }} onClick={() => setPopup(null)}>Chiudi</button>
          </div>
        </div>
      )}
    </>
  )
}

/* ---- SEZIONE MOMENTUM ---- */
function MomentumSection({ userData }) {
  const [days, setDays] = useState(30)
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const history = buildMomentumScoreHistory(userData, days)

  const current = calcMomentumScore(userData)
  const allHistory = buildMomentumScoreHistory(userData, 90)
  const bestEntry = allHistory.reduce((best, h) => h.score > best.score ? h : best, { score: 0, label: '-' })

  useEffect(() => {
    if (!canvasRef.current || history.length === 0) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: history.map(h => h.label),
        datasets: [{
          label: 'Momentum',
          data: history.map(h => h.score),
          borderColor: 'var(--theme-color)',
          backgroundColor: 'var(--theme-glow)',
          fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 100, grid: { color: '#2a2a2a' }, ticks: { color: '#666' } },
          x: { grid: { display: false }, ticks: { color: '#666', maxTicksLimit: 8 } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [days, userData])

  const { score, trend7, avgPrev7, streak, daysAboveAvg, consistency, avg30 } = current
  const labelInfo = score >= 81 ? { text: 'In fiamme 🔥', color: 'var(--success)' }
    : score >= 61 ? { text: 'In crescita 📈', color: '#69f0ae' }
    : score >= 31 ? { text: 'Stabile 📊', color: '#EF9F27' }
    : { text: 'In difficoltà 📉', color: 'var(--danger)' }

  return (
    <>
      <SectionTitle>Momentum Score</SectionTitle>

      {/* Current score display */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: '3em', fontWeight: 900, color: labelInfo.color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: '0.9em', color: labelInfo.color, marginTop: 4, fontWeight: 600 }}>{labelInfo.text}</div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginTop: 12 }}>
          <div style={{ height: '100%', width: `${score}%`, background: labelInfo.color, borderRadius: 4, transition: 'width 0.6s ease', boxShadow: score >= 81 ? `0 0 8px ${labelInfo.color}` : 'none' }} />
        </div>
      </div>

      {/* Factor breakdown */}
      <SectionTitle>Dettaglio Fattori</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Trend 7gg vs prev 7gg', value: `${trend7 > 0 ? '+' : ''}${trend7} vs ${avgPrev7 > 0 ? '+' : ''}${avgPrev7}/gg`, weight: '35%', contribution: Math.round(Math.min(trend7 / (avgPrev7 || 1), 2) * 35 / 2) },
          { label: 'Streak attuale', value: `${streak} giorni`, weight: '30%', contribution: Math.round(Math.min(streak / 30, 1) * 30) },
          { label: 'Giorni sopra media (7gg)', value: `${daysAboveAvg}/7`, weight: '20%', contribution: Math.round((daysAboveAvg / 7) * 20) },
          { label: 'Consistenza (30gg)', value: `${consistency}%`, weight: '15%', contribution: Math.round((consistency / 100) * 15) },
        ].map(f => (
          <div key={f.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.8em', color: '#888' }}>{f.label} <span style={{ color: '#555', fontSize: '0.8em' }}>({f.weight})</span></span>
              <span style={{ fontSize: '0.82em', color: 'var(--text)', fontWeight: 600 }}>{f.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Historical max */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: '0.85em' }}>
        🏆 Momentum massimo storico: <strong style={{ color: 'var(--theme-color)' }}>{bestEntry.score}</strong> ({bestEntry.label})
      </div>

      {/* Chart */}
      <SectionTitle>Storico Momentum</SectionTitle>
      <div className="switch-group" style={{ marginBottom: 12 }}>
        {[14, 30, 60].map(d => (
          <div key={d} className={`switch-opt${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>{d} GG</div>
        ))}
      </div>
      <div style={{ height: 180, position: 'relative' }}><canvas ref={canvasRef} /></div>
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

      {/* TimeSlot breakdown */}
      <TimeSlotBreakdown userData={userData} days={days} />

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

function TimeSlotBreakdown({ userData, days }) {
  const stats = buildTimeSlotStats(userData, days)
  const withData = stats.filter(s => s.total > 0)
  if (withData.length === 0) return null
  const best = withData.reduce((a, b) => b.winRate > a.winRate ? b : a)
  return (
    <>
      <SectionTitle style={{ marginTop: 20 }}>Fasce Orarie</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {stats.map(s => (
          <div key={s.slot} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.88em', fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontSize: '0.85em', color: s.winRate >= 70 ? 'var(--success)' : s.winRate >= 40 ? '#EF9F27' : 'var(--danger)', fontWeight: 700 }}>
                {s.total > 0 ? `${s.winRate}%` : '-'}
              </span>
            </div>
            {s.total > 0 && (
              <>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.winRate}%`, background: s.winRate >= 70 ? 'var(--success)' : s.winRate >= 40 ? '#EF9F27' : 'var(--danger)', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: '0.65em', color: '#555', marginTop: 4 }}>{s.done}/{s.total} • {s.pts} pt</div>
              </>
            )}
          </div>
        ))}
      </div>
      {withData.length > 1 && (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px', fontSize: '0.82em', marginBottom: 16 }}>
          ⚡ Fascia più produttiva: <strong style={{ color: 'var(--theme-color)' }}>{best.label}</strong> ({best.winRate}% win rate)
        </div>
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

/* ---- SEZIONE TASK ---- */
const PRIO_COLORS = { high: '#e53935', medium: '#ff7043', low: '#42a5f5' }
const PRIO_LABELS = { high: 'Alta', medium: 'Media', low: 'Bassa' }

function TaskStatsSection({ userData }) {
  const tasks = userData?.tasks || []
  const [months, setMonths] = useState(6)

  const completed = tasks.filter(t => t.status === 'completed')
  const expired = tasks.filter(t => t.status === 'expired')
  const total = completed.length + expired.length
  const winRate = total > 0 ? Math.round(completed.length / total * 100) : null

  const avgDays = (() => {
    const valid = completed.filter(t => t.completedAt && t.createdAt)
    if (!valid.length) return null
    return (valid.reduce((s, t) => s + Math.max(0, (new Date(t.completedAt) - new Date(t.createdAt)) / 86400000), 0) / valid.length).toFixed(1)
  })()

  const totalPenalties = expired.filter(t => t.penaltyApplied).reduce((s, t) => s + (parseInt(t.penalty) || 0), 0)
  const totalRewards = completed.reduce((s, t) => s + (parseInt(t.reward) || 0), 0)

  const monthlyData = (() => {
    const now = new Date()
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return {
        label: MONTH_NAMES[d.getMonth()],
        completedCount: completed.filter(t => t.completedAt?.startsWith(key)).length,
        expiredCount: expired.filter(t => t.expiredAt?.startsWith(key)).length,
      }
    })
  })()

  const priorityStats = ['high', 'medium', 'low'].map(p => {
    const comp = completed.filter(t => (t.priority || 'medium') === p)
    const exp = expired.filter(t => (t.priority || 'medium') === p)
    const wr = (comp.length + exp.length) > 0 ? Math.round(comp.length / (comp.length + exp.length) * 100) : null
    const valid = comp.filter(t => t.completedAt && t.createdAt)
    const avg = valid.length > 0 ? (valid.reduce((s, t) => s + Math.max(0, (new Date(t.completedAt) - new Date(t.createdAt)) / 86400000), 0) / valid.length).toFixed(1) : null
    return { p, comp: comp.length, exp: exp.length, wr, avg }
  })

  const now = new Date()
  const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastD = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastKey = `${lastD.getFullYear()}-${String(lastD.getMonth() + 1).padStart(2, '0')}`
  const thisComp = completed.filter(t => t.completedAt?.startsWith(thisKey)).length
  const lastComp = completed.filter(t => t.completedAt?.startsWith(lastKey)).length

  if (tasks.length === 0) return (
    <div className="empty-state" style={{ marginTop: 40 }}>
      <div style={{ fontSize: '2em', marginBottom: 8 }}>📋</div>
      <div>Nessuna task registrata</div>
    </div>
  )

  return (
    <div style={{ padding: '0 16px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16, marginBottom: 20 }}>
        {[
          { v: completed.length, l: 'Completate totali', c: 'var(--success)' },
          { v: expired.length, l: 'Scadute totali', c: 'var(--danger)' },
          { v: winRate !== null ? `${winRate}%` : '—', l: 'Win rate', c: winRate >= 70 ? 'var(--success)' : winRate >= 40 ? '#EF9F27' : 'var(--danger)' },
          { v: avgDays !== null ? `${avgDays}gg` : '—', l: 'Media giorni', c: 'var(--theme-color)' },
          { v: totalPenalties > 0 ? `-${totalPenalties}pt` : '0', l: 'Penalità totali', c: 'var(--danger)' },
          { v: `+${totalRewards}pt`, l: 'Reward totali', c: 'var(--success)' },
        ].map(({ v, l, c }) => (
          <div key={l} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5em', fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: '0.65em', color: '#666', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, fontSize: '0.82em', marginBottom: 16 }}>
        Questo mese: <strong style={{ color: 'var(--theme-color)' }}>{thisComp} completate</strong>{' '}
        {thisComp >= lastComp
          ? <span style={{ color: 'var(--success)' }}>▲ meglio del mese scorso ({lastComp})</span>
          : <span style={{ color: 'var(--danger)' }}>▼ peggio del mese scorso ({lastComp})</span>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[3, 6, 12].map(m => (
          <button key={m} onClick={() => setMonths(m)} style={{
            padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontSize: '0.7em', border: 'none',
            background: months === m ? 'var(--theme-glow)' : 'rgba(255,255,255,0.05)',
            color: months === m ? 'var(--theme-color)' : '#666',
            outline: `1px solid ${months === m ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`,
          }}>{m} mesi</button>
        ))}
      </div>
      <TaskMonthlyChart data={monthlyData} />

      <div style={{ fontSize: '0.65em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, margin: '16px 0 8px', fontWeight: 600 }}>Breakdown per priorità</div>
      {priorityStats.map(({ p, comp, exp: expCount, wr, avg }) => (
        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
          <span style={{ fontSize: '0.82em', color: PRIO_COLORS[p], fontWeight: 700, minWidth: 44 }}>{PRIO_LABELS[p]}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 10, fontSize: '0.72em' }}>
              <span style={{ color: 'var(--success)' }}>✓ {comp}</span>
              <span style={{ color: 'var(--danger)' }}>✗ {expCount}</span>
              {wr !== null && <span style={{ color: wr >= 70 ? 'var(--success)' : wr >= 40 ? '#EF9F27' : 'var(--danger)', fontWeight: 700 }}>Win {wr}%</span>}
            </div>
            {avg && <div style={{ fontSize: '0.68em', color: '#555', marginTop: 2 }}>Media: {avg}gg per completare</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

function TaskMonthlyChart({ data }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [
          { label: 'Completate', data: data.map(d => d.completedCount), backgroundColor: 'rgba(76,175,80,0.55)', borderColor: '#4caf50', borderWidth: 1, borderRadius: 3 },
          { label: 'Scadute', data: data.map(d => d.expiredCount), backgroundColor: 'rgba(229,57,53,0.45)', borderColor: '#e53935', borderWidth: 1, borderRadius: 3 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: '#888', boxWidth: 10, font: { size: 10 } } } },
        scales: {
          y: { grid: { color: '#2a2a2a' }, ticks: { color: '#666', stepSize: 1 }, beginAtZero: true },
          x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 } } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [data])
  return <div style={{ height: 150, position: 'relative' }}><canvas ref={canvasRef} /></div>
}
