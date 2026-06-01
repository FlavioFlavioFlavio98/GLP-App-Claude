import { useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { getItemValueAtDate, calculateStreak, calcNumericPoints } from '../lib/habitLogic'
import { calcQualityScore } from '../lib/statsLogic'
import { TIME_SLOT_OPTS } from '../App'

// ---- Widget per abitudini numeriche ----
function NumericWidget({ habit, stableId, viewDate, entry, isToday }) {
  const { actions } = useApp()
  const cfg = habit.numericConfig
  const savedValue = entry.habitValues?.[stableId]
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')

  const previewPts = inputVal !== '' ? calcNumericPoints(parseFloat(inputVal), cfg) : null
  const savedPts = savedValue !== undefined ? calcNumericPoints(parseFloat(savedValue), cfg) : null
  const ptsColor = (pts) => pts == null ? '#666' : pts >= 0 ? 'var(--success)' : 'var(--danger)'

  if (!editing && savedValue !== undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95em', color: 'var(--theme-color)' }}>
            {savedValue} {cfg?.unit}
          </div>
          <div style={{ fontSize: '0.72em', color: ptsColor(savedPts), fontWeight: 700 }}>
            {savedPts >= 0 ? '+' : ''}{savedPts} pt
          </div>
        </div>
        {isToday && (
          <button className="btn-icon" onClick={() => { setInputVal(String(savedValue)); setEditing(true) }}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>edit</span>
          </button>
        )}
      </div>
    )
  }

  if (editing || (savedValue === undefined && isToday)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number"
              inputMode={cfg?.inputType === 'decimal' ? 'decimal' : 'numeric'}
              step={cfg?.inputType === 'decimal' ? '0.1' : '1'}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="0"
              style={{
                width: 72, padding: '6px 8px', textAlign: 'right',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8, color: 'var(--text)', fontSize: '0.9em',
              }}
              autoFocus
            />
            <span style={{ fontSize: '0.75em', color: '#666' }}>{cfg?.unit}</span>
          </div>
          {previewPts !== null && (
            <span style={{ fontSize: '0.68em', color: ptsColor(previewPts), fontWeight: 700 }}>
              = {previewPts >= 0 ? '+' : ''}{previewPts} pt
            </span>
          )}
        </div>
        <button
          className="btn-status done-btn active"
          style={{ fontSize: '0.7em', width: 48 }}
          onClick={() => {
            if (inputVal === '') return
            actions.setNumericValue(stableId, inputVal)
            setEditing(false)
          }}
          disabled={inputVal === ''}
        >OK</button>
        {editing && (
          <button className="btn-icon" onClick={() => setEditing(false)}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>close</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ color: '#444', fontSize: '0.78em' }}>
      {isToday ? (
        <button className="btn-status done-btn" style={{ fontSize: '0.65em', width: 52 }} onClick={() => setEditing(true)}>
          <span className="material-icons-round" style={{ fontSize: 16 }}>input</span>
        </button>
      ) : <span>—</span>}
    </div>
  )
}

function TagIcon({ tag }) {
  if (!tag) return null
  const icon = tag.emoji
    ? <span style={{ fontSize: '0.9em' }}>{tag.emoji}</span>
    : tag.icon
      ? <i className={`ti ${tag.icon}`} style={{ fontSize: '0.85em' }} />
      : null
  return (
    <span className="tag-pill" style={{ background: tag.color }}>
      {icon}
      {tag.name}
    </span>
  )
}

const SWIPE_THRESHOLD = 80

