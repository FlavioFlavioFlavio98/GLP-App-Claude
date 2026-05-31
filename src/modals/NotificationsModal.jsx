import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { requestNotificationPermission, sendTestNotification } from '../lib/fcm'

const DEFAULT_REMINDER = { id: '', time: '09:00', label: 'Reminder GLP', message: 'Come stai andando?' }

export default function NotificationsModal() {
  const { state, actions } = useApp()
  const { modal, currentUser } = state
  if (modal !== 'notifications') return null

  const [settings, setSettings] = useState(null)
  const [emailSettings, setEmailSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [permStatus, setPermStatus] = useState(Notification.permission || 'default')

  useEffect(() => {
    if (modal !== 'notifications') return
    setLoading(true)
    Promise.all([
      actions.loadNotificationSettings(currentUser),
      actions.loadEmailSettings(currentUser),
    ]).then(([ns, es]) => {
      setSettings(ns || { enabled: false, reminders: [], timezone: 'Europe/Rome', persistentEnabled: false })
      setEmailSettings(es || { enabled: false, address: '', lastBackupSent: null })
      setLoading(false)
    })
    setPermStatus(Notification.permission || 'default')
  }, [modal])

  async function handleRequestPermission() {
    const res = await requestNotificationPermission()
    setPermStatus(res)
    if (res === 'granted') {
      await actions.initFcmToken(currentUser)
      actions.showToast('Notifiche abilitate!', '🔔')
    }
  }

  async function saveSettings(newSettings) {
    setSettings(newSettings)
    await actions.saveNotificationSettings(currentUser, newSettings)
  }

  async function saveEmailSettings(newES) {
    setEmailSettings(newES)
    await actions.saveEmailSettings(currentUser, newES)
  }

  function addReminder() {
    if ((settings.reminders || []).length >= 5) return
    const id = Date.now().toString()
    saveSettings({ ...settings, reminders: [...(settings.reminders || []), { ...DEFAULT_REMINDER, id }] })
  }

  function removeReminder(id) {
    saveSettings({ ...settings, reminders: settings.reminders.filter(r => r.id !== id) })
  }

  function updateReminder(id, key, val) {
    saveSettings({
      ...settings,
      reminders: settings.reminders.map(r => r.id === id ? { ...r, [key]: val } : r),
    })
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
        <h3>🔔 Notifiche</h3>

        {/* Permission status */}
        {permStatus !== 'granted' && (
          <div style={{ background: 'rgba(239,159,39,0.1)', border: '1px solid #EF9F27', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: '0.85em', marginBottom: 8 }}>
              {permStatus === 'denied'
                ? '⛔ Notifiche bloccate dal browser. Abilita manualmente nelle impostazioni del browser.'
                : '📣 Abilita le notifiche per ricevere i reminder giornalieri.'}
            </div>
            {permStatus !== 'denied' && (
              <button className="btn-main" style={{ padding: '8px 16px', width: 'auto', marginTop: 0 }} onClick={handleRequestPermission}>
                Abilita notifiche
              </button>
            )}
          </div>
        )}

        {/* Global toggle */}
        <div className="settings-section">
          <div className="settings-section-title">Reminder giornalieri</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ fontSize: '0.9em' }}>Abilita reminder</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={settings.enabled} onChange={e => saveSettings({ ...settings, enabled: e.target.checked })} />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Persistent notification toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div style={{ fontSize: '0.9em' }}>Notifica persistente</div>
              <div style={{ fontSize: '0.7em', color: '#555' }}>Aggiornata ogni volta che usi l'app</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox"
                checked={settings.persistentEnabled || false}
                onChange={e => {
                  const enabled = e.target.checked
                  saveSettings({ ...settings, persistentEnabled: enabled })
                  localStorage.setItem('glp_persistent_notification', String(enabled))
                }}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* Reminders list */}
        {settings.enabled && (
          <div className="settings-section">
            <div className="settings-section-title">Orari reminder ({(settings.reminders || []).length}/5)</div>
            {(settings.reminders || []).map(r => (
              <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input
                    type="time"
                    value={r.time}
                    onChange={e => updateReminder(r.id, 'time', e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--theme-color)', padding: '4px 8px', fontWeight: 700, flex: '0 0 auto' }}
                  />
                  <input
                    type="text"
                    value={r.label}
                    onChange={e => updateReminder(r.id, 'label', e.target.value)}
                    placeholder="Titolo notifica"
                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.85em' }}
                  />
                  <button className="btn-icon" onClick={() => removeReminder(r.id)}>
                    <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--danger)' }}>delete</span>
                  </button>
                </div>
              </div>
            ))}
            {(settings.reminders || []).length < 5 && (
              <button className="btn-backup" onClick={addReminder}>
                <span className="material-icons-round" style={{ fontSize: 18 }}>add</span>
                Aggiungi reminder
              </button>
            )}
            <button className="btn-backup" onClick={() => sendTestNotification()}>
              <span className="material-icons-round" style={{ fontSize: 18 }}>notifications</span>
              Testa notifica
            </button>
          </div>
        )}

        {/* Email backup settings */}
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
