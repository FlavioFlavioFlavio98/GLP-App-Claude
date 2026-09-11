import { useEffect, useRef, useState } from 'react'
import { toDateString } from '../lib/habitLogic'
import { renderDiaryMarkdown, countWords } from '../lib/diaryMarkdown'

// Dopo tanti secondi senza digitare si considera la sessione di scrittura
// conclusa: il timer si ferma, il tempo va nel totale del giorno, la voce
// viene salvata e la vista passa in anteprima formattata — richiesta
// esplicita di Flavio.
const INACTIVITY_MS = 6000

function fmtElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtMinutes(totalSeconds) {
  const m = Math.round(totalSeconds / 60)
  return m > 0 ? `${m}m` : `${totalSeconds}s`
}

function fmtDayLabel(dateStr) {
  const today = toDateString(new Date())
  const yesterday = toDateString(new Date(Date.now() - 86400000))
  if (dateStr === today) return 'Oggi'
  if (dateStr === yesterday) return 'Ieri'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })
}

export default function DiaryTab({ actions, authUserId, isReadOnly, globalData }) {
  const todayStr = toDateString(new Date())
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [text, setText] = useState('')
  const [mode, setMode] = useState('write') // 'write' | 'preview'
  const [writing, setWriting] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)

  // Refs invece di stato per tutto ciò che serve dentro i timeout/cleanup —
  // evita closure "stantie" quando il salvataggio scatta con un ritardo
  // (stesso principio già usato per il timer del pasto/task sul watch).
  const selectedDateRef = useRef(selectedDate)
  const textRef = useRef('')
  const burstStartRef = useRef(null)
  const tickIntervalRef = useRef(null)
  const inactivityTimeoutRef = useRef(null)

  const diaryLog = globalData?.diaryLog || {}
  const canEdit = authUserId === 'flavio' && !isReadOnly

  useEffect(() => { selectedDateRef.current = selectedDate }, [selectedDate])

  // Carica la voce del giorno selezionato ogni volta che cambia la data —
  // in anteprima se c'è già del testo salvato, altrimenti pronta a scrivere.
  useEffect(() => {
    const existing = diaryLog[selectedDate]
    const initialText = existing?.text || ''
    setText(initialText)
    textRef.current = initialText
    setMode(initialText ? 'preview' : 'write')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  function stopTicking() {
    if (tickIntervalRef.current) { clearInterval(tickIntervalRef.current); tickIntervalRef.current = null }
    if (inactivityTimeoutRef.current) { clearTimeout(inactivityTimeoutRef.current); inactivityTimeoutRef.current = null }
  }

  // Chiude la sessione di scrittura in corso: calcola quanto è durata,
  // salva testo + tempo accumulato, torna in anteprima.
  function flushBurst() {
    if (burstStartRef.current == null) return
    const burstSec = Math.max(0, Math.round((Date.now() - burstStartRef.current) / 1000))
    burstStartRef.current = null
    stopTicking()
    setWriting(false)
    setElapsedSec(0)
    actions.saveDiaryEntry(selectedDateRef.current, textRef.current, burstSec)
    setMode('preview')
  }

  // Salva anche lasciando la tab a metà scrittura (cambio pagina, chiusura
  // dell'app) — altrimenti quei minuti/quelle parole andrebbero perse senza
  // che l'utente se ne accorga.
  useEffect(() => {
    return () => { if (burstStartRef.current != null) flushBurst() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setText(val)
    textRef.current = val
    if (burstStartRef.current == null) {
      burstStartRef.current = Date.now()
      setWriting(true)
      setElapsedSec(0)
      tickIntervalRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - burstStartRef.current) / 1000))
      }, 1000)
    }
    clearTimeout(inactivityTimeoutRef.current)
    inactivityTimeoutRef.current = setTimeout(flushBurst, INACTIVITY_MS)
  }

  function selectDate(newDate) {
    if (newDate === selectedDate) return
    if (burstStartRef.current != null) flushBurst()
    setSelectedDate(newDate)
  }

  function changeDay(deltaDays) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + deltaDays)
    const next = toDateString(d)
    if (next <= todayStr) selectDate(next)
  }

  const entry = diaryLog[selectedDate]
  const savedSeconds = entry?.timeSpentSec || 0
  const totalTodaySec = savedSeconds + (writing ? elapsedSec : 0)
  const liveWordCount = countWords(text)

  const historyDates = Object.keys(diaryLog)
    .filter(d => diaryLog[d]?.text && d !== selectedDate)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 30)

  if (!canEdit) {
    return <div className="empty-state">Il diario non è disponibile per questa vista</div>
  }

  return (
    <div style={{ padding: '16px 16px 90px' }}>
      <h2 style={{ fontSize: '1.1em', fontWeight: 800, marginBottom: 4 }}>📔 Diario</h2>
      <p style={{ fontSize: '0.78em', color: '#888', marginTop: 0, marginBottom: 16 }}>
        Scrivi liberamente — il timer parte da solo mentre scrivi e si ferma quando ti fermi tu.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 16 }}>
        <button
          onClick={() => changeDay(-1)}
          style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.3em', cursor: 'pointer', padding: '0 8px' }}
        >&#8249;</button>
        <div style={{ position: 'relative', textAlign: 'center', minWidth: 140 }}>
          <span style={{ fontWeight: 700, color: 'var(--theme-color)', fontSize: '1em' }}>{fmtDayLabel(selectedDate)}</span>
          <input
            type="date"
            value={selectedDate}
            max={todayStr}
            onChange={e => e.target.value && selectDate(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
          />
        </div>
        <button
          onClick={() => changeDay(1)}
          disabled={selectedDate === todayStr}
          style={{ background: 'none', border: 'none', color: selectedDate === todayStr ? '#333' : '#888', fontSize: '1.3em', cursor: selectedDate === todayStr ? 'default' : 'pointer', padding: '0 8px' }}
        >&#8250;</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.15em', fontWeight: 800, color: writing ? 'var(--theme-color)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {writing ? fmtElapsed(elapsedSec) : fmtElapsed(0)}
          </div>
          <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>
            {writing ? '✍️ In scrittura' : 'Timer scrittura'}
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.15em', fontWeight: 800, color: 'var(--text)' }}>{liveWordCount}</div>
          <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>Parole</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.15em', fontWeight: 800, color: 'var(--text)' }}>{fmtMinutes(totalTodaySec)}</div>
          <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>Scritto oggi</div>
        </div>
      </div>

      {mode === 'write' ? (
        <textarea
          value={text}
          onChange={handleChange}
          placeholder="Scrivi qui... (- per un elenco puntato, 1. per uno numerato)"
          rows={12}
          autoFocus={selectedDate === todayStr}
          style={{
            width: '100%', padding: 14, borderRadius: 14, border: '1px solid var(--card-border)',
            background: 'var(--surface)', color: 'var(--text)', fontSize: '0.95em', boxSizing: 'border-box',
            resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, marginBottom: 10,
          }}
        />
      ) : (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              padding: 16, borderRadius: 14, border: '1px solid var(--card-border)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: '0.92em', lineHeight: 1.6,
              minHeight: 120,
            }}
            dangerouslySetInnerHTML={{ __html: renderDiaryMarkdown(text) || '<span style="color:#666">Ancora nulla scritto per questo giorno.</span>' }}
          />
          <button
            onClick={() => setMode('write')}
            style={{ width: '100%', padding: 10, marginTop: 8, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: '0.85em', cursor: 'pointer' }}
          >✏️ Continua a scrivere</button>
        </div>
      )}

      {historyDates.length > 0 && (
        <>
          <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, margin: '20px 0 10px' }}>Giorni passati</div>
          {historyDates.map(d => {
            const e = diaryLog[d]
            const preview = (e.text || '').replace(/\n+/g, ' ').replace(/[-*]\s|\d+[.)]\s/g, '').trim().slice(0, 70)
            return (
              <div
                key={d}
                onClick={() => selectDate(d)}
                style={{
                  padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
                  background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.76em', fontWeight: 700, color: 'var(--theme-color)' }}>{fmtDayLabel(d)}</span>
                  <span style={{ fontSize: '0.66em', color: '#666' }}>{e.wordCount} parole</span>
                </div>
                <div style={{ fontSize: '0.78em', color: 'var(--text-sec)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {preview}{preview.length >= 70 ? '…' : ''}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
