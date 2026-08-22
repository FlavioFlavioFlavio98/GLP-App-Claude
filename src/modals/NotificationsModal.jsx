import { useEffect, useState } from 'react'
import { useApp } from '../lib/store'

// Le notifiche/reminder sono gestite dall'app Android nativa (vedi sezioni
// "Notifiche Android" e "Reminder personalizzati" in Impostazioni) — più
// affidabili delle notifiche push web, che dipendevano da server/token/rete.
// Questa modale resta solo per il backup email, che non è una notifica.
export default function NotificationsModal() {
  const { state, actions } = useApp()
  const { modal, currentUser } = state
  if (modal !== 'notifications') return null

  const [emailSettings, setEmailSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (modal !== 'notifications') return
    setLoading(true)
    actions.loadEmailSettings(currentUser).then(es => {
      setEmailSettings(es || { enabled: false, address: '', lastBackupSent: null })
      setLoading(false)
    })
  }, [modal])

  async function saveEmailSettings(newES) {
    setEmailSettings(newES)
    await actions.saveEmailSettings(currentUser, newES)
  }

  async function handleSendBackupNow() {
    if (!emailSettings?.address) { actions.showToast('Imposta prima l\'email!', '❌'); return }
    actions.showToast('Invio backup...', '⏳')
    try {
      await actions.sendBackupNow(currentUser, emailSettings.address)
      actions.showToast('Backup inviato!', '✅')
    } catch (e) {
      actions.showToast('Errore invio — controlla le credenziali Gmail nelle Functions', '❌')
    }
  }

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-box" style={{ textAlign: 'center' }}>
          <div className="pin-spinner" style={{ margin: '20px auto' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <h3>📧 Backup email</h3>

        <div style={{ fontSize: '0.78em', color: '#666', marginBottom: 16 }}>
          Per notifiche e reminder vai in Impostazioni → sezioni "Notifiche Android" e "Reminder personalizzati" (disponibili sull'app Android).
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Backup email settimanale</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ fontSize: '0.9em' }}>Abilita backup automatico</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={emailSettings.enabled} onChange={e => saveEmailSettings({ ...emailSettings, enabled: e.target.checked })} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="input-group">
            <label>Email destinatario</label>
            <input type="email" placeholder="tua@email.com" value={emailSettings.address}
              onChange={e => saveEmailSettings({ ...emailSettings, address: e.target.value })} />
          </div>
          {emailSettings.lastBackupSent && (
            <div style={{ fontSize: '0.72em', color: '#555', marginBottom: 8 }}>
              Ultimo backup: {new Date(emailSettings.lastBackupSent).toLocaleString('it-IT')}
            </div>
          )}
          <button className="btn-backup" onClick={handleSendBackupNow} disabled={!emailSettings.address}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>send</span>
            Invia backup ora
          </button>
        </div>

        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}
