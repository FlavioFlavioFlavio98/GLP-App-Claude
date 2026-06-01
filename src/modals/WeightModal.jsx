import { useEffect, useRef, useState, useCallback } from 'react'
import { useApp } from '../lib/store'
import { Chart } from '../lib/chartSetup'
import { toDateString } from '../lib/habitLogic'

const today = () => toDateString(new Date())

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFilteredEntries(log, days) {
  const entries = Object.entries(log || {})
    .map(([date, w]) => ({ date, weight: w }))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (days === 'all' || entries.length === 0) return entries
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days + 1)
  const cutStr = toDateString(cutoff)
  return entries.filter(e => e.date >= cutStr)
}

function movingAvg(entries, window = 7) {
  return entries.map((e, i) => {
    const slice = entries.slice(Math.max(0, i - window + 1), i + 1)
    return { date: e.date, avg: Math.round((slice.reduce((s, x) => s + x.weight, 0) / slice.length) * 10) / 10 }
  })
}

function calcStats(entries) {
  if (entries.length === 0) return null
  const weights = entries.map(e => e.weight)
  const minW = Math.min(...weights), maxW = Math.max(...weights)
  const minEntry = entries.find(e => e.weight === minW)
  const maxEntry = entries.find(e => e.weight === maxW)
  const avg = Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10
  const variation = Math.round((entries[entries.length - 1].weight - entries[0].weight) * 10) / 10

  // Weekly trend: linear regression slope * 7
  let weeklyTrend = null
  if (entries.length >= 2) {
    const n = entries.length
    const x0 = new Date(entries[0].date).getTime()
    const xs = entries.map(e => (new Date(e.date).getTime() - x0) / 86400000)
    const ys = entries.map(e => e.weight)
    const xMean = xs.reduce((a, b) => a + b, 0) / n
    const yMean = ys.reduce((a, b) => a + b, 0) / n
    const num = xs.reduce((acc, x, i) => acc + (x - xMean) * (ys[i] - yMean), 0)
    const den = xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0)
    const slope = den > 0 ? num / den : 0
    weeklyTrend = Math.round(slope * 7 * 10) / 10
  }

  return {
    current: entries[entries.length - 1],
    min: { weight: minW, date: minEntry.date },
    max: { weight: maxW, date: maxEntry.date },
    avg, variation, weeklyTrend,
  }
}

