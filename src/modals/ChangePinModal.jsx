import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store'

const NUMPAD = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['','0','⌫'],
]

export default function ChangePinModal() {
  const { state, actions } = useApp()
  const { modal, correctPin } = state
  if (modal !== 'changePin') return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box" style={{ textAlign: 'center' }}>
        <h3>🔒 Cambia PIN</h3>
        <ChangePinFlow correctPin={correctPin} onDone={() => actions.closeModal()} />
      </div>
    </div>
  )
}

function ChangePinFlow({ correctPin, onDone }) {
  const { actions } = useApp()
  // step: 'verify' | 'new' | 'confirm'
  const [step, setStep] = useState('verify')
  const [digits, setDigits] = useState([])
  const [newPin, setNewPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const shakeRef = useRef(null)

  // Auto-check when 4 digits entered
  useEffect(() => {
    if (digits.length < 4) return
    const entered = digits.join('')

    if (step === 'verify') {
      if (entered === correctPin) {
        setStep('new'); setDigits([]); setError('')
      } else {
        triggerShake('PIN attuale errato')
      }
    } else if (step === 'new') {
      setNewPin(entered); setStep('confirm'); setDigits([]); setError('')
    } else if (step === 'confirm') {
      if (entered === newPin) {
        actions.saveNewPin(newPin)
        onDone()
      } else {
        triggerShake('I PIN non coincidono')
        setStep('new'); setNewPin('')
      }
    }
  }, [digits])

  function triggerShake(msg) {
    setError(msg); setShake(true)
    clearTimeout(shakeRef.current)
    shakeRef.current = setTimeout(() => { setShake(false); setDigits([]) }, 500)
  }

  function handleKey(key) {
    if (digits.length === 4) return
    if (key === '⌫') setDigits(d => d.slice(0, -1))
    else if (key) setDigits(d => [...d, key])
  }

  const stepLabel = {
    verify: 'PIN attuale',
    new: 'Nuovo PIN',
    confirm: 'Conferma nuovo PIN',
  }

  return (
    <div>
      <div style={{ fontSize: '0.85em', color: 'var(--theme-color)', marginBottom: 16 }}>
        {stepLabel[step]}
      </div>

      {/* Dots */}
      <div className={`pin-dots-sm${shake ? ' pin-dots-error' : ''}`} style={{ justifyContent: 'center', marginBottom: 16 }}>
        {[0,1,2,3].map(i => (
          <div key={i} className={`pin-dot${digits.length > i ? (shake ? ' filled error' : ' filled') : ''}`} />
        ))}
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: '0.82em', marginBottom: 12 }}>{error}</div>}

      {/* Compact numpad */}
      <div className="pin-numpad-sm">
        {NUMPAD.map((row, ri) => (
          <div className="pin-row" key={ri}>
            {row.map((key, ki) => (
              key === '' ? (
                <div key={ki} className="pin-key pin-key-empty pin-key-sm" />
              ) : (
                <button key={ki} className={`pin-key pin-key-sm${key === '⌫' ? ' pin-key-back' : ''}`} onClick={() => handleKey(key)}>
                  {key === '⌫' ? <span className="material-icons-round" style={{ fontSize: 18 }}>backspace</span> : key}
                </button>
              )
            ))}
          </div>
        ))}
      </div>

      <button className="btn-sec" onClick={onDone} style={{ marginTop: 8 }}>Annulla</button>
    </div>
  )
}
