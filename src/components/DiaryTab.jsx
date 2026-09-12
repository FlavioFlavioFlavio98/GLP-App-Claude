import { useEffect, useRef, useState } from 'react'
import { toDateString } from '../lib/habitLogic'
import { renderDiaryMarkdown, countWords } from '../lib/diaryMarkdown'
import { computeDiaryStats } from '../lib/diaryStats'
import { getRandomQuestion } from '../lib/journalQuestions'

// Dopo tanti secondi senza digitare si considera la sessione di scrittura
// conclusa: il timer si ferma, il tempo va nel totale del giorno, la voce
// viene salvata e la vista passa in anteprima formattata — richiesta
// esplicita di Flavio. Alzato da 6 a 30s: si fermava troppo presto, capita
// di sostare qualche secondo a pensare prima di riprendere a scrivere.
const INACTIVITY_MS = 30000

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

export default function DiaryTab({ actions, authUserId, isReadOnly, globalData, onZenModeChange }) {
  const todayStr = toDateString(new Date())
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [text, setText] = useState('')
  const [mode, setMode] = useState('write') // 'write' | 'preview'
  const [writing, setWriting] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  // Zen mode: attivo quando il campo di scrittura ha il focus — nasconde
  // titolo/date-nav/statistiche/storico QUI, e (via onZenModeChange, gestito
  // da App.jsx) anche header/date-nav globale/bottom-nav, per togliere ogni
  // distrazione mentre si scrive. Indipendente dal timer di scrittura sotto:
  // uscire dallo zen mode (tasto ✕ o tap fuori) non ferma il conteggio del
  // tempo, solo l'inattività di 30s lo fa.
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef(null)
  // Spunto "a chiamata" per quando non si sa cosa scrivere — null finché non
  // lo si chiede esplicitamente, non deve intromettersi nei giorni in cui
  // si sa già cosa scrivere.
  const [prompt, setPrompt] = useState(null)

  // Refs invece di stato per tutto ciò che serve dentro i timeout/cleanup —
  // evita closure "stantie" quando il salvataggio scatta con un ritardo
  // (stesso principio già usato per il timer del pasto/task sul watch).
  const selectedDateRef = useRef(selectedDate)
  const textRef = useRef('')
  const burstStartRef = useRef(null)
  const tickIntervalRef = useRef(null)
  const inactivityTimeoutRef = useRef(null)

  useEffect(() => { onZenModeChange?.(isFocused) }, [isFocused, onZenModeChange])

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
    setPrompt(null)
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
    setIsFocused(false)
    setPrompt(null)
    actions.saveDiaryEntry(selectedDateRef.current, textRef.current, burstSec)
    setMode('preview')
  }

  // Salva anche lasciando la tab a metà scrittura (cambio pagina, chiusura
  // dell'app) — altrimenti quei minuti/quelle parole andrebbero perse senza
  // che l'utente se ne accorga. Ripristina anche la chrome dell'app (zen
  // mode), altrimenti uscendo dalla tab mentre si scrive header/bottom-nav
  // resterebbero nascosti anche nelle altre tab.
  useEffect(() => {
    return () => {
      if (burstStartRef.current != null) flushBurst()
      onZenModeChange?.(false)
    }
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

  const stats = computeDiaryStats(diaryLog)

  const historyDates = Object.keys(diaryLog)
    .filter(d => diaryLog[d]?.text && d !== selectedDate)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 30)

  if (!canEdit) {
    return <div className="empty-state">Il diario non è disponibile per questa vista</div>
  }

  return (
    <div style={{ padding: '16px 16px 90px' }}>
      {isFocused && (
        <button
          onClick={() => textareaRef.current?.blur()}
          title="Esci dalla modalità scrittura"
          style={{
            position: 'fixed', top: 10, right: 14, zIndex: 50,
            width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--card-solid)', border: '1px solid var(--card-border)', color: 'var(--text-sec)',
            cursor: 'pointer', fontSize: '1em', boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          }}
        >✕</button>
      )}

      {!isFocused && (
        <>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.15em', fontWeight: 800, color: stats.streak > 0 ? 'var(--success, #4caf50)' : 'var(--text)' }}>{stats.streak}g</div>
              <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>Streak</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.15em', fontWeight: 800, color: 'var(--text)' }}>{stats.bestStreak}g</div>
              <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>Record</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.15em', fontWeight: 800, color: 'var(--text)' }}>{stats.lifetimeWords}</div>
              <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>Parole totali</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.15em', fontWeight: 800, color: 'var(--text)' }}>{stats.lifetimeDays}</div>
              <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>Giorni scritti</div>
            </div>
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

          {mode === 'write' && (
            <div style={{ marginBottom: 14 }}>
              {prompt ? (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontSize: '0.88em', color: 'var(--text)', lineHeight: 1.4 }}>💡 {prompt.text}</div>
                    <button
                      onClick={() => setPrompt(null)}
                      title="Chiudi"
                      style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.9em', padding: 0, flexShrink: 0 }}
                    >✕</button>
                  </div>
                  <button
                    onClick={() => setPrompt(p => getRandomQuestion(p?.id))}
                    style={{ background: 'none', border: 'none', color: 'var(--theme-color)', cursor: 'pointer', fontSize: '0.76em', fontWeight: 700, padding: '6px 0 0' }}
                  >🔄 Un'altra domanda</button>
                </div>
              ) : (
                <button
                  onClick={() => setPrompt(getRandomQuestion())}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--text-sec)', fontWeight: 600, fontSize: '0.82em', cursor: 'pointer' }}
                >💡 Non so cosa scrivere...</button>
              )}
            </div>
          )}
        </>
      )}

      {isFocused && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, fontSize: '0.78em', color: 'var(--text-sec)', margin: '4px 0 12px', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: writing ? 'var(--theme-color)' : 'var(--text-sec)', fontWeight: 700 }}>{writing ? `✍️ ${fmtElapsed(elapsedSec)}` : '⏸️ in pausa'}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{liveWordCount} parole</span>
        </div>
      )}

      {mode === 'write' ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Scrivi qui... (- per un elenco puntato, 1. per uno numerato)"
          rows={isFocused ? 22 : 12}
          style={{
            width: '100%', padding: 14, borderRadius: 14, border: '1px solid var(--card-border)',
            background: 'var(--surface)', color: 'var(--text)', fontSize: '0.95em', boxSizing: 'border-box',
            resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, marginBottom: 10,
            transition: 'height 0.15s ease',
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
            onClick={() => {
              setMode('write')
              // Focus subito il campo: qui l'intenzione di scrivere è
              // esplicita (tasto premuto apposta), a differenza dell'apertura
              // della tab — lì niente autofocus, altrimenti la modalità zen
              // scatterebbe appena entri senza che tu l'abbia chiesto.
              setTimeout(() => textareaRef.current?.focus(), 0)
            }}
            style={{ width: '100%', padding: 10, marginTop: 8, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: '0.85em', cursor: 'pointer' }}
          >✏️ Continua a scrivere</button>
        </div>
      )}

      {!isFocused && historyDates.length > 0 && (
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
