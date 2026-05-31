import { useEffect, useRef } from 'react'
import { Chart } from '../lib/chartSetup'
import { useApp } from '../lib/store'
import { buildHabitStats, buildNumericTimeline, calcQualityScore, qualityLabel } from '../lib/statsLogic'
import { parseEntry, getItemValueAtDate } from '../lib/habitLogic'

const DOW_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

export default function SingleHabitView() {
  const { state, actions } = useApp()
  const { modal, modalPayload, globalData } = state

  if (modal !== 'singleHabit' || !globalData) return null

  const habitId = modalPayload
  const habit = globalData.habits?.find(h => h.id === habitId || h.name === habitId)
  if (!habit) return null

  const stats = buildHabitStats(habit, globalData)
  const quality = calcQualityScore(habit, globalData)
  const qLabel = qualityLabel(quality)
  const stableId = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')
  const tagsMap = {}
  ;(globalData.tags || []).forEach(t => { tagsMap[t.id] = t })
  const tag = tagsMap[habit.tagId]
  const tagColor = tag?.color || 'var(--theme-color)'

  // Collect last 10 notes
  const notes = Object.keys(globalData.dailyLogs || {})
    .sort((a, b) => b.localeCompare(a))
    .reduce((acc, dateStr) => {
      if (acc.length >= 10) return acc
      const entry = parseEntry(globalData.dailyLogs[dateStr])
      const note = entry.habitNotes?.[stableId]
      if (note) acc.push({ dateStr, note })
      return acc
    }, [])

  // Build change history for reward field
  const changes = [...(habit.changes || [])].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.1em', color: 'var(--theme-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {habit.name}
        </h1>
        {/* Quality badge */}
        <div style={{
          background: qLabel.color + '22', border: `1px solid ${qLabel.color}55`,
          borderRadius: 20, padding: '4px 10px', fontSize: '0.72em', fontWeight: 700,
          color: qLabel.color, flexShrink: 0,
        }}>
          {quality}/100
        </div>
      </div>

      <div className="single-habit-body">
        {/* "Why" card */}
        {habit.why ? (
          <div style={{
            background: `${tagColor}18`, border: `1px solid ${tagColor}33`,
            borderRadius: 14, padding: '12px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: '1.3em', flexShrink: 0 }}>💡</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.65em', color: tagColor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>Il tuo perché</div>
              <div style={{ fontSize: '0.88em', color: 'var(--text-sec)', fontStyle: 'italic', lineHeight: 1.5 }}>
                "{habit.why}"
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => actions.openModal('edit', { id: habit.id, type: 'habit' })}
            style={{
              width: '100%', padding: '10px 14px', marginBottom: 20,
              background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 14, cursor: 'pointer', color: '#555', fontSize: '0.85em',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span>💡</span> Aggiungi il tuo perché
          </button>
        )}

        {/* Quality interpretation */}
        <div style={{
          background: `${qLabel.color}11`, border: `1px solid ${qLabel.color}33`,
          borderRadius: 10, padding: '8px 14px', marginBottom: 20,
          fontSize: '0.78em', color: qLabel.color, fontWeight: 600,
        }}>
          Qualità {quality}/100 — {qLabel.text}
        </div>

        {/* KPI grid */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <KpiBox value={stats.totalDone} label="Volte Fatto" color="var(--success)" />
          <KpiBox value={`${stats.winRate}%`} label="Win Rate" color={stats.winRate >= 80 ? 'var(--success)' : '#ffca28'} />
          <KpiBox label="Best Streak" color="#ff9800"
            value={<span>{stats.bestStreak} <span style={{ fontSize: '0.6em' }}>🔥</span></span>} />
          <KpiBox value={`${stats.currentStreak} 🔥`} label="Streak Attuale" color={stats.currentStreak > 0 ? '#ff9800' : '#555'} />
          <KpiBox value={stats.totalPoints} label="Punti Generati" color="var(--theme-color)" />
          <KpiBox value={`${stats.weightPct}%`} label="% sul Totale" color="#d05ce3" />
        </div>

        <InfoRow icon="📅" label="Completata più spesso di" value={stats.bestDOWLabel} />

        <SectionLabel>Ultimi 10 Giorni</SectionLabel>
        <div className="trend-dots" style={{ marginBottom: 20 }}>
          {stats.heatmap90.slice(-10).map(({ key, status }) => (
            <div key={key} className={`trend-dot st-${status}`} title={key} />
          ))}
        </div>

        <SectionLabel>Punti per Settimana (ultime 12)</SectionLabel>
        <WeeklyBarChart data={stats.last12Weeks} />

        <SectionLabel>Heatmap 90 Giorni</SectionLabel>
        <div className="heatmap-grid" style={{ marginBottom: 24 }}>
          {stats.heatmap90.map(({ key, status }) => (
            <div key={key} className={`heat-box st-${status}`} title={key} />
          ))}
        </div>

        {/* Numeric stats */}
        {habit.numericType && habit.numericConfig && (
          <NumericStats habit={habit} globalData={globalData} />
        )}

        {/* Notes */}
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

        {/* ── Feature 7: Change History ─────────────────────────────────────── */}
        <SectionLabel>Storico Modifiche</SectionLabel>
        {changes.length <= 1 ? (
          <div style={{ fontSize: '0.82em', color: '#444', padding: '8px 0', marginBottom: 24 }}>
            Nessuna modifica — abitudine invariata dalla creazione
          </div>
        ) : (
          <>
            {/* Reward timeline chart if reward changed */}
            {changes.some((c, i) => i > 0 && c.reward !== changes[i - 1]?.reward) && (
              <RewardTimelineChart changes={changes} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
              {changes.map((ch, i) => {
                const prev = changes[i + 1]
                const diffs = []
                if (prev) {
                  if (ch.reward !== prev.reward) diffs.push(`Reward: ${prev.reward}pt → ${ch.reward}pt`)
                  if (ch.penalty !== prev.penalty) diffs.push(`Penalità: ${prev.penalty}pt → ${ch.penalty}pt`)
                  if ((ch.rewardMin || 0) !== (prev.rewardMin || 0)) diffs.push(`Min: ${prev.rewardMin || 0}pt → ${ch.rewardMin || 0}pt`)
                  if (ch.description !== prev.description) diffs.push('Descrizione aggiornata')
                }
                const isLatest = i === 0

                return (
                  <div key={i} style={{
                    background: isLatest ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isLatest ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 10, padding: '10px 14px',
                    borderLeft: isLatest ? `3px solid var(--theme-color)` : undefined,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize: '0.72em', color: isLatest ? 'var(--theme-color)' : '#666' }}>
                        {ch.date.split('-').reverse().join('/')}
                        {isLatest && <span style={{ marginLeft: 6, fontSize: '0.85em' }}>· più recente</span>}
                      </div>
                    </div>
                    {ch.note && <div style={{ fontSize: '0.78em', color: '#888', marginBottom: 4 }}>{ch.note}</div>}
                    {diffs.map((d, j) => (
                      <div key={j} style={{ fontSize: '0.75em', color: 'var(--text-sec)', padding: '1px 0' }}>• {d}</div>
                    ))}
                    {diffs.length === 0 && !ch.note && (
                      <div style={{ fontSize: '0.75em', color: '#444' }}>Creazione iniziale — Reward: {ch.reward}pt, Penalità: {ch.penalty}pt</div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RewardTimelineChart({ changes }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const sorted = [...changes].sort((a, b) => a.date.localeCompare(b.date))

  useEffect(() => {
    if (!canvasRef.current || sorted.length < 2) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: sorted.map(c => c.date.split('-').reverse().join('/')),
        datasets: [{
          data: sorted.map(c => c.reward || 0),
          borderColor: 'var(--theme-color)', backgroundColor: 'var(--theme-glow)',
          fill: true, tension: 0, pointRadius: 5, borderWidth: 2, stepped: true,
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
  }, [changes])

  if (sorted.length < 2) return null
  return (
    <>
      <SectionLabel>Evoluzione Reward nel Tempo</SectionLabel>
      <div style={{ height: 100, marginBottom: 12, position: 'relative' }}><canvas ref={canvasRef} /></div>
    </>
  )
}

function NumericStats({ habit, globalData }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const timeline = buildNumericTimeline(habit, globalData, 30)
  const withData = timeline.filter(d => d.value !== null)
  const cfg = habit.numericConfig
  const threshold = cfg?.threshold || 0

  const values = withData.map(d => d.value)
  const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) : 0
  const max = values.length ? Math.max(...values) : 0
  const min = values.length ? Math.min(...values) : 0
  const aboveThreshold = values.filter(v => v >= threshold).length

  useEffect(() => {
    if (!canvasRef.current || withData.length < 2) return
    if (chartRef.current) chartRef.current.destroy()
    const colors = withData.map(d => d.value >= threshold ? 'rgba(76,175,80,0.7)' : 'rgba(239,83,80,0.6)')
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: withData.map(d => d.label),
        datasets: [
          { label: cfg?.unit || 'valore', data: withData.map(d => d.value), backgroundColor: colors, borderRadius: 3 },
          threshold > 0 ? { label: 'Soglia', data: withData.map(() => threshold), type: 'line', borderColor: '#EF9F27', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false } : null,
        ].filter(Boolean),
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: '#aaa', boxWidth: 10, font: { size: 10 } } } },
        scales: {
          y: { grid: { color: '#2a2a2a' }, ticks: { color: '#666', font: { size: 10 } }, beginAtZero: true },
          x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 }, maxTicksLimit: 10 } },
        },
      },
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [habit, globalData])

  if (withData.length === 0) return null
  return (
    <>
      <SectionLabel>Valori Numerici (30 giorni)</SectionLabel>
      <div style={{ height: 140, marginBottom: 16, position: 'relative' }}><canvas ref={canvasRef} /></div>
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <KpiBox value={`${avg.toFixed(1)} ${cfg?.unit || ''}`} label="Media" color="var(--theme-color)" />
        <KpiBox value={`${max} ${cfg?.unit || ''}`} label="Massimo" color="var(--success)" />
        <KpiBox value={`${min} ${cfg?.unit || ''}`} label="Minimo" color="#888" />
        {threshold > 0 && <KpiBox value={`${aboveThreshold}/${values.length}`} label="Sopra soglia" color={aboveThreshold >= values.length - aboveThreshold ? 'var(--success)' : 'var(--danger)'} />}
      </div>
    </>
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
        datasets: [{ data: data.map(d => d.pts), backgroundColor: data.map(d => d.pts > 0 ? 'rgba(76,175,80,0.7)' : 'rgba(255,255,255,0.1)'), borderRadius: 4 }],
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
