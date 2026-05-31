import { useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { getItemValueAtDate, calculateStreak } from '../lib/habitLogic'

function TagIcon({ tag }) {
  if (!tag) return <span className="tag-pill tag-pill-none">Nessuna categoria</span>
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
  habit, viewDate, doneHabits, failedHabits, habitLevels, habitNotes, tagsMap, isToday,
  dragHandleProps, isDragOverlay,
}) {
  const { actions } = useApp()
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
        <div className={`item ${statusClass}`} style={tag ? { borderLeftColor: tag.color } : {}}>
          {dragHandleProps && (
            <div className="drag-handle" {...dragHandleProps} aria-label="Riordina">
              <span className="material-icons-round">drag_indicator</span>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="item-name-row">
              <h3>{habit.name}</h3>
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
