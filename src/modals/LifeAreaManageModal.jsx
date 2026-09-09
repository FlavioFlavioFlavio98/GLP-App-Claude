import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { Chart } from '../lib/chartSetup'
import { computeLifeAreaStats } from '../lib/lifeAreaStats'

const COLOR_OPTIONS = ['#ffca28', '#4caf50', '#2196f3', '#7c4dff', '#ef5350', '#26c6da', '#ff7043', '#ec407a']

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>{children}</div>
)

const StatCard = ({ label, value, sub, color }) => (
  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
    <div style={{ fontSize: '1.3em', fontWeight: 800, color: color || 'var(--theme-color)' }}>{value}</div>
    {sub && <div style={{ fontSize: '0.6em', color: '#555', marginTop: 2 }}>{sub}</div>}
    <div style={{ fontSize: '0.58em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{label}</div>
  </div>
)

export default function LifeAreaManageModal() {
  const { state, actions } = useApp()
  const { modal, allUsersData, authUserId } = state

  const [tab, setTab] = useState('stats') // 'stats' | 'manage'
  const [showAddForm, setShowAddForm] = useState(false)
  const [editArea, setEditArea] = useState(null)
  const [form, setForm] = useState({ name: '', emoji: '⭐', color: COLOR_OPTIONS[0], weeklyTargetMin: 0 })
  const [saving, setSaving] = useState(false)
  const doughnutCanvasRef = useRef(null)
  const doughnutChartRef = useRef(null)
  const barCanvasRef = useRef(null)
  const barChartRef = useRef(null)

  const gd = allUsersData?.flavio
  const lifeAreas = gd?.lifeAreas || []
  const activeAreas = lifeAreas.filter(a => a.active !== false)
  const lifeAreaLog = gd?.lifeAreaLog || {}
  const stats = computeLifeAreaStats(lifeAreaLog, lifeAreas)

  useEffect(() => {
    if (modal !== 'lifeAreaManage' || tab !== 'stats' || !doughnutCanvasRef.current) return
    if (doughnutChartRef.current) doughnutChartRef.current.destroy()
    const withTime = stats.byArea.filter(a => a.weekMin > 0)
    if (withTime.length > 0) {
      doughnutChartRef.current = new Chart(doughnutCanvasRef.current, {
        type: 'doughnut',
        data: {
          labels: withTime.map(a => `${a.emoji} ${a.name}`),
          datasets: [{ data: withTime.map(a => a.weekMin), backgroundColor: withTime.map(a => a.color || '#ffca28'), borderWidth: 0 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } },
      })
    }
    return () => { if (doughnutChartRef.current) { doughnutChartRef.current.destroy(); doughnutChartRef.current = null } }
  }, [modal, tab, lifeAreaLog, lifeAreas]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (modal !== 'lifeAreaManage' || tab !== 'stats' || !barCanvasRef.current) return
    if (barChartRef.current) barChartRef.current.destroy()
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim() || '#ffca28'
    barChartRef.current = new Chart(barCanvasRef.current, {
      type: 'bar',
      data: {
        labels: stats.dailyTotals.map(d => fmtDate(d.date)),
        datasets: [{ data: stats.dailyTotals.map(d => d.totalMin), backgroundColor: themeColor, borderRadius: 3, barPercentage: 0.7 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#2a2a2a' }, ticks: { color: '#666' } },
          x: { grid: { display: false }, ticks: { color: '#666', maxTicksLimit: 8 } },
        },
      },
    })
    return () => { if (barChartRef.current) { barChartRef.current.destroy(); barChartRef.current = null } }
  }, [modal, tab, lifeAreaLog]) // eslint-disable-line react-hooks/exhaustive-deps

  if (modal !== 'lifeAreaManage') return null
  if (authUserId !== 'flavio') return null

  async function handleSaveArea() {
    if (!form.name.trim()) return
    setSaving(true)
    const data = editArea
      ? { ...editArea, name: form.name.trim(), emoji: form.emoji, color: form.color, weeklyTargetMin: form.weeklyTargetMin }
      : { name: form.name.trim(), emoji: form.emoji, color: form.color, weeklyTargetMin: form.weeklyTargetMin }
    await actions.saveLifeArea(data)
    setSaving(false)
    setShowAddForm(false)
    setEditArea(null)
    setForm({ name: '', emoji: '⭐', color: COLOR_OPTIONS[0], weeklyTargetMin: 0 })
  }

  function openEdit(area) {
    setEditArea(area)
    setForm({ name: area.name, emoji: area.emoji, color: area.color || COLOR_OPTIONS[0], weeklyTargetMin: area.weeklyTargetMin || 0 })
    setShowAddForm(true)
  }

  function openAdd() {
    setEditArea(null)
    setForm({ name: '', emoji: '⭐', color: COLOR_OPTIONS[0], weeklyTargetMin: 0 })
    setShowAddForm(true)
  }

  async function handleArchive(area) {
    if (!window.confirm(`Archiviare "${area.name}"? Lo storico già loggato resta visibile nelle statistiche.`)) return
    await actions.archiveLifeArea(area.id)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h3>🌱 Aree della vita</h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setTab('stats')}
            style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: tab === 'stats' ? 'var(--theme-color)' : 'rgba(255,255,255,0.05)', color: tab === 'stats' ? '#000' : 'var(--text)', fontWeight: 700, cursor: 'pointer' }}
          >📊 Statistiche</button>
          <button
            onClick={() => setTab('manage')}
            style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: tab === 'manage' ? 'var(--theme-color)' : 'rgba(255,255,255,0.05)', color: tab === 'manage' ? '#000' : 'var(--text)', fontWeight: 700, cursor: 'pointer' }}
          >⚙️ Gestisci</button>
        </div>

        {tab === 'stats' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              <StatCard label="Oggi" value={`${stats.todayMinutes}m`} sub={`+${stats.todayPts}pt`} />
              <StatCard label="Settimana" value={`${stats.weekMinutes}m`} sub={stats.weekTrend != null ? `${stats.weekTrend >= 0 ? '+' : ''}${stats.weekTrend}m vs prec.` : null} color={stats.weekTrend > 0 ? 'var(--success)' : undefined} />
              <StatCard label="Streak" value={`${stats.streak}gg`} sub={`record ${stats.bestStreak}gg`} />
            </div>

            {stats.byArea.some(a => a.weekMin > 0) ? (
              <>
                <SectionTitle>Distribuzione settimanale per area</SectionTitle>
                <div style={{ height: 200, marginBottom: 20, position: 'relative' }}>
                  <canvas ref={doughnutCanvasRef} />
                </div>
              </>
            ) : (
              <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85em', margin: '20px 0' }}>Nessuna sessione questa settimana</p>
            )}

            <SectionTitle>Andamento ultimi 14 giorni</SectionTitle>
            <div style={{ height: 140, marginBottom: 20, position: 'relative' }}>
              <canvas ref={barCanvasRef} />
            </div>

            <SectionTitle>Dettaglio per area</SectionTitle>
            {stats.byArea.length === 0 && <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85em' }}>Nessuna area creata</p>}
            {stats.byArea.map(a => (
              <div key={a.areaId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '1.3em' }}>{a.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9em' }}>{a.name}</div>
                  <div style={{ fontSize: '0.72em', color: '#888' }}>{a.lifetimeMin}m totali · {a.sessionCount} sessioni · streak {a.streak}gg</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: a.color || 'var(--theme-color)' }}>{a.weekMin}m</div>
                  <div style={{ fontSize: '0.65em', color: '#666' }}>questa sett.</div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'manage' && (
          <>
            {!showAddForm ? (
              <>
                {lifeAreas.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', opacity: a.active === false ? 0.5 : 1 }}>
                    <span style={{ fontSize: '1.3em' }}>{a.emoji}</span>
                    <div style={{ flex: 1, fontWeight: 700, fontSize: '0.9em' }}>
                      {a.name}{a.active === false && <span style={{ fontSize: '0.75em', color: '#666', fontWeight: 400 }}> (archiviata)</span>}
                    </div>
                    {a.active !== false && (
                      <>
                        <button onClick={() => openEdit(a)} style={{ ...iconBtnStyle }}>✏️</button>
                        <button onClick={() => handleArchive(a)} style={{ ...iconBtnStyle }}>📦</button>
                      </>
                    )}
                  </div>
                ))}
                <button className="btn-main" style={{ width: '100%', padding: '12px', marginTop: 16 }} onClick={openAdd}>+ Nuova area</button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Nome</div>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Es. Relazioni"
                    maxLength={40}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9em', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Emoji</div>
                  <input
                    type="text"
                    value={form.emoji}
                    onChange={e => setForm(f => ({ ...f, emoji: e.target.value.slice(0, 4) }))}
                    style={{ width: 60, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '1.2em', textAlign: 'center', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Obiettivo settimanale (minuti, 0 = nessuno)</div>
                  <input
                    type="number"
                    min="0"
                    value={form.weeklyTargetMin}
                    onChange={e => setForm(f => ({ ...f, weeklyTargetMin: e.target.value }))}
                    placeholder="Es. 60"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9em', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Colore</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => setForm(f => ({ ...f, color: c }))}
                        style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: form.color === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-sec" style={{ flex: 1 }} onClick={() => { setShowAddForm(false); setEditArea(null) }}>Annulla</button>
                  <button className="btn-main" style={{ flex: 1, padding: '12px' }} onClick={handleSaveArea} disabled={saving || !form.name.trim()}>
                    {saving ? '⏳' : 'Salva'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <button className="btn-sec" style={{ marginTop: 16 }} onClick={actions.closeModal}>Chiudi</button>
      </div>
    </div>
  )
}

const iconBtnStyle = {
  width: 34, height: 34, borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  cursor: 'pointer', fontSize: '0.9em',
}
