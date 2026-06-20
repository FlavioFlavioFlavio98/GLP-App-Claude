import { useState, useRef, useEffect } from 'react'

export default function VoiceNoteModal({ itemId, itemType, itemName, existingNotes = [], onClose, onSave, onDelete, viewDate }) {
  const [phase, setPhase] = useState('idle') // idle | recording | processing | done
  const [transcript, setTranscript] = useState('')
  const [editedText, setEditedText] = useState('')
  const [costEUR, setCostEUR] = useState(null)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)

  // Close on ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase])

  function handleClose() {
    recognitionRef.current?.stop()
    onClose()
  }

  function startRecording() {
    setError(null)
    setTranscript('')
    setEditedText('')
    setCostEUR(null)

    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setError('Il tuo browser non supporta il riconoscimento vocale. Usa Chrome su Android.')
      return
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = 'it-IT'
    recognition.continuous = true
    recognition.interimResults = true

    let finalText = ''
    recognition.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      setTranscript(finalText + interim)
    }
    recognition.onerror = (e) => {
      setError('Errore microfono: ' + e.error)
      setPhase('idle')
    }
    recognition.onend = () => {
      // auto-stops if silence — stay in recording UI but show final text
      setTranscript(t => finalText || t)
    }

    recognition.start()
    recognitionRef.current = recognition
    setPhase('recording')
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    setPhase('processing')
    // Small delay to let onresult fire last time
    setTimeout(async () => {
      try {
        const rawText = transcript.trim()
        if (!rawText) {
          setError('Nessun testo rilevato. Riprova.')
          setPhase('idle')
          return
        }
        const result = await onSave(itemId, itemType, viewDate, rawText)
        setEditedText(result.text)
        setCostEUR(result.costEUR)
        setPhase('done')
      } catch (e) {
        setError('Errore: ' + (e.message || 'Riprova'))
        setPhase('idle')
      }
    }, 400)
  }

  const statusLabel = {
    idle: 'Tocca per registrare',
    recording: 'In ascolto...',
    processing: 'Elaborazione con Claude...',
    done: 'Pronto',
  }[phase]

  const sortedNotes = [...existingNotes].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'stretch',
      }}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card-solid, #1a1a2e)',
        borderRadius: '22px 22px 0 0',
        marginTop: 'max(5vh, 60px)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '1.05em', fontWeight: 700 }}>🎤 Nota Vocale</div>
            {itemName && <div style={{ fontSize: '0.75em', color: 'var(--text-sec, #888)', marginTop: 2 }}>{itemName}</div>}
          </div>
          <button onClick={handleClose} style={{
            background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text, #fff)',
            borderRadius: '50%', width: 34, height: 34, cursor: 'pointer',
            fontSize: '1em', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>

          {/* Mic area */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '24px 0 20px', gap: 14,
          }}>
            {/* Mic icon with pulse */}
            <div style={{ position: 'relative', width: 100, height: 100 }}>
              {phase === 'recording' && (
                <>
                  <div style={{
                    position: 'absolute', inset: -16, borderRadius: '50%',
                    background: 'var(--theme-color, #6c63ff)',
                    opacity: 0.15,
                    animation: 'voicePulse1 1.4s ease-out infinite',
                  }} />
                  <div style={{
                    position: 'absolute', inset: -8, borderRadius: '50%',
                    background: 'var(--theme-color, #6c63ff)',
                    opacity: 0.2,
                    animation: 'voicePulse2 1.4s ease-out infinite 0.3s',
                  }} />
                </>
              )}
              <div
                onClick={phase === 'idle' ? startRecording : phase === 'recording' ? stopRecording : undefined}
                style={{
                  width: 100, height: 100, borderRadius: '50%',
                  background: phase === 'recording'
                    ? 'var(--theme-color, #6c63ff)'
                    : phase === 'processing'
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.6em', cursor: phase === 'processing' ? 'default' : 'pointer',
                  transition: 'background 0.25s',
                  border: phase === 'recording' ? 'none' : '2px solid rgba(255,255,255,0.12)',
                  position: 'relative', zIndex: 1,
                  userSelect: 'none',
                }}
              >
                {phase === 'processing' ? '⏳' : '🎤'}
              </div>
            </div>

            {/* Status */}
            <div style={{
              fontSize: '0.85em', color: phase === 'recording' ? 'var(--theme-color, #6c63ff)' : '#888',
              fontWeight: phase === 'recording' ? 700 : 400,
              letterSpacing: '0.02em',
            }}>
              {statusLabel}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(229,57,53,0.12)', border: '1px solid rgba(229,57,53,0.3)',
              borderRadius: 10, padding: '10px 14px',
              color: '#e57373', fontSize: '0.82em', marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* Live transcript (while recording) */}
          {phase === 'recording' && (
            <div style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 12,
              padding: '12px 14px', fontSize: '0.9em', color: 'var(--text-sec, #aaa)',
              border: '1px solid rgba(255,255,255,0.08)', minHeight: 64, marginBottom: 16,
              lineHeight: 1.6,
            }}>
              {transcript || <span style={{ color: '#444' }}>Parla ora, vedi la trascrizione in tempo reale...</span>}
            </div>
          )}

          {/* Editable transcript (after processing) */}
          {phase === 'done' && (
            <>
              <div style={{ fontSize: '0.72em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>
                Trascrizione
              </div>
              <textarea
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12, padding: '12px 14px',
                  fontSize: '0.92em', color: 'var(--text, #fff)',
                  lineHeight: 1.6, resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              {costEUR != null && (
                <div style={{ fontSize: '0.7em', color: '#555', textAlign: 'right', marginTop: 6 }}>
                  Costo trascrizione: €{costEUR.toFixed(4)}
                </div>
              )}
            </>
          )}

          {/* Historic notes */}
          {sortedNotes.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: '0.7em', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                📝 Note precedenti ({sortedNotes.length})
              </div>
              {sortedNotes.map(note => (
                <div key={note.id} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12, padding: '12px 14px', marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.7em', color: 'var(--theme-color, #6c63ff)', fontWeight: 700 }}>
                      📅 {note.date}
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {note.costEUR > 0 && (
                        <span style={{ fontSize: '0.65em', color: '#444' }}>€{note.costEUR.toFixed(4)}</span>
                      )}
                      <button
                        onClick={() => onDelete && onDelete(note.id)}
                        style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '0.8em', padding: '2px 4px' }}
                      >🗑️</button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.86em', color: 'var(--text-sec, #aaa)', lineHeight: 1.6 }}>
                    {note.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ height: 100 }} />
        </div>

        {/* Fixed bottom action bar */}
        <div style={{
          flexShrink: 0,
          padding: '12px 20px max(20px, env(safe-area-inset-bottom, 20px))',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: 'var(--card-solid, #1a1a2e)',
          display: 'flex', gap: 10,
        }}>
          {(phase === 'idle' || phase === 'done') && (
            <button
              onClick={startRecording}
              style={{
                flex: 1, padding: '14px 0',
                background: 'var(--theme-color, #6c63ff)',
                border: 'none', borderRadius: 12,
                color: '#fff', fontWeight: 700, fontSize: '0.95em',
                cursor: 'pointer',
              }}
            >
              🎤 {phase === 'done' ? 'Nuova registrazione' : 'Registra'}
            </button>
          )}

          {phase === 'recording' && (
            <button
              onClick={stopRecording}
              style={{
                flex: 1, padding: '14px 0',
                background: '#e53935',
                border: 'none', borderRadius: 12,
                color: '#fff', fontWeight: 700, fontSize: '0.95em',
                cursor: 'pointer',
              }}
            >
              ■ Ferma e trascrivi
            </button>
          )}

          {phase === 'processing' && (
            <div style={{
              flex: 1, padding: '14px 0', textAlign: 'center',
              color: '#666', fontSize: '0.88em',
            }}>
              Elaborazione in corso...
            </div>
          )}

          {phase === 'done' && editedText && (
            <button
              onClick={handleClose}
              style={{
                padding: '14px 20px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, color: 'var(--text, #fff)',
                fontWeight: 600, fontSize: '0.88em', cursor: 'pointer',
              }}
            >
              💾 Salvata ✓
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes voicePulse1 {
          0%   { transform: scale(1);   opacity: 0.15; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes voicePulse2 {
          0%   { transform: scale(1);   opacity: 0.2; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
