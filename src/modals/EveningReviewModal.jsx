import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { parseEntry, getItemValueAtDate, isHabitVisible, toDateString } from '../lib/habitLogic'

function TagBadge({ tag }) {
  if (!tag) return null
  return (
    <span style={{
      fontSize: '0.75em', padding: '3px 10px', borderRadius: 20,
      background: tag.color, color: '#fff', fontWeight: 600,
    }}>
      {tag.emoji || ''} {tag.name}
    </span>
  )
}

function buildSummaryData(globalData, today) {
  const entry = parseEntry(globalData?.dailyLogs?.[today])
  let earned = 0, spent = 0
  ;(globalData?.habits || []).forEach(h => {
    if (!isHabitVisible(h, today, entry.habits, entry.failedHabits)) return
    const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    const reward = getItemValueAtDate(h, 'reward', today)
    const rewardMin = getItemValueAtDate(h, 'rewardMin', today)
    const penalty = getItemValueAtDate(h, 'penalty', today)
    const isMulti = getItemValueAtDate(h, 'isMulti', today)
    const level = entry.habitLevels?.[sid] || 'max'
    if (entry.habits.includes(sid)) earned += isMulti && level === 'min' ? rewardMin : reward
    if (entry.failedHabits.includes(sid)) spent += penalty
  })
  spent += (entry.purchases || []).reduce((a, p) => a + parseInt(p.cost || 0), 0)
  return {
    completed: (entry.habits || []).length,
    failed: (entry.failedHabits || []).length,
    net: earned - spent,
  }
}