export default function HabitItem({
  habit, viewDate, doneHabits, failedHabits, habitLevels, habitNotes, habitValues, tagsMap, isToday,
  dragHandleProps, isDragOverlay, globalData,
}) {
  const { actions } = useApp()
  // Quality dot — compute only for non-numeric, non-if habits
  const qualityScore = (!habit.numericType && habit.type !== 'if' && !isDragOverlay && globalData)
    ? calcQualityScore(habit, globalData) : null
  const qDotClass = qualityScore === null ? '' : qualityScore >= 70 ? 'q-good' : qualityScore >= 40 ? 'q-ok' : 'q-bad'
  const stableId = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')

  const isDone = Boolean(doneHabits && doneHabits.includes(stableId))
  const isFailed = Boolean(failedHabits && failedHabits.includes(stableId))
  const level = (habitLevels && habitLevels[stableId]) || 'max'

  const reward = getItemValueAtDate(habit, 'reward', viewDate)
  const rewardMin = getItemValueAtDate(habit, 'rewardMin', viewDate)
  const penalty = getItemValueAtDate(habit, 'penalty', viewDate)
  const isMulti = getItemValueAtDate(habit, 'isMulti', viewDate)
  const description = getItemValueAtDate(habit, 'description', viewDate)
  const isIf = habit.type === 'if'
  const isNumeric = Boolean(habit.numericType && habit.numericConfig)
  const importance = habit.importance || 'medium'
  const tsOpt = habit.timeSlot ? TIME_SLOT_OPTS.find(o => o.v === habit.timeSlot) : null
  const importanceDot = importance === 'high' ? '#E24B4A' : importance === 'medium' ? '#EF9F27' : '#4fc3f7'
  const isHighFailed = importance === 'high' && isFailed

  const tag = tagsMap[habit.tagId]
  const streak = isToday && !isIf && !isDragOverlay ? calculateStreak(stableId, {}) : 0
  const existingNote = habitNotes?.[stableId] || ''

  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [showNotePopup, setShowNotePopup] = useState(false)

  // ---- Swipe state ----
  const cardRef = useRef(null)
  const touchState = useRef({ startX: 0, startY: 0, dir: null, active: false, thresholdHit: false })
  const offsetRef = useRef(0)
  const [swipeDir, setSwipeDir] = useState(null) // 'right' | 'left' | null
  const [swipeRatio, setSwipeRatio] = useState(0) // 0..1

  function setCardOffset(px, animate = false) {
    const el = cardRef.current
    if (!el) return
    offsetRef.current = px
    el.style.transition = animate ? 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)' : 'none'
    el.style.transform = `translateX(${px}px)`
  }

  function resetSwipe(animate = true) {
    setCardOffset(0, animate)
    setSwipeDir(null)
    setSwipeRatio(0)
    touchState.current.dir = null
    touchState.current.active = false
    touchState.current.thresholdHit = false
  }

  function onTouchStart(e) {
    if (isDragOverlay) return
    const t = e.touches[0]
    touchState.current = { startX: t.clientX, startY: t.clientY, dir: null, active: false, thresholdHit: false }
  }

  function onTouchMove(e) {
    if (isDragOverlay) return
    const t = e.touches[0]
    const dx = t.clientX - touchState.current.startX
    const dy = t.clientY - touchState.current.startY

    // Determine direction from first 10px of movement
    if (!touchState.current.dir && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      touchState.current.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      touchState.current.active = touchState.current.dir === 'h'
    }

    if (!touchState.current.active) return
    e.preventDefault()
    e.stopPropagation()

    // Rubber-band: resistance past threshold
    const raw = dx
    const sign = raw >= 0 ? 1 : -1
    const abs = Math.abs(raw)
    const offset = abs > SWIPE_THRESHOLD
      ? sign * (SWIPE_THRESHOLD + (abs - SWIPE_THRESHOLD) * 0.3)
      : raw

    setCardOffset(offset)
    const dir = offset > 0 ? 'right' : 'left'
    setSwipeDir(dir)
    setSwipeRatio(Math.min(Math.abs(offset) / SWIPE_THRESHOLD, 1))

    // Haptic when crossing threshold
    if (!touchState.current.thresholdHit && Math.abs(raw) >= SWIPE_THRESHOLD) {
      touchState.current.thresholdHit = true
      if (navigator.vibrate) navigator.vibrate(30)
    } else if (touchState.current.thresholdHit && Math.abs(raw) < SWIPE_THRESHOLD) {
      touchState.current.thresholdHit = false
    }
  }

  function onTouchEnd() {
    if (!touchState.current.active) return
    const offset = offsetRef.current

    if (Math.abs(offset) >= SWIPE_THRESHOLD) {
      if (navigator.vibrate) navigator.vibrate(50)
      resetSwipe(true)
      if (offset > 0) {
        actions.setHabitStatus(stableId, 'next')
      } else {
        actions.setHabitStatus(stableId, 'failed')
      }
    } else {
      resetSwipe(true)
    }
  }

  // ---- Done button appearance ----
  let doneClass, doneContent
  if (!isDone) {
    doneClass = 'done-btn'
    doneContent = <span className="material-icons-round">check</span>
  } else if (isMulti && level === 'min') {
    doneClass = 'done-btn min-level'
    doneContent = 'MIN'
  } else {
    doneClass = 'done-btn active'
    doneContent = isMulti ? 'MAX' : <span className="material-icons-round">check</span>
  }

  const statusClass = isDone ? 'status-done' : isFailed ? 'status-failed' : ''
  const doneButtonKey = `done-${stableId}-${isDone ? (isMulti ? level : 'done') : 'neutral'}`
  const failButtonKey = `fail-${stableId}-${isFailed ? 'fail' : 'neutral'}`

  function handleSaveNote() {
    const trimmed = noteText.trim()
    if (trimmed) actions.saveHabitNote(stableId, trimmed, viewDate)
    setShowNoteInput(false)
    setNoteText('')
  }

  // Swipe hint content
  const rightLabel = isDone ? (isMulti && level === 'min' ? 'MAX' : 'Annulla') : (isMulti ? 'MIN' : 'Fatto')
  const leftLabel = isFailed ? 'Annulla' : 'Fallita'

  return (
    <div className="swipe-wrapper">
      {/* Background hints (shown while swiping) */}
      {swipeDir === 'right' && (
        <div className="swipe-hint-right" style={{ opacity: swipeRatio }}>
          <div className="swipe-hint-icon">
            <span className="material-icons-round" style={{ fontSize: 18 }}>check</span>
            {rightLabel}
          </div>
        </div>
      )}
      {swipeDir === 'left' && (
        <div className="swipe-hint-left" style={{ opacity: swipeRatio }}>
          <div className="swipe-hint-icon">
            <span className="material-icons-round" style={{ fontSize: 18 }}>close</span>
            {leftLabel}
          </div>
        </div>
      )}

      {/* Card (translated by swipe) */}
      <div
        ref={cardRef}
        className="swipe-card"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={`item ${statusClass}`} style={{
          ...(tag ? { borderLeftColor: tag.color } : {}),
          ...(isHighFailed ? { borderLeftColor: '#E24B4A', borderLeftWidth: 5, boxShadow: '0 0 0 1px rgba(226,75,74,0.2)' } : {}),
        }}>
          {dragHandleProps && (
            <div className="drag-handle" {...dragHandleProps} aria-label="Riordina">
              <span className="material-icons-round">drag_indicator</span>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="item-name-row">
              <h3>
                {habit.name}
                {tsOpt?.icon && (
                  <span className="material-icons-round" style={{ fontSize: 13, marginLeft: 5, verticalAlign: 'middle', color: tsOpt.color, opacity: 0.75 }}>{tsOpt.icon}</span>
                )}
              </h3>
              <TagIcon tag={tag} />
              {streak > 1 && (
                <span className="streak-badge">
                  <span className="streak-flame">🔥</span>{streak}
                </span>
              )}
              {existingNote && (
                <button className="note-icon-btn" onClick={() => setShowNotePopup(v => !v)} title="Vedi nota">📝</button>
              )}
            </div>
            {description ? <span className="item-desc">{description}</span> : null}
            <div className="vals">
              <span className="val-badge val-badge-plus">+{isMulti ? `${rewardMin}/${reward}` : reward}</span>
              {!isIf && <> / <span className="val-badge val-badge-minus">-{penalty}</span></>}
            </div>
            {showNotePopup && existingNote && (
              <div className="note-popup">
                <span>{existingNote}</span>
                <button className="note-popup-close" onClick={() => setShowNotePopup(false)}>✕</button>
              </div>
            )}
          </div>

          <div className="actions-group">
            <button className="btn-icon" onClick={() => actions.openModal('singleHabit', habit.id)}>
              <span className="material-icons-round" style={{ fontSize: 18 }}>insights</span>
            </button>
            <button className="btn-icon" onClick={() => actions.openModal('edit', { id: habit.id, type: 'habit' })}>
              <span className="material-icons-round" style={{ fontSize: 18 }}>edit</span>
            </button>
            {isNumeric ? (
              <NumericWidget
                habit={habit}
                stableId={stableId}
                viewDate={viewDate}
                entry={{ habitValues: habitValues || {}, habits: doneHabits || [], failedHabits: failedHabits || [], habitLevels: habitLevels || {} }}
                isToday={isToday}
              />
            ) : (
              <>
                {!isIf && (
                  <button
                    key={failButtonKey}
                    className={`btn-status fail-btn${isFailed ? ' active' : ''}`}
                    onClick={() => actions.setHabitStatus(stableId, 'failed')}
                  >
                    <span className="material-icons-round">close</span>
                  </button>
                )}
                <button
                  key={doneButtonKey}
                  className={`btn-status ${doneClass}`}
                  onClick={() => actions.setHabitStatus(stableId, 'next')}
                >
                  {doneContent}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {isDone && !existingNote && !showNoteInput && (
        <button className="add-note-btn" onClick={() => { setNoteText(''); setShowNoteInput(true) }}>
          📝 Aggiungi nota
        </button>
      )}
      {showNoteInput && (
        <div className="note-input-wrap">
          <textarea
            className="note-textarea"
            value={noteText}
            onChange={e => setNoteText(e.target.value.slice(0, 150))}
            placeholder="Scrivi una nota breve... (max 150 caratteri)"
            autoFocus
            rows={2}
          />
          <div className="note-input-actions">
            <span className="note-char-count">{noteText.length}/150</span>
            <button className="note-cancel-btn" onClick={() => setShowNoteInput(false)}>Annulla</button>
            <button className="note-save-btn" onClick={handleSaveNote} disabled={!noteText.trim()}>Salva</button>
          </div>
        </div>
      )}
    </div>
  )
}