function fmtDate(dateStr) {
  if (!dateStr) return '-'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WeightModal() {
  const { state, actions } = useApp()
  const { modal, authUserId } = state

  if (modal !== 'weight' || authUserId !== 'flavio') return null
  return <WeightModalInner actions={actions} />
}

function WeightModalInner({ actions }) {
  const [log, setLog] = useState({})        // { dateStr: kg }
  const [goal, setGoal] = useState(null)    // number | null
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)  // 7 | 30 | 90 | 'all'

  const [inputDate, setInputDate] = useState(today())
  const [inputVal, setInputVal] = useState('')
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [saving, setSaving] = useState(false)

  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  // Load weight data on mount
  useEffect(() => {
    setLoading(true)
    actions.loadWeightData().then(data => {
      setLog(data.log || {})
      setGoal(data.goal ?? null)
      setLoading(false)
    })
  }, [])

  // Pre-fill input when date changes
  useEffect(() => {
    if (log[inputDate] !== undefined) {
      setInputVal(String(log[inputDate]))
    } else {
      setInputVal('')
    }
  }, [inputDate, log])

  const entries = getFilteredEntries(log, period)
  const stats = calcStats(entries)
  const maEntries = movingAvg(entries, 7)
  const allEntries = getFilteredEntries(log, 'all')

  // Chart
  useEffect(() => {
    if (!canvasRef.current || entries.length === 0) {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
      return
    }
    if (chartRef.current) chartRef.current.destroy()

    const weights = entries.map(e => e.weight)
    const minW = Math.min(...weights), maxW = Math.max(...weights)
    const yMin = Math.max(0, minW - 2), yMax = maxW + 2

    const datasets = [
      {
        label: 'Peso (kg)',
        data: entries.map(e => e.weight),
        borderColor: '#ffca28',
        backgroundColor: 'rgba(255,202,40,0.12)',
        borderWidth: 2, pointRadius: 4, pointHoverRadius: 7,
        tension: 0.3, fill: true,
      },
      {
        label: 'Media mobile 7gg',
        data: maEntries.map(e => e.avg),
        borderColor: 'rgba(255,202,40,0.45)',
        borderDash: [5, 4],
        borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: false,
      },
    ]

    if (goal !== null) {
      datasets.push({
        label: `Obiettivo (${goal} kg)`,
        data: entries.map(() => goal),
        borderColor: 'var(--theme-color)',
        borderDash: [6, 4],
        borderWidth: 1.5, pointRadius: 0, fill: false,
      })
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels: entries.map(e => fmtDate(e.date)), datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#aaa', boxWidth: 12, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              title: ctx => entries[ctx[0].dataIndex]?.date || '',
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} kg`,
            },
          },
        },
        scales: {
          y: { min: yMin, max: yMax, grid: { color: '#2a2a2a' }, ticks: { color: '#888', callback: v => `${v} kg` } },
          x: { grid: { display: false }, ticks: { color: '#888', maxTicksLimit: 10 } },
        },
      },
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [entries, goal, period])

  async function handleSave() {
    if (!inputVal || isNaN(parseFloat(inputVal))) {
      actions.showToast('Inserisci un valore valido', '⚠️'); return
    }
    setSaving(true)
    await actions.saveWeight(inputDate, inputVal)
    // Reload
    const data = await actions.loadWeightData()
    setLog(data.log || {}); setGoal(data.goal ?? null)
    setSaving(false)
  }

  async function handleSaveGoal() {
    await actions.saveWeightGoal(goalInput !== '' ? goalInput : null)
    const data = await actions.loadWeightData()
    setLog(data.log || {}); setGoal(data.goal ?? null)
    setEditingGoal(false); setGoalInput('')
  }

  async function handleDeleteGoal() {
    if (!window.confirm('Rimuovere obiettivo peso?')) return
    await actions.saveWeightGoal(null)
    setGoal(null)
  }

  // Goal progress
  const lastWeight = allEntries.length > 0 ? allEntries[allEntries.length - 1].weight : null
  const goalReached = goal !== null && lastWeight !== null && lastWeight <= goal
  const goalDiff = goal !== null && lastWeight !== null ? Math.round((lastWeight - goal) * 10) / 10 : null
  const startWeight = allEntries.length > 0 ? allEntries[0].weight : null
  const goalProgress = goal !== null && startWeight !== null && lastWeight !== null && startWeight !== goal
    ? Math.max(0, Math.min(100, Math.round((startWeight - lastWeight) / (startWeight - goal) * 100)))
    : 0

  const PERIOD_OPTS = [
    { v: 7, label: '7 GG' }, { v: 30, label: '30 GG' },
    { v: 90, label: '90 GG' }, { v: 'all', label: 'Tutto' },
  ]

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.2em', color: 'var(--theme-color)', flex: 1 }}>⚖️ Tracciamento Peso</h1>
      </div>

      <div className="single-habit-body">
        {loading ? (
          <div className="empty-state">Caricamento...</div>
        ) : (
          <>
            {/* ── INPUT ── */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 12 }}>
                Registra Peso
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <input
                  type="date"
                  value={inputDate}
                  max={today()}
                  onChange={e => setInputDate(e.target.value)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: '0.9em' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="es. 78.5"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: '1.1em', fontWeight: 700 }}
                />
                <span style={{ color: '#888', fontSize: '0.9em', flexShrink: 0 }}>kg</span>
                <button
                  className="btn-main"
                  style={{ flexShrink: 0, padding: '10px 18px', margin: 0 }}
                  onClick={handleSave}
                  disabled={saving || !inputVal}
                >
                  {saving ? '...' : log[inputDate] !== undefined ? '✏️ Aggiorna' : '💾 Salva'}
                </button>
              </div>
              {log[inputDate] !== undefined && (
                <div style={{ fontSize: '0.72em', color: '#EF9F27', marginTop: 6 }}>
                  ⚠️ Stai modificando il peso del {fmtDate(inputDate)} (attuale: {log[inputDate]} kg)
                </div>
              )}
            </div>

            {/* ── GRAFICO ── */}
            {entries.length === 0 ? (
              <div className="empty-state">Nessun dato nel periodo selezionato</div>
            ) : (
              <>
                <div className="switch-group" style={{ marginBottom: 12 }}>
                  {PERIOD_OPTS.map(opt => (
                    <div key={opt.v} className={`switch-opt${period === opt.v ? ' active' : ''}`} onClick={() => setPeriod(opt.v)}>
                      {opt.label}
                    </div>
                  ))}
                </div>
                <div style={{ height: 220, marginBottom: 20, position: 'relative' }}>
                  <canvas ref={canvasRef} />
                </div>
              </>
            )}

            {/* ── STATISTICHE ── */}
            {stats && (
              <>
                <div style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
                  Statistiche ({period === 'all' ? 'tutti i dati' : `ultimi ${period} giorni`})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  <StatCard
                    label="Peso attuale"
                    value={`${stats.current.weight} kg`}
                    sub={fmtDate(stats.current.date)}
                    color="var(--theme-color)"
                  />
                  <StatCard
                    label="Peso minimo"
                    value={`${stats.min.weight} kg`}
                    sub={fmtDate(stats.min.date)}
                    color="var(--success)"
                  />
                  <StatCard
                    label="Peso massimo"
                    value={`${stats.max.weight} kg`}
                    sub={fmtDate(stats.max.date)}
                    color="var(--danger)"
                  />
                  <StatCard
                    label="Media periodo"
                    value={`${stats.avg} kg`}
                    color="#aaa"
                  />
                  <StatCard
                    label="Variazione totale"
                    value={`${stats.variation > 0 ? '+' : ''}${stats.variation} kg`}
                    color={stats.variation < 0 ? 'var(--success)' : stats.variation > 0 ? 'var(--danger)' : '#aaa'}
                  />
                  <StatCard
                    label="Trend settimanale"
                    value={stats.weeklyTrend !== null ? `${stats.weeklyTrend > 0 ? '+' : ''}${stats.weeklyTrend} kg/sett` : '-'}
                    color={stats.weeklyTrend !== null && stats.weeklyTrend < 0 ? 'var(--success)' : stats.weeklyTrend > 0 ? 'var(--danger)' : '#aaa'}
                  />
                </div>
              </>
            )}

            {/* ── OBIETTIVO ── */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 12 }}>
                Obiettivo Peso
              </div>

              {goal === null && !editingGoal && (
                <button className="btn-sec" style={{ width: '100%' }} onClick={() => { setEditingGoal(true); setGoalInput('') }}>
                  + Imposta obiettivo
                </button>
              )}

              {editingGoal && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number" step="0.1" inputMode="decimal"
                    placeholder="es. 75.0"
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    autoFocus
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: '1em' }}
                  />
                  <span style={{ color: '#888' }}>kg</span>
                  <button className="btn-main" style={{ margin: 0, padding: '8px 14px' }} onClick={handleSaveGoal}>Salva</button>
                  <button className="btn-icon" onClick={() => { setEditingGoal(false); setGoalInput('') }}>
                    <span className="material-icons-round">close</span>
                  </button>
                </div>
              )}

              {goal !== null && !editingGoal && (
                <>
                  {goalReached ? (
                    <div style={{ textAlign: 'center', padding: 12 }}>
                      <div style={{ fontSize: '2em', marginBottom: 6 }}>🎉</div>
                      <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1.05em' }}>Obiettivo raggiunto!</div>
                      <div style={{ fontSize: '0.8em', color: '#888', marginTop: 4 }}>Target: {goal} kg — Attuale: {lastWeight} kg</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', marginBottom: 8 }}>
                        <span style={{ color: '#888' }}>Target: <strong style={{ color: 'var(--theme-color)' }}>{goal} kg</strong></span>
                        {goalDiff !== null && (
                          <span style={{ color: goalDiff <= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                            {goalDiff > 0 ? `Mancano ${goalDiff} kg` : 'Obiettivo superato!'}
                          </span>
                        )}
                      </div>
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{ height: '100%', width: `${goalProgress}%`, background: 'var(--theme-color)', borderRadius: 4, transition: 'width 0.5s ease' }} />
                      </div>
                      <div style={{ fontSize: '0.68em', color: '#555', textAlign: 'right', marginBottom: 10 }}>{goalProgress}% completato</div>
                    </>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn-sec" style={{ flex: 1 }} onClick={() => { setEditingGoal(true); setGoalInput(String(goal)) }}>
                      <span className="material-icons-round" style={{ fontSize: 16 }}>edit</span> Modifica
                    </button>
                    <button className="btn-icon" onClick={handleDeleteGoal} title="Rimuovi obiettivo">
                      <span className="material-icons-round" style={{ fontSize: 18 }}>delete</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ── STORICO ── */}
            {allEntries.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
                  Storico ({allEntries.length} misurazioni)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                  {[...allEntries].reverse().map(e => (
                    <div
                      key={e.date}
                      onClick={() => { setInputDate(e.date); setInputVal(String(e.weight)) }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: '0.82em', color: '#888' }}>{e.date}</span>
                      <span style={{ fontWeight: 700, color: 'var(--theme-color)', fontSize: '0.95em' }}>{e.weight} kg</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.25em', fontWeight: 800, color: color || 'var(--theme-color)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.68em', color: '#555', marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: '0.62em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{label}</div>
    </div>
  )
}
