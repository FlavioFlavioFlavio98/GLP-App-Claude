import { useState, useRef } from 'react'
import { useApp } from '../lib/store'

export default function VoiceNotePage({ habit, onClose, viewDate }) {
  const { actions } = useApp()
  const [isRecording, setIsRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [cost, setCost] = useState(null)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)

  const habitId = habit.id || habit.name?.replace(/[^a-zA-Z0-9]/g, '')
  const voiceNotes = [...(habit.voiceNotes || [])].sort((a, b) => b.date.localeCompare(a.date))

  function startRecording() {
    setError(null)
    setTranscript('')
    setCost(null)

    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setError('Il tuo browser non supporta il riconoscimento vocale. Usa Chrome su Android.')
      return
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'it-IT'
    rec.continuous = true
    rec.interimResults = true

    let finalText = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      setTranscript(finalText + interim)
    }
    rec.onerror = (e) => {
      setError('Errore microfono: ' + e.error)
      setIsRecording(false)
    }

    rec.start()
    recognitionRef.current = { rec, getFinal: () => finalText }
    setIsRecording(true)
  }

  async function stopAndProcess() {
    const { rec, getFinal } = recognitionRef.current || {}
    rec?.stop()
    setIsRecording(false)
    setProcessing(true)

    setTimeout(async () => {
      try {
        const rawText = (getFinal?.() || transcript).trim()
        if (!rawText) {
          setError('Nessun testo rilevato. Riprova a parlare più vicino al microfono.')
          setProcessing(false)
          return
        }
        const result = await actions.saveVoiceNote(habitId, 'habit', viewDate, rawText)
        setTranscript(result.text)
        setCost(result.costEUR)
      } catch (e) {
        setError('Errore: ' + (e.message || 'Riprova'))
      } finally {
        setProcessing(false)
      }
    }, 400)
  }

  function handleRecord() {
    if (isRecording) stopAndProcess()
    else startRecording()
  }

  async function handleDelete(noteId) {
    await actions.deleteVoiceNote(habitId, 'habit', noteId)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg)',
      zIndex: 9999,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Header */}
      <div style={{
        padding: '16px 16px 14px',
        display: 'flex', alignItems: 'center', gap: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text)',
          fontSize: '1.5em', cursor: 'pointer', padding: '4px 8px 4px 0',
          lineHeight: 1,
        }}>←</button>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{habit.name}</div>
          <div style={{ fontSize: '0.8em', color: 'var(--text-sec)' }}>Diario vocale</div>
        </div>
      </div>

      {/* Recording area */}
      <div style={{ padding: '32px 16px 24px', textAlign: 'center', flexShrink: 0 }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {isRecording && (
            <>
              <div style={{
                position: 'absolute', inset: -20, borderRadius: '50%',
                background: 'var(--danger, #e53935)', opacity: 0.1,
                animation: 'vnPulse 1.2s ease-out infinite',
              }} />
              <div style={{
                position: 'absolute', inset: -10, borderRadius: '50%',
                background: 'var(--danger, #e53935)', opacity: 0.15,
                animation: 'vnPulse 1.2s ease-out infinite 0.25s',
              }} />
            </>
          )}
          <button
            onClick={handleRecord}
            disabled={processing}
            style={{
              width: '100px', height: '100px',
              borderRadius: '50%',
              background: isRecording
                ? 'var(--danger, #e53935)'
                : processing
                ? 'rgba(255,255,255,0.1)'
                : 'var(--theme-color)',
              border: 'none', cursor: processing ? 'default' : 'pointer',
              fontSize: '2.5em',
              position: 'relative', zIndex: 1,
              transition: 'background 0.2s',
              boxShadow: isRecording ? '0 0 0 4px rgba(229,57,53,0.25)' : 'none',
            }}
          >
            {processing ? '⏳' : '🎤'}
          </button>
        </div>

        <div style={{ marginTop: '16px', color: 'var(--text-sec)', fontSize: '0.9em' }}>
          {processing
            ? 'Claude sta correggendo la trascrizione...'
            : isRecording
            ? 'In ascolto... tocca per fermare'
            : 'Tocca per registrare'}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: '0 16px 16px',
          padding: '12px 14px',
          background: 'rgba(229,57,53,0.1)',
          border: '1px solid rgba(229,57,53,0.3)',
          borderRadius: 10, color: '#e57373', fontSize: '0.85em',
        }}>
          {error}
        </div>
      )}

      {/* Live transcript while recording */}
      {isRecording && transcript && (
        <div style={{
          margin: '0 16px 16px',
          padding: '14px',
          background: 'var(--card)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--text-sec)',
          fontSize: '0.92em',
          lineHeight: 1.6,
        }}>
          {transcript}
        </div>
      )}

      {/* Editable transcript after save */}
      {!isRecording && transcript && (
        <div style={{ margin: '0 16px', padding: '16px', background: 'var(--card)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.75em', color: 'var(--text-sec)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: 1 }}>Trascrizione</div>
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'transparent', border: 'none',
              color: 'var(--text)', fontSize: '1em',
              resize: 'none', outline: 'none', minHeight: '80px',
              fontFamily: 'inherit', lineHeight: 1.6,
            }}
          />
          {cost != null && (
            <div style={{ fontSize: '0.75em', color: 'var(--text-sec)', marginTop: '8px' }}>
              Costo trascrizione: €{cost.toFixed(4)}
            </div>
          )}
          <button
            onClick={startRecording}
            style={{
              width: '100%', padding: '12px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px', fontWeight: 600,
              cursor: 'pointer', marginTop: '12px',
              color: 'var(--text)', fontSize: '0.9em',
            }}
          >
            🎤 Nuova registrazione
          </button>
        </div>
      )}

      {/* Historic notes */}
      <div style={{ padding: '24px 16px 40px', flex: 1 }}>
        <div style={{ fontSize: '0.75em', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
          Note precedenti
        </div>
        {voiceNotes.length === 0 && (
          <div style={{ color: 'var(--text-sec)', textAlign: 'center', padding: '32px', fontSize: '0.9em' }}>
            Nessuna nota ancora
          </div>
        )}
        {voiceNotes.map(note => (
          <div key={note.id} style={{
            padding: '12px 14px',
            background: 'var(--card)',
            borderRadius: '10px', marginBottom: '10px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75em', color: 'var(--text-sec)' }}>{note.date}</span>
              {note.costEUR > 0 && (
                <span style={{ fontSize: '0.7em', color: '#555' }}>€{note.costEUR.toFixed(4)}</span>
              )}
            </div>
            <div style={{ fontSize: '0.95em', lineHeight: 1.6 }}>{note.text}</div>
            <button
              onClick={() => handleDelete(note.id)}
              style={{ background: 'none', border: 'none', color: 'var(--danger, #e53935)', cursor: 'pointer', fontSize: '0.8em', marginTop: '8px', padding: 0 }}
            >
              🗑️ Elimina
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes vnPulse {
          0%   { transform: scale(1);   opacity: 0.15; }
          100% { transform: scale(1.7); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
