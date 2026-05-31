import { useState } from 'react'
import { useApp } from '../lib/store'
import { parseEntry, getItemValueAtDate, toDateString } from '../lib/habitLogic'

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

// Get Monday of the week containing `date`
function getMondayOf(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

// Return array of 7 date strings Mon→Sun
function getWeekDays(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return toDateString(d)
  })
}

// Determine habit status for a specific day
function getHabitStatus(habit, dateStr, dailyLogs) {
  const stableId = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')

  // Not created yet
  const createdDate = habit.changes?.[0]?.date || '2020-01-01'
  if (dateStr < createdDate) return 'na'

  // Archived
  if (habit.archivedAt && dateStr >= habit.archivedAt) return 'na'

  // Single type: only its targetDate
  if (habit.type === 'single') return habit.targetDate === dateStr ? 'expected' : 'na'

  const entry = parseEntry(dailyLogs?.[dateStr])
  const isDone = entry.habits.includes(stableId)
  const isFailed = entry.failedHabits.includes(stableId)
  const level = entry.habitLevels[stableId] || 'max'
  const isMulti = getItemValueAtDate(habit, 'isMulti', dateStr)

  if (isDone && isMulti && level === 'min') return 'min'
  if (isDone) return 'done'
  if (isFailed) return 'failed'

  // Frequency check: look back to find last completion
  const freq = habit.frequency || 1
  if (freq > 1 && habit.type !== 'if') {
    for (let i = 1; i < freq; i++) {
      const d = new Date(dateStr)
      d.setDate(d.getDate() - i)
      const prev = toDateString(d)
      const prevEntry = parseEntry(dailyLogs?.[prev])
      if (prevEntry.habits.includes(stableId)) return 'not-expected'
    }
  }

  return 'expected'
}

// Compute net points for a day from a userData object
function getDayNet(userData, dateStr) {
  if (!userData) return null
  const entry = parseEntry(userData.dailyLogs?.[dateStr])
  if (entry.habits.length === 0 && entry.failedHabits.length === 0 && entry.purchases.length === 0) return null
  let net = 0
  entry.habits.forEach(hId => {
    const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
    if (h) {
      const isM = getItemValueAtDate(h, 'isMulti', dateStr)
      const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
      const rMax = getItemValueAtDate(h, 'reward', dateStr)
      const lvl = entry.habitLevels[hId] || 'max'
      net += isM && lvl === 'min' ? rMin : rMax
    }
  })
  entry.failedHabits.forEach(hId => {
    const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
    if (h) net -= getItemValueAtDate(h, 'penalty', dateStr)
  })
  net -= entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)
  return net
}

const STATUS_COLORS = {
  done: 'var(--success)',
  min: '#ffc107',
  failed: 'var(--danger)',
  expected: 'rgba(255,255,255,0.08)',
  'not-expected': 'rgba(255,255,255,0.02)',
  na: 'transparent',
}
const STATUS_ICONS = {
  done: '✓', min: '◑', failed: '✗', expected: '', 'not-expected': '', na: '',
}

