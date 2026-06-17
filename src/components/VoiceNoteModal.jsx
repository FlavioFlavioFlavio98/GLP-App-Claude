import { useState, useRef } from 'react'

export default function VoiceNoteModal({ itemId, itemType, onClose, onSave, viewDate }) {
  const [phase, setPhase] = useState('idle') // idle | recording | processing | preview
  const [transcript, setTranscript] = useState('')
  const [cleanedText, setCleanedText] = useState('')
  const [costEUR, setCostEUR] = useState(null)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)

  function startRecording() {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setError('Il tuo browser non supporta il riconoscimento vocale. Usa Chrome.')
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
    recognition.onerror = (e) => setError('Errore: ' + e.error)
    recognition.start()
    recognitionRef.current = recognition
    setPhase('recording')
  }

  async function stopAndProcess() {
    recognitionRef.current?.stop()
    setPhase('processing')
    try {
      const result = await onSave(itemId, itemType, viewDate, transcript)
      setCleanedText(result.text)
      setCostEUR(result.costEUR)
      setPhase('preview')
    } catch (e) {
      setError('Errore nella trascrizione: ' + e.message)
      setPhase('idle')
    }
  }

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: 'flex-end', background: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: '100%', background: 'var(--card-solid)',
        borderRadius: '20px 20px 0 0', padding: '20px 20px 44px',
        animation: 'slideUp 0.22s ease',
      }}>
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 18px' }} />

        <div style={{ fontSize: '1em', fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>
          Nota vocale
        </div>

        {error && <div style={{ color: '#e53935', fontSize: '0.82em', marginBottom: 12 }}>{error}</div>}

        {phase === 'idle' && (
          <button className="btn-main" style={{ width: '100%', padding: 14 }} onClick={startRecording}>
            Inizia registrazione
          </button>
        )}

        {phase === 'recording' && (
          <>
            <div style={{
              minHeight: 80, background: 'rgba(255,255,255,0.04)', borderRadius: 10,
              padding: 12, fontSize: '0.88em', color: 'var(--text-sec)', marginBottom: 16,
              border: '1px solid rgba(255,0,0,0.3)'
            }}>
              {transcript || <span style={{ color: '#444' }}>Parla ora...</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e53935', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: '0.78em', color: '#888' }}>Registrazione in corso</span>
            </div>
            <button className="btn-main" style={{ width: '100%', padding: 14 }} onClick={stopAndProcess}>
              Ferma e trascrivi
            </button>
          </>
        )}

        {phase === 'processing' && (
          <div style={{ textAlign: 'center', padding: 24, color: '#888', fontSize: '0.88em' }}>
            Claude sta correggendo la trascrizione...
          </div>
        )}

        {phase === 'preview' && (
          <>
            <div style={{
              minHeight: 80, background: 'rgba(255,255,255,0.04)', borderRadius: 10,
              padding: 12, fontSize: '0.88em', color: 'var(--text)', marginBottom: 8,
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {cleanedText}
            </div>
            <div style={{ fontSize: '0.72em', color: '#555', marginBottom: 16, textAlign: 'right' }}>
              Costo trascrizione: EUR {costEUR?.toFixed(4) || '0.0000'}
            </div>
            <button className="btn-main" style={{ width: '100%', padding: 13 }} onClick={onClose}>
              Salvata - chiudi
            </button>
          </>
        )}
      </div>
    </div>
  )
}
