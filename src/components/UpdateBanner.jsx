import { useEffect, useState } from 'react'

export default function UpdateBanner() {
  const [show, setShow] = useState(false)
  const [registration, setRegistration] = useState(null)

  useEffect(() => {
    function onUpdate(e) {
      setShow(true)
      setRegistration(e.detail.registration)
    }
    window.addEventListener('swUpdateAvailable', onUpdate)
    return () => window.removeEventListener('swUpdateAvailable', onUpdate)
  }, [])

  function installUpdate() {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    } else {
      window.location.reload()
    }
  }

  if (!show) return null

  return (
    <div className="update-banner">
      <span className="material-icons-round" style={{ fontSize: 16, flexShrink: 0 }}>system_update</span>
      <span style={{ flex: 1 }}>Aggiornamento disponibile — tocca per installare</span>
      <button className="update-install-btn" onClick={installUpdate}>Installa</button>
      <button className="update-close-btn" onClick={() => setShow(false)}>✕</button>
    </div>
  )
}