export default function WeeklyView() {
  const { state, actions } = useApp()
  const { modal, allUsersData, currentUser } = state
  const today = new Date()
  const todayStr = toDateString(today)

  const [weeklyUser, setWeeklyUser] = useState(currentUser)
  const [monday, setMonday] = useState(getMondayOf(today))
  const [popup, setPopup] = useState(null) // { habit, dateStr, status, pts, note }

  if (modal !== 'weeklyView') return null

  const userData = allUsersData[weeklyUser]
  const weekDays = getWeekDays(monday)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const isCurrentWeek = weekDays.includes(todayStr)

  const dailyLogs = userData?.dailyLogs || {}
  const tagsMap = {}
  ;(userData?.tags || []).forEach(t => { tagsMap[t.id] = t })

  // Get habits relevant to this week (not archived before week start)
  const weekStart = weekDays[0]
  const habits = (userData?.habits || []).filter(h => {
    if (h.archivedAt && h.archivedAt <= weekStart) return false
    const created = h.changes?.[0]?.date || '2020-01-01'
    if (created > weekDays[6]) return false
    if (h.type === 'single' && !weekDays.includes(h.targetDate)) return false
    return true
  })

  // Compute daily nets
  const dayNets = weekDays.map(d => getDayNet(userData, d))

  // Weekly totals
  const weekTotal = dayNets.filter(n => n !== null).reduce((a, b) => a + b, 0)
  const activeDays = dayNets.filter(n => n !== null).length
  const weekAvg = activeDays > 0 ? Math.round(weekTotal / activeDays) : 0

  // Completion %: done habits / (done + failed + expected-past)
  let doneCount = 0, totalExpected = 0
  const pastDays = weekDays.filter(d => d <= todayStr)
  habits.forEach(h => {
    pastDays.forEach(d => {
      const status = getHabitStatus(h, d, dailyLogs)
      if (status === 'done' || status === 'min') doneCount++
      if (['done', 'min', 'failed', 'expected'].includes(status)) totalExpected++
    })
  })
  const completionPct = totalExpected > 0 ? Math.round(doneCount / totalExpected * 100) : 0

  function prevWeek() { const m = new Date(monday); m.setDate(m.getDate() - 7); setMonday(m) }
  function nextWeek() { const m = new Date(monday); m.setDate(m.getDate() + 7); setMonday(m) }
  function goToday() { setMonday(getMondayOf(today)) }

  function openPopup(habit, dateStr) {
    const stableId = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')
    const entry = parseEntry(dailyLogs[dateStr])
    const status = getHabitStatus(habit, dateStr, dailyLogs)
    const isMulti = getItemValueAtDate(habit, 'isMulti', dateStr)
    const rMax = getItemValueAtDate(habit, 'reward', dateStr)
    const rMin = getItemValueAtDate(habit, 'rewardMin', dateStr)
    const lvl = entry.habitLevels[stableId] || 'max'
    const penalty = getItemValueAtDate(habit, 'penalty', dateStr)
    const pts = status === 'done' ? (isMulti && lvl === 'min' ? rMin : rMax) : status === 'failed' ? -penalty : 0
    const note = entry.habitNotes?.[stableId] || ''
    setPopup({ habit, dateStr, status, pts, note })
  }

  const statusLabel = { done: 'Completata', min: 'Completata (MIN)', failed: 'Fallita', expected: 'Non ancora', 'not-expected': 'Non prevista', na: 'Non applicabile' }

  return (
    <div className="single-habit-view">
      {/* Topbar */}
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1em', color: 'var(--theme-color)', flex: 1 }}>Dashboard Settimanale</h1>
        <div className="switch-group" style={{ margin: 0, width: 'auto', background: 'transparent', border: 'none', padding: 0, gap: 4 }}>
          {['flavio', 'simona'].map(u => (
            <button key={u}
              onClick={() => setWeeklyUser(u)}
              style={{ background: weeklyUser === u ? 'var(--theme-glow)' : 'rgba(255,255,255,0.05)', border: `1px solid ${weeklyUser === u ? 'var(--theme-color)' : 'rgba(255,255,255,0.1)'}`, color: weeklyUser === u ? 'var(--theme-color)' : '#888', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75em', fontWeight: 600 }}>
              {u === 'flavio' ? 'F' : 'S'}
            </button>
          ))}
        </div>
      </div>

      {/* Week navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--card-solid)' }}>
        <button className="btn-icon" onClick={prevWeek}><span className="material-icons-round">chevron_left</span></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: 'var(--theme-color)', fontSize: '0.9em' }}>
            {monday.getDate()}/{monday.getMonth() + 1} — {sunday.getDate()}/{sunday.getMonth() + 1}
          </div>
          {isCurrentWeek && <div style={{ fontSize: '0.65em', color: '#888' }}>Settimana corrente</div>}
        </div>
        <button className="btn-icon" onClick={nextWeek} disabled={isCurrentWeek}>
          <span className="material-icons-round">chevron_right</span>
        </button>
        {!isCurrentWeek && (
          <button onClick={goToday} style={{ background: 'var(--theme-glow)', border: '1px solid var(--theme-color)', color: 'var(--theme-color)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: '0.72em', fontWeight: 600 }}>
            Oggi
          </button>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {habits.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 60 }}>Nessuna abitudine per questa settimana</div>
        ) : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', minHeight: 0 }}>
            <table className="weekly-table">
              <thead>
                <tr>
                  <th className="weekly-habit-col weekly-th-habit">Abitudine</th>
                  {weekDays.map((d, i) => {
                    const isToday = d === todayStr
                    const dateObj = new Date(d)
                    return (
                      <th key={d} className="weekly-th-day" style={{ background: isToday ? 'var(--theme-glow)' : undefined, borderBottom: isToday ? '2px solid var(--theme-color)' : undefined }}>
                        <div style={{ color: isToday ? 'var(--theme-color)' : '#888', fontWeight: isToday ? 700 : 400 }}>
                          {DAY_NAMES[(dateObj.getDay())]}
                        </div>
                        <div style={{ color: isToday ? 'var(--theme-color)' : '#555', fontSize: '0.8em' }}>{dateObj.getDate()}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {habits.map(h => {
                  const tag = tagsMap[h.tagId]
                  return (
                    <tr key={h.id} className="weekly-row">
                      <td className="weekly-habit-col weekly-td-habit">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {tag?.emoji ? <span style={{ fontSize: '0.9em' }}>{tag.emoji}</span>
                           : tag?.icon ? <i className={`ti ${tag.icon}`} style={{ color: tag.color, fontSize: '0.85em' }} />
                           : <div style={{ width: 8, height: 8, borderRadius: '50%', background: tag?.color || '#444', flexShrink: 0 }} />}
                          <span className="weekly-habit-name">{h.name}</span>
                        </div>
                        <div style={{ fontSize: '0.62em', color: '#555', marginTop: 2 }}>
                          +{getItemValueAtDate(h, 'reward', todayStr)}
                        </div>
                      </td>
                      {weekDays.map(d => {
                        const status = getHabitStatus(h, d, dailyLogs)
                        if (status === 'na') return <td key={d} className="weekly-cell weekly-cell-na" />
                        const isFuture = d > todayStr
                        const bg = STATUS_COLORS[status]
                        return (
                          <td key={d} className="weekly-cell" onClick={() => status !== 'na' && openPopup(h, d)}>
                            <div className="weekly-cell-inner" style={{ background: isFuture && status === 'expected' ? 'rgba(255,255,255,0.04)' : bg }}>
                              <span className="weekly-cell-icon" style={{ color: status === 'done' || status === 'min' ? '#fff' : status === 'failed' ? '#fff' : '#555' }}>
                                {STATUS_ICONS[status]}
                              </span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="weekly-habit-col weekly-td-total">Totale</td>
                  {dayNets.map((net, i) => (
                    <td key={i} className="weekly-td-total" style={{ textAlign: 'center', color: net === null ? '#333' : net >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: '0.8em' }}>
                      {net === null ? '—' : `${net > 0 ? '+' : ''}${net}`}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'var(--card-solid)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: weekTotal >= 0 ? 'var(--success)' : 'var(--danger)' }}>{weekTotal > 0 ? '+' : ''}{weekTotal}</div>
          <div style={{ fontSize: '0.62em', color: '#555', textTransform: 'uppercase' }}>Settimana</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: 'var(--theme-color)' }}>{weekAvg > 0 ? '+' : ''}{weekAvg}</div>
          <div style={{ fontSize: '0.62em', color: '#555', textTransform: 'uppercase' }}>Media/giorno</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: completionPct >= 70 ? 'var(--success)' : '#ff9800' }}>{completionPct}%</div>
          <div style={{ fontSize: '0.62em', color: '#555', textTransform: 'uppercase' }}>Completamento</div>
        </div>
      </div>

      {/* Cell detail popup */}
      {popup && (
        <div className="modal-overlay" onClick={() => setPopup(null)}>
          <div className="modal-box" style={{ maxWidth: 300 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: '1em' }}>{popup.habit.name}</h3>
              <button className="btn-icon" onClick={() => setPopup(null)}><span className="material-icons-round">close</span></button>
            </div>
            <div style={{ fontSize: '0.75em', color: '#666', marginBottom: 10 }}>
              {new Date(popup.dateStr).toLocaleDateString('it', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="stat-box" style={{ flex: 1 }}>
                <span className="stat-num" style={{ fontSize: '0.9em', color: popup.status === 'done' || popup.status === 'min' ? 'var(--success)' : popup.status === 'failed' ? 'var(--danger)' : '#888' }}>
                  {statusLabel[popup.status]}
                </span>
                <span className="stat-lbl">Stato</span>
              </div>
              {popup.pts !== 0 && (
                <div className="stat-box" style={{ flex: 1 }}>
                  <span className="stat-num" style={{ fontSize: '1em', color: popup.pts > 0 ? 'var(--success)' : 'var(--danger)' }}>{popup.pts > 0 ? '+' : ''}{popup.pts}</span>
                  <span className="stat-lbl">Punti</span>
                </div>
              )}
            </div>
            {popup.note && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: '0.85em', color: '#aaa' }}>
                📝 {popup.note}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