export default function EveningReviewModal() {
  const { state, actions } = useApp()
  const { modal, globalData, viewDate } = state

  // ALL state/refs declared unconditionally before any return
  const [habitList, setHabitList] = useState([])   // snapshot at open time
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(false)
  const [summary, setSummary] = useState({ completed: 0, failed: 0, net: 0 })

  const touchRef = useRef({ startX: 0, startY: 0, dir: null })
  const cardRef = useRef(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeDir, setSwipeDir] = useState(null)

  const today = toDateString(new Date())

  // Initialize habitList when modal opens — runs after render so globalData is available
  useEffect(() => {
    if (modal !== 'eveningReview') return
    if (!globalData) return

    const entry = parseEntry(globalData.dailyLogs?.[today])
    const pending = (globalData.habits || []).filter(h => {
      if (h.type === 'if' || h.type === 'goal') return false
      if (!isHabitVisible(h, today, entry.habits, entry.failedHabits)) return false
      const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
      return !entry.habits.includes(sid) && !entry.failedHabits.includes(sid)
    })

    console.log('[EveningReview] pending habits:', pending.length, pending.map(h => h.name))

    setHabitList(pending)
    setIdx(0)
    setSwipeOffset(0)
    setSwipeDir(null)

    if (pending.length === 0) {
      setSummary(buildSummaryData(globalData, today))
      setDone(true)
    } else {
      setDone(false)
    }
  }, [modal]) // eslint-disable-line react-hooks/exhaustive-deps

  if (modal !== 'eveningReview') return null
  if (!globalData) return null

  const tagsMap = {}
  ;(globalData.tags || []).forEach(t => { tagsMap[t.id] = t })

  const total = habitList.length

  async function act(habitId, action) {
    await actions.setHabitStatus(habitId, action)
    const nextIdx = idx + 1
    if (nextIdx >= total) {
      setSummary(buildSummaryData(globalData, today))
      setDone(true)
    } else {
      setIdx(nextIdx)
    }
    setSwipeOffset(0)
    setSwipeDir(null)
  }

  function resetSwipe() {
    setSwipeOffset(0)
    setSwipeDir(null)
  }

  // Touch handlers
  function onTouchStart(e) {
    const t = e.touches[0]
    touchRef.current = { startX: t.clientX, startY: t.clientY, dir: null }
  }

  function onTouchMove(e) {
    const t = e.touches[0]
    const dx = t.clientX - touchRef.current.startX
    const dy = t.clientY - touchRef.current.startY
    if (!touchRef.current.dir && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      touchRef.current.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (touchRef.current.dir === 'h') {
      e.preventDefault()
      setSwipeOffset(dx)
      setSwipeDir(dx > 0 ? 'right' : 'left')
    }
  }

  function onTouchEnd() {
    const habit = habitList[idx]
    if (!habit) return
    const sid = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')
    if (Math.abs(swipeOffset) >= 100) {
      if (navigator.vibrate) navigator.vibrate(50)
      act(sid, swipeOffset > 0 ? 'next' : 'failed')
    } else {
      resetSwipe()
    }
  }

  // ── Summary screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="modal-overlay" style={{ alignItems: 'flex-end' }}>
        <div style={{
          width: '100%', background: 'var(--card-solid)', borderRadius: '24px 24px 0 0',
          padding: '36px 24px 48px', animation: 'slideUp 0.3s ease',
          border: '1px solid var(--card-border)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: '3em', marginBottom: 8 }}>
              {summary.net >= 0 ? '🌟' : '💪'}
            </div>
            <div style={{ fontSize: '1.3em', fontWeight: 700, marginBottom: 4 }}>
              Revisione completata!
            </div>
            <div style={{ fontSize: '0.85em', color: '#666' }}>Riepilogo di oggi</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Completate', val: summary.completed, color: 'var(--success)' },
              { label: 'Fallite', val: summary.failed, color: 'var(--danger)' },
              { label: 'Netto', val: (summary.net > 0 ? '+' : '') + summary.net, color: summary.net >= 0 ? 'var(--success)' : 'var(--danger)' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 14,
                padding: '16px 8px', textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: '1.6em', fontWeight: 800, color }}>{val}</div>
                <div style={{ fontSize: '0.65em', color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
              </div>
            ))}
          </div>

          <button className="btn-main" onClick={() => actions.closeModal()}>
            Torna alla home
          </button>
        </div>
      </div>
    )
  }

  // ── Loading state (habitList not yet populated) ─────────────────────────────
  const habit = habitList[idx]
  if (!habit) {
    // Waiting for useEffect to populate habitList — show nothing (flashes max ~1 frame)
    return (
      <div className="modal-overlay" style={{ alignItems: 'flex-end', background: 'rgba(0,0,0,0.85)' }}>
        <div style={{ width: '100%', background: 'var(--card-solid)', borderRadius: '24px 24px 0 0', padding: 40, textAlign: 'center', border: '1px solid var(--card-border)' }}>
          <div style={{ color: '#555', fontSize: '0.9em' }}>Caricamento...</div>
        </div>
      </div>
    )
  }

  // ── Habit card ──────────────────────────────────────────────────────────────
  const sid = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')
  const reward = getItemValueAtDate(habit, 'reward', today)
  const rewardMin = getItemValueAtDate(habit, 'rewardMin', today)
  const penalty = getItemValueAtDate(habit, 'penalty', today)
  const isMulti = getItemValueAtDate(habit, 'isMulti', today)
  const tag = tagsMap[habit.tagId]
  const progress = total > 0 ? (idx / total) * 100 : 0
  const threshold = 100
  const bgColor = swipeDir === 'right' ? 'rgba(76,175,80,0.25)' : swipeDir === 'left' ? 'rgba(239,83,80,0.25)' : 'transparent'

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-end', background: 'rgba(0,0,0,0.85)' }}>
      <div style={{
        width: '100%', background: 'var(--card-solid)',
        borderRadius: '24px 24px 0 0', padding: '0 0 48px',
        animation: 'slideUp 0.3s ease', overflow: 'hidden',
        border: '1px solid var(--card-border)',
        minHeight: '65vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 12px' }}>
          <div style={{ fontSize: '0.8em', color: '#666' }}>🌙 Revisione Serale</div>
          <div style={{ fontSize: '0.82em', color: 'var(--theme-color)', fontWeight: 700 }}>
            {idx + 1} di {total}
          </div>
          <button className="btn-icon" onClick={() => actions.closeModal()}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', margin: '0 20px' }}>
          <div style={{ height: '100%', background: 'var(--theme-color)', width: `${progress}%`, transition: 'width 0.4s ease', borderRadius: 2 }} />
        </div>

        {/* Swipeable area */}
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', padding: '0 20px' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div style={{ position: 'absolute', inset: 0, background: bgColor, transition: swipeDir ? 'none' : 'background 0.3s ease', pointerEvents: 'none' }} />

          {swipeOffset > 20 && (
            <div style={{ position: 'absolute', left: 30, top: '50%', transform: 'translateY(-50%)', color: 'var(--success)', fontSize: '2em', opacity: Math.min(Math.abs(swipeOffset) / threshold, 1), pointerEvents: 'none' }}>✓</div>
          )}
          {swipeOffset < -20 && (
            <div style={{ position: 'absolute', right: 30, top: '50%', transform: 'translateY(-50%)', color: 'var(--danger)', fontSize: '2em', opacity: Math.min(Math.abs(swipeOffset) / threshold, 1), pointerEvents: 'none' }}>✗</div>
          )}

          {/* Habit card */}
          <div
            ref={cardRef}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '32px 16px',
              transform: `translateX(${swipeOffset}px)`,
              transition: swipeOffset === 0 && !touchRef.current.dir ? 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
              userSelect: 'none',
            }}
          >
            <div style={{ fontSize: '1.6em', fontWeight: 700, textAlign: 'center', marginBottom: 12, lineHeight: 1.3 }}>
              {habit.name}
            </div>
            {tag && <div style={{ marginBottom: 16 }}><TagBadge tag={tag} /></div>}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ padding: '4px 14px', borderRadius: 20, fontWeight: 700, background: 'rgba(76,175,80,0.12)', color: 'var(--success)', border: '1px solid rgba(76,175,80,0.25)' }}>
                +{isMulti ? `${rewardMin}/${reward}` : reward}
              </span>
              <span style={{ padding: '4px 14px', borderRadius: 20, fontWeight: 700, background: 'rgba(239,83,80,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,83,80,0.2)' }}>
                -{penalty}
              </span>
            </div>
            {habit.description ? <div style={{ fontSize: '0.82em', color: '#555', textAlign: 'center', marginTop: 8 }}>{habit.description}</div> : null}
            <div style={{ fontSize: '0.7em', color: '#444', marginTop: 20 }}>← Swipe per agire →</div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ padding: '0 20px', display: 'flex', gap: 12 }}>
          {isMulti ? (
            <>
              <button onClick={() => act(sid, 'next')} style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1px solid rgba(76,175,80,0.3)', background: 'rgba(76,175,80,0.15)', color: 'var(--success)', fontWeight: 700, cursor: 'pointer', fontSize: '1em' }}>MIN ✓</button>
              <button onClick={async () => { await act(sid, 'next'); await act(sid, 'next') }} style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: 'var(--success)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '1em' }}>MAX ✓✓</button>
              <button onClick={() => act(sid, 'failed')} style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1px solid rgba(239,83,80,0.3)', background: 'rgba(239,83,80,0.15)', color: 'var(--danger)', fontWeight: 700, cursor: 'pointer', fontSize: '1em' }}>✗</button>
            </>
          ) : (
            <>
              <button onClick={() => act(sid, 'failed')} style={{ flex: 1, padding: '16px', borderRadius: 14, border: '1px solid rgba(239,83,80,0.3)', background: 'rgba(239,83,80,0.15)', color: 'var(--danger)', fontWeight: 700, cursor: 'pointer', fontSize: '1.05em' }}>✗ Non fatto</button>
              <button onClick={() => act(sid, 'next')} style={{ flex: 2, padding: '16px', borderRadius: 14, border: 'none', background: 'var(--success)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '1.05em', boxShadow: '0 4px 14px rgba(76,175,80,0.4)' }}>✓ Fatto</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
