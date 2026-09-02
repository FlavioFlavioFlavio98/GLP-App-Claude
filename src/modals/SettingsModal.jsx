import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { APP_VERSION, APP_UPDATED, APP_BUILD_TIME, APP_BUILD_HASH } from '../version'
import { getRestDuration, setRestDuration } from '../lib/workoutStats'
import { exportWorkoutCsv, exportWorkoutPdf } from '../lib/workoutExport'

const IS_NATIVE = !!window.Capacitor?.isNativePlatform?.()

const DEFAULT_NOTIF_SETTINGS = {
  habits:   { enabled: false, hour: 20, minute: 0 },
  tasks:    { enabled: false, hour: 18, minute: 0 },
  readings: { enabled: false, hour:  9, minute: 0 },
}

async function callNativeScheduler(settings) {
  if (!IS_NATIVE) return
  try {
    const { NotificationPlugin } = window.Capacitor.Plugins
    if (!NotificationPlugin) return
    // Richiedi permesso al primo utilizzo
    const perm = await NotificationPlugin.requestPermission()
    if (perm?.status === 'denied') {
      alert('Permesso notifiche negato. Abilitalo nelle impostazioni di sistema.')
      return
    }
    await NotificationPlugin.scheduleAll({ settings })
  } catch (e) {
    console.warn('NotificationPlugin error:', e)
  }
}

export default function SettingsModal({ onOpenPsych, onOpenReadings }) {
  const { state, actions } = useApp()
  const { modal, authUserId, allUsersData, currentUser, minimalMode, wakeLockEnabled, theme, lastDarkTheme } = state
  const supportsWakeLock = 'wakeLock' in navigator
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [restSeconds, setRestSeconds] = useState(() => getRestDuration())

  if (modal !== 'settings') return null

  function openAfter(name) {
    actions.closeModal()
    setTimeout(() => actions.openModal(name), 60)
  }

  function runAfterClose(fn) {
    actions.closeModal()
    setTimeout(fn, 60)
  }

  async function checkForUpdates() {
    setCheckingUpdate(true)
    try {
      const reg = window.__swRegistration
      if (!reg) {
        actions.showToast('Aggiornamento non disponibile, riprova più tardi', '⚠️')
        return
      }
      await reg.update()

      // sw.js chiama self.skipWaiting() in automatico all'installazione, quindi
      // un nuovo worker non resta mai fermo in stato "waiting" — passa subito
      // ad "activating". Il segnale affidabile di un aggiornamento reale è
      // quindi controllerchange (che main.jsx ascolta già e usa per ricaricare
      // la pagina da solo), non reg.waiting: controllare reg.waiting qui
      // faceva sì che il bottone dicesse sempre "già aggiornato", anche
      // quando un aggiornamento vero veniva scaricato e installato.
      const updated = await new Promise(resolve => {
        let done = false
        const onChange = () => { if (!done) { done = true; resolve(true) } }
        navigator.serviceWorker.addEventListener('controllerchange', onChange, { once: true })
        setTimeout(() => {
          if (!done) {
            done = true
            navigator.serviceWorker.removeEventListener('controllerchange', onChange)
            resolve(false)
          }
        }, 3000)
      })

      if (updated) {
        actions.showToast('Aggiornamento trovato, ricarico...', '🔄')
        // Il reload arriva da solo dal listener controllerchange in main.jsx
      } else {
        actions.showToast('Sei già all\'ultima versione ✓', '✅')
      }
    } catch (e) {
      actions.showToast('Errore nel controllo aggiornamenti', '⚠️')
    } finally {
      setCheckingUpdate(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <h3>⚙️ Impostazioni</h3>

        {/* PROFILO */}
        <div className="settings-section">
          <div className="settings-section-title">Profilo Utente</div>
          {/* Avatar button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 6 }}>
            <div style={{ fontSize: '2em', width: 40, textAlign: 'center' }}>
              {allUsersData[authUserId]?.profile?.avatar || (authUserId === 'flavio' ? '🔥' : '⭐')}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82em', fontWeight: 600 }}>Avatar</div>
              <div style={{ fontSize: '0.68em', color: '#666' }}>Emoji personalizzata nell'header</div>
            </div>
            <button className="btn-icon" onClick={() => openAfter('avatar')} title="Modifica avatar">
              <span className="material-icons-round" style={{ fontSize: 20 }}>edit</span>
            </button>
          </div>
        </div>

        {/* ASPETTO */}
        <div className="settings-section">
          <div className="settings-section-title">Aspetto</div>
          <button className="btn-backup" onClick={() => openAfter('themeModal')}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>palette</span>
            Temi
          </button>
          <ToggleRow
            label="Modalità chiara"
            sublabel="Passa dal tema scuro a quello chiaro"
            icon={theme === 'light' ? 'light_mode' : 'dark_mode'}
            value={theme === 'light'}
            onChange={v => actions.setTheme(v ? 'light' : (lastDarkTheme || 'dark'))}
          />
        </div>

        {/* TROFEI */}
        <div className="settings-section">
          <div className="settings-section-title">Progressi</div>
          <button className="btn-backup" onClick={() => openAfter('achievements')}>
            <span style={{ fontSize: '1.1em' }}>🏆</span>
            Trofei e obiettivi
          </button>
        </div>

        {/* NOTIFICHE */}
        <div className="settings-section">
          <div className="settings-section-title">Notifiche & Backup</div>
          <button className="btn-backup" onClick={() => openAfter('notifications')}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>notifications</span>
            Notifiche & Backup email
          </button>
        </div>

        {/* ALLENAMENTO — solo Flavio */}
        {authUserId === 'flavio' && (
          <div className="settings-section">
            <div className="settings-section-title">🏋️ Allenamento</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85em', fontWeight: 600 }}>Intervallo beep recupero</div>
                <div style={{ fontSize: '0.68em', color: '#555' }}>Un beep ogni N secondi dall'ultima serie (2° beep doppio, 3° triplo...)</div>
              </div>
              <input
                type="number"
                min={10}
                step={5}
                value={restSeconds}
                onChange={e => {
                  const n = parseInt(e.target.value) || 0
                  setRestSeconds(n)
                  if (n >= 10) setRestDuration(n)
                }}
                style={{
                  width: 64, padding: '8px 10px', borderRadius: 8, textAlign: 'center',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--text)', fontSize: '0.9em',
                }}
              />
              <span style={{ fontSize: '0.78em', color: '#666' }}>sec</span>
            </div>

            <WorkoutExportSection
              exerciseLog={allUsersData?.flavio?.exerciseLog || {}}
              quickExercises={allUsersData?.flavio?.quickExercises || []}
              mobilityLog={allUsersData?.flavio?.mobilityLog || {}}
              barefootLog={allUsersData?.flavio?.barefootLog || {}}
              hangLog={allUsersData?.flavio?.hangLog || {}}
              sunExposureLog={allUsersData?.flavio?.sunExposureLog || {}}
              mindSocialLog={allUsersData?.flavio?.mindSocialLog || {}}
              themeId={theme}
              actions={actions}
            />

          </div>
        )}

        {/* PESO + USO APP — solo Flavio */}
        {authUserId === 'flavio' && (
          <div className="settings-section">
            <div className="settings-section-title">Salute & Statistiche Personali</div>
            <button className="btn-backup" onClick={() => openAfter('weight')}>
              <span style={{ fontSize: '1.1em' }}>⚖️</span>
              Tracciamento Peso
            </button>
            <button className="btn-backup" onClick={() => openAfter('appUsage')}>
              <span style={{ fontSize: '1.1em' }}>📱</span>
              Statistiche Uso App
            </button>
            <button className="btn-backup" onClick={() => openAfter('quotesModal')}>
              <span style={{ fontSize: '1.1em' }}>💬</span>
              Aforismi
            </button>
          </div>
        )}

        {/* COACH AI — solo Flavio */}
        {authUserId === 'flavio' && (
          <div className="settings-section">
            <div className="settings-section-title">🤖 Coach AI</div>
            <button className="btn-backup" onClick={() => openAfter('coach')}>
              <span style={{ fontSize: '1.1em' }}>🤖</span>
              Apri Coach AI
            </button>
          </div>
        )}

        {/* LETTURE */}
        {onOpenReadings && (
          <div className="settings-section">
            <div className="settings-section-title">📚 Letture</div>
            <button className="btn-backup" onClick={() => runAfterClose(onOpenReadings)}>
              <span style={{ fontSize: '1.1em' }}>📚</span>
              Apri Letture
            </button>
          </div>
        )}

        {/* PSICOLOGO AI — solo Flavio */}
        {authUserId === 'flavio' && (
          <div className="settings-section">
            <div className="settings-section-title">💭 Psicologo AI</div>
            {onOpenPsych && (
              <button className="btn-backup" onClick={() => runAfterClose(onOpenPsych)} style={{ marginBottom: 10 }}>
                <span style={{ fontSize: '1.1em' }}>💭</span>
                Apri Psicologo AI
              </button>
            )}
            {(() => {
              const ps = allUsersData?.flavio?.psychStats || {}
              return (
                <div style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px' }}>
                  <PsychStatRow label="Sessioni totali" value={ps.totalSessions || 0} />
                  <PsychStatRow label="Messaggi totali" value={ps.totalMessages || 0} />
                  <PsychStatRow label="Token lifetime" value={(ps.totalTokensLifetime || 0).toLocaleString()} />
                  <PsychStatRow label="Costo totale" value={`€${(ps.totalCostEURLifetime || 0).toFixed(4)}`} />
                </div>
              )
            })()}
          </div>
        )}

        {/* NOTIFICHE ANDROID */}
        <NotificationSection globalData={state.globalData} authUserId={authUserId} actions={actions} />
        <CustomRemindersSection />

        {/* MODALITÀ */}
        <div className="settings-section">
          <div className="settings-section-title">Modalità</div>
          <ToggleRow
            label="Modalità minimalista"
            sublabel="Mostra solo abitudini e task non completate"
            icon="filter_list"
            value={minimalMode}
            onChange={v => actions.setMinimalMode(v)}
          />
          {supportsWakeLock && (
            <ToggleRow
              label="🔆 Schermo sempre acceso"
              sublabel="Mantiene lo schermo attivo mentre usi l'app"
              icon={null}
              value={wakeLockEnabled}
              onChange={v => actions.setWakeLockEnabled(v)}
            />
          )}
        </div>

        {/* STORICO */}
        <div className="settings-section">
          <div className="settings-section-title">Storico & Diari</div>
          <button className="btn-backup" onClick={() => openAfter('weeklyView')}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>calendar_view_week</span>
            Dashboard Settimanale
          </button>
          <button className="btn-backup" onClick={() => openAfter('purchaseHistory')}>
            <span style={{ fontSize: '1em' }}>🛍️</span>
            Storico acquisti
          </button>
          <button className="btn-backup" onClick={() => openAfter('journal')}>
            <span style={{ fontSize: '1em' }}>📔</span>
            Diario di oggi
          </button>
          <button className="btn-backup" onClick={() => openAfter('journalView')}>
            <span style={{ fontSize: '1em' }}>📔</span>
            Il mio diario
          </button>
          <button className="btn-backup" onClick={() => openAfter('activityLog')}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>history</span>
            Storico Modifiche
          </button>
        </div>

        {/* STATISTICHE */}
        <div className="settings-section">
          <div className="settings-section-title">Statistiche</div>
          <button className="btn-backup" onClick={() => openAfter('statsPage')}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>bar_chart</span>
            📊 Statistiche Complete
          </button>
          <button className="btn-backup" onClick={() => openAfter('analytics')}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>show_chart</span>
            Analisi Rapida
          </button>
          <button className="btn-backup" onClick={() => openAfter('tags')}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>label</span>
            Gestione Tag
          </button>
          <button className="btn-backup" onClick={() => openAfter('rewardCategories')}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>category</span>
            Categorie Premi
          </button>
        </div>

        {/* BACKUP & DATI */}
        <div className="settings-section">
          <div className="settings-section-title">Dati</div>
          <button className="btn-backup" onClick={() => openAfter('backup')}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>folder_zip</span>
            📦 Backup e Dati
          </button>
          <button className="btn-backup" onClick={actions.forceRecalculateScore} style={{ marginTop: 8 }}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>calculate</span>
            🔄 Verifica punteggio
          </button>
          <button
            className="btn-backup"
            style={{ marginTop: 8 }}
            onClick={() => {
              const logs = (allUsersData[currentUser]?.dailyLogs) || {}
              const dates = ['2026-06-06','2026-06-07','2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']
              dates.forEach(d => {
                console.log(`=== ${d} ===`, JSON.stringify(logs[d] || null, null, 2))
              })
              console.log('=== ALL KEYS in dailyLogs ===', Object.keys(logs))
            }}
          >
            <span className="material-icons-round" style={{ fontSize: 18 }}>search</span>
            Debug dailyLogs (console)
          </button>
          <button
            className="btn-backup"
            style={{ marginTop: 8 }}
            onClick={() => {
              const logs = (allUsersData[currentUser]?.dailyLogs) || {}
              const dates = ['2026-06-07','2026-06-10','2026-06-11']
              let output = ''
              dates.forEach(d => {
                const entry = logs[d]
                if (entry) {
                  output += `\n${d}: keys=[${Object.keys(entry).join(',')}]`
                  if (entry.trackedRewards) output += ` trackedRewards=${JSON.stringify(entry.trackedRewards)}`
                  if (entry.trackedPurchases) output += ` trackedPurchases=${JSON.stringify(entry.trackedPurchases)}`
                  Object.keys(entry).filter(k => k.toLowerCase().includes('track') || k.toLowerCase().includes('vape') || k.toLowerCase().includes('reward')).forEach(k => {
                    output += ` [${k}]=${JSON.stringify(entry[k])}`
                  })
                } else {
                  output += `\n${d}: nessun dato`
                }
              })
              alert('DailyLogs premi tracciati:\n' + output)
            }}
          >
            <span className="material-icons-round" style={{ fontSize: 18 }}>visibility</span>
            Mostra premi tracciati (06-07/10/11)
          </button>
          <button
            className="btn-backup"
            style={{ marginTop: 8, borderColor: '#e67e22', color: '#e67e22' }}
            onClick={async () => {
              const rewards = allUsersData[currentUser]?.rewards || []
              const rewardNames = rewards.map(r => `${r.id}: ${r.name}`).join('\n')
              const rewardId = window.prompt(`ID del premio da correggere:\n(premi disponibili)\n${rewardNames}`)
              if (!rewardId) return
              const dateStr = window.prompt('Data (es. 2026-06-07):')
              if (!dateStr) return
              const qty = window.prompt('Quantità:')
              if (qty === null) return
              await actions.patchTrackedRewardManual(rewardId.trim(), dateStr.trim(), parseInt(qty) || 0)
            }}
          >
            <span className="material-icons-round" style={{ fontSize: 18 }}>build</span>
            Correggi premio tracciato manuale
          </button>
        </div>

        {/* LOGOUT */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            className="btn-danger"
            style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#aaa', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
            onClick={() => { actions.closeModal(); setTimeout(() => actions.logout(), 50) }}
          >
            <span className="material-icons-round" style={{ fontSize: 18 }}>logout</span>
            Esci dall'account
          </button>
          <div style={{ fontSize: '0.68em', color: '#444', textAlign: 'center', marginTop: 6 }}>
            Accesso tramite Google — {authUserId}
          </div>
        </div>

        {/* INFORMAZIONI */}
        <div className="settings-section" style={{ marginTop: 20 }}>
          <div className="settings-section-title">Informazioni</div>
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82em', color: '#666' }}>
              <span>Versione</span><span style={{ color: 'var(--theme-color)', fontWeight: 600 }}>{APP_VERSION}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78em', color: '#555', marginTop: 4 }}>
              <span>Ultimo aggiornamento</span><span>{APP_UPDATED}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72em', color: '#3a3a3a', marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <span>Build</span>
              <span style={{ fontFamily: 'monospace', letterSpacing: 0 }}>
                {APP_BUILD_TIME} · {APP_BUILD_HASH}
              </span>
            </div>
          </div>
          <button className="btn-backup" onClick={checkForUpdates} disabled={checkingUpdate} style={{ marginTop: 8 }}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>system_update</span>
            {checkingUpdate ? 'Controllo in corso...' : 'Controlla aggiornamenti'}
          </button>
        </div>

        {authUserId === 'flavio' && (
          <BackupEntrySection
            lastDataExportAt={allUsersData?.flavio?.lastDataExportAt}
            onOpen={() => openAfter('backup')}
          />
        )}

        {authUserId === 'flavio' && <DangerZoneSection actions={actions} />}

        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}

// ─── Notifiche Android ────────────────────────────────────────────────────────

function NotificationSection({ globalData, authUserId, actions }) {
  const [settings, setSettings] = useState(DEFAULT_NOTIF_SETTINGS)
  const [saving, setSaving] = useState(false)

  // Carica impostazioni da globalData al mount
  useEffect(() => {
    const saved = globalData?.notificationSettings
    if (saved) {
      setSettings(prev => ({
        habits:   { ...prev.habits,   ...saved.habits },
        tasks:    { ...prev.tasks,    ...saved.tasks },
        readings: { ...prev.readings, ...saved.readings },
      }))
    }
  }, [globalData?.notificationSettings]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(next) {
    setSettings(next)
    setSaving(true)
    try {
      // Salva su Firestore per backup/sync
      await actions.saveNotificationSettings(next)
      // Programma gli allarmi nativi
      await callNativeScheduler(next)
    } finally {
      setSaving(false)
    }
  }

  function updateType(type, patch) {
    save({ ...settings, [type]: { ...settings[type], ...patch } })
  }

  function timeToHM(timeStr) {
    const [h, m] = (timeStr || '00:00').split(':').map(Number)
    return { hour: h || 0, minute: m || 0 }
  }

  function hmToTime(hour, minute) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }

  const TYPES = [
    { key: 'habits',   label: 'Abitudini non completate', icon: '💪', defaultTime: '20:00' },
    { key: 'tasks',    label: 'Task in scadenza oggi',     icon: '📋', defaultTime: '18:00' },
    { key: 'readings', label: 'Letture da ripassare',      icon: '📚', defaultTime: '09:00' },
  ]

  return (
    <div className="settings-section">
      <div className="settings-section-title">🔔 Notifiche Android</div>

      {!IS_NATIVE && (
        <div style={{
          padding: '10px 12px', borderRadius: 10, fontSize: '0.78em',
          background: 'rgba(255,255,255,0.04)', color: '#666',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          Disponibile solo sull'app Android
        </div>
      )}

      {IS_NATIVE && TYPES.map(({ key, label, icon, defaultTime }) => {
        const s = settings[key]
        const timeVal = hmToTime(s.hour, s.minute) || defaultTime
        return (
          <div key={key} style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            marginTop: 8, paddingTop: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85em', fontWeight: 600 }}>{label}</div>
              </div>
              {/* Toggle */}
              <button
                onClick={() => updateType(key, { enabled: !s.enabled })}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: s.enabled ? 'var(--theme-color)' : 'rgba(255,255,255,0.1)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, transition: 'left 0.2s',
                  left: s.enabled ? 23 : 3,
                }} />
              </button>
            </div>
            {s.enabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 28 }}>
                <span style={{ fontSize: '0.75em', color: '#666' }}>Orario:</span>
                <input
                  type="time"
                  value={timeVal}
                  onChange={e => {
                    const { hour, minute } = timeToHM(e.target.value)
                    updateType(key, { hour, minute })
                  }}
                  style={{
                    padding: '4px 8px', borderRadius: 8, fontSize: '0.85em',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: 'var(--text)',
                    colorScheme: 'dark',
                  }}
                />
                {saving && <span style={{ fontSize: '0.7em', color: '#666' }}>⏳</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Reminder personalizzati (testo libero) — sostituiscono le notifiche push
// web (rimosse: dipendevano da server/token, meno affidabili delle notifiche
// locali native già usate sopra per abitudini/task/letture).
function CustomRemindersSection() {
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!IS_NATIVE) { setLoading(false); return }
    const { NotificationPlugin } = window.Capacitor.Plugins
    if (!NotificationPlugin) { setLoading(false); return }
    NotificationPlugin.getCustomReminders()
      .then(res => setReminders(res?.reminders || []))
      .finally(() => setLoading(false))
  }, [])

  async function persist(next) {
    setReminders(next)
    if (!IS_NATIVE) return
    try {
      const { NotificationPlugin } = window.Capacitor.Plugins
      if (!NotificationPlugin) return
      const perm = await NotificationPlugin.requestPermission()
      if (perm?.status === 'denied') {
        alert('Permesso notifiche negato. Abilitalo nelle impostazioni di sistema.')
        return
      }
      await NotificationPlugin.saveCustomReminders({ reminders: next })
    } catch (e) {
      console.warn('NotificationPlugin saveCustomReminders error:', e)
    }
  }

  function addReminder() {
    if (reminders.length >= 10) return
    persist([...reminders, {
      id: Date.now().toString(),
      title: 'Promemoria GLP',
      message: '',
      hour: 9, minute: 0,
      enabled: true,
    }])
  }

  function updateReminder(id, patch) {
    persist(reminders.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function removeReminder(id) {
    persist(reminders.filter(r => r.id !== id))
  }

  if (loading) return null

  return (
    <div className="settings-section">
      <div className="settings-section-title">⏰ Reminder personalizzati</div>

      {!IS_NATIVE ? (
        <div style={{
          padding: '10px 12px', borderRadius: 10, fontSize: '0.78em',
          background: 'rgba(255,255,255,0.04)', color: '#666',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          Disponibile solo sull'app Android
        </div>
      ) : (
        <>
          {reminders.map(r => (
            <div key={r.id} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '10px 12px', marginBottom: 8,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input
                  type="time"
                  value={`${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`}
                  onChange={e => {
                    const [h, m] = e.target.value.split(':').map(Number)
                    updateReminder(r.id, { hour: h || 0, minute: m || 0 })
                  }}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--theme-color)', padding: '4px 8px', fontWeight: 700, flex: '0 0 auto' }}
                />
                <input
                  type="text"
                  value={r.title}
                  onChange={e => updateReminder(r.id, { title: e.target.value })}
                  placeholder="Titolo"
                  style={{ flex: 1, padding: '4px 8px', fontSize: '0.85em' }}
                />
                <button
                  onClick={() => updateReminder(r.id, { enabled: !r.enabled })}
                  style={{
                    width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                    background: r.enabled ? 'var(--theme-color)' : 'rgba(255,255,255,0.1)',
                    position: 'relative', flexShrink: 0,
                  }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: r.enabled ? 21 : 3, transition: 'left 0.2s' }} />
                </button>
                <button className="btn-icon" onClick={() => removeReminder(r.id)}>
                  <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--danger)' }}>delete</span>
                </button>
              </div>
              <input
                type="text"
                value={r.message}
                onChange={e => updateReminder(r.id, { message: e.target.value })}
                placeholder="Testo del promemoria (es. Bevi un bicchiere d'acqua)"
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.8em', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          {reminders.length < 10 && (
            <button className="btn-backup" onClick={addReminder}>
              <span className="material-icons-round" style={{ fontSize: 18 }}>add</span>
              Aggiungi reminder
            </button>
          )}
        </>
      )}
    </div>
  )
}

function PsychStatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85em' }}>
      <span style={{ color: 'var(--text-sec)' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  )
}

function ToggleRow({ label, sublabel, icon, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 6 }}>
      {icon && <span className="material-icons-round" style={{ fontSize: 20, color: '#666', width: 24, textAlign: 'center' }}>{icon}</span>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.85em', fontWeight: 600 }}>{label}</div>
        {sublabel && <div style={{ fontSize: '0.68em', color: '#555' }}>{sublabel}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: value ? 'var(--theme-color)' : 'rgba(255,255,255,0.1)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3, transition: 'left 0.2s',
          left: value ? 23 : 3,
        }} />
      </button>
    </div>
  )
}

// ─── Backup manuale: entry point verso il modale "Backup e Dati" ──────────────
// Il modale (BackupModal.jsx, azione store.exportData) esisteva già da una
// sessione precedente ma non era collegato a nessun pulsante — orfano,
// irraggiungibile dall'app. Qui si aggiunge solo il punto d'accesso e lo
// stato "da quanto non fai un backup", che legge lastDataExportAt scritto da
// exportData al termine di ogni export riuscito.

function daysSince(isoDate) {
  if (!isoDate) return null
  const diffMs = Date.now() - new Date(isoDate).getTime()
  return Math.floor(diffMs / 86400000)
}

function BackupEntrySection({ lastDataExportAt, onOpen }) {
  const days = daysSince(lastDataExportAt)
  return (
    <div className="settings-section" style={{ marginTop: 24 }}>
      <div className="settings-section-title">💾 Backup e Dati</div>
      <p style={{ fontSize: '0.75em', color: '#888', margin: '2px 0 10px' }}>
        {lastDataExportAt
          ? `Ultimo backup scaricato ${days === 0 ? 'oggi' : `${days} giorn${days === 1 ? 'o' : 'i'} fa`}`
          : 'Nessun backup scaricato finora'}
      </p>
      <button className="btn-backup" onClick={onOpen}>
        <span className="material-icons-round" style={{ fontSize: 18 }}>download</span>
        Backup / Ripristino dati
      </button>
    </div>
  )
}

// ─── Zona Pericolosa: reset completo dati account ─────────────────────────────

const RESET_CONFIRM_WORD = 'CANCELLA'

function DangerZoneSection({ actions }) {
  // step: null | 'warning' | 'confirm' | 'loading' | 'done'
  const [step, setStep] = useState(null)
  const [confirmText, setConfirmText] = useState('')
  const [result, setResult] = useState(null)

  function openFlow() { setStep('warning') }
  function cancelFlow() { setStep(null); setConfirmText(''); setResult(null) }

  async function runReset() {
    setStep('loading')
    const res = await actions.resetAllUserData()
    setResult(res)
    setStep('done')
  }

  return (
    <>
      <div className="settings-section" style={{
        marginTop: 24, border: '1px solid rgba(239,83,80,0.35)', borderRadius: 12,
        padding: '14px 16px', background: 'rgba(239,83,80,0.05)',
      }}>
        <div className="settings-section-title" style={{ color: 'var(--danger)' }}>⚠️ Zona Pericolosa</div>
        <p style={{ fontSize: '0.75em', color: '#888', margin: '2px 0 10px' }}>
          Azioni distruttive e irreversibili. Procedi solo se sei sicuro.
        </p>
        <button className="btn-danger" onClick={openFlow}>
          🗑️ Resetta completamente l'app
        </button>
      </div>

      {step && step !== null && (
        <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={e => { if (e.target === e.currentTarget && step === 'warning') cancelFlow() }}>
          <div className="modal-box">

            {step === 'warning' && (
              <>
                <h3 style={{ color: 'var(--danger)' }}>⚠️ Resettare completamente l'app?</h3>
                <p style={{ fontSize: '0.85em', color: 'var(--text)', marginBottom: 8 }}>
                  Questa azione è <strong>IRREVERSIBILE</strong>. Tutti i tuoi dati verranno cancellati permanentemente e non potranno essere recuperati:
                </p>
                <ul style={{ fontSize: '0.8em', color: 'var(--text-sec)', margin: '0 0 14px', paddingLeft: 20, lineHeight: 1.7 }}>
                  <li>Tutte le abitudini e i premi</li>
                  <li>Tutte le task (attive, completate, scadute)</li>
                  <li>Lo storico giornaliero completo (mood, energia, note)</li>
                  <li>La cronologia del peso</li>
                  <li>Le letture caricate e i relativi PDF</li>
                  <li>Punteggio, livello, streak, trofei sbloccati</li>
                  <li>Diario, memoria del Coach AI, statistiche Psicologo AI</li>
                  <li>Tutte le impostazioni personali (tema, notifiche, ecc.)</li>
                </ul>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn-backup" onClick={cancelFlow} style={{ fontWeight: 700 }}>
                    Annulla
                  </button>
                  <button
                    onClick={() => setStep('confirm')}
                    style={{
                      width: '100%', padding: '10px', background: 'transparent',
                      color: 'var(--danger)', border: '1px solid rgba(239,83,80,0.3)',
                      borderRadius: 8, cursor: 'pointer', fontSize: '0.85em',
                    }}
                  >
                    Continua
                  </button>
                </div>
              </>
            )}

            {step === 'confirm' && (
              <>
                <h3 style={{ color: 'var(--danger)' }}>Ultima conferma</h3>
                <p style={{ fontSize: '0.85em', color: 'var(--text-sec)', marginBottom: 12 }}>
                  Per confermare, scrivi <strong style={{ color: 'var(--danger)' }}>{RESET_CONFIRM_WORD}</strong> nel campo qui sotto.
                </p>
                <input
                  type="text"
                  autoFocus
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={RESET_CONFIRM_WORD}
                  style={{
                    width: '100%', padding: '10px 12px', marginBottom: 14, boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(239,83,80,0.3)',
                    borderRadius: 8, color: 'var(--text)', fontSize: '0.9em',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn-backup" onClick={cancelFlow} style={{ fontWeight: 700 }}>
                    Annulla
                  </button>
                  <button
                    onClick={runReset}
                    disabled={confirmText !== RESET_CONFIRM_WORD}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 8, fontSize: '0.85em',
                      cursor: confirmText === RESET_CONFIRM_WORD ? 'pointer' : 'not-allowed',
                      background: confirmText === RESET_CONFIRM_WORD ? 'var(--danger)' : 'rgba(255,255,255,0.06)',
                      color: confirmText === RESET_CONFIRM_WORD ? '#fff' : '#555',
                      border: confirmText === RESET_CONFIRM_WORD ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      fontWeight: 700, transition: 'all 0.15s',
                    }}
                  >
                    Cancella tutto definitivamente
                  </button>
                </div>
              </>
            )}

            {step === 'loading' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: 36, height: 36, margin: '0 auto 16px', borderRadius: '50%',
                  border: '3px solid rgba(239,83,80,0.2)', borderTopColor: 'var(--danger)',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <p style={{ fontSize: '0.85em', color: 'var(--text-sec)' }}>
                  Cancellazione in corso... può richiedere qualche secondo.
                </p>
              </div>
            )}

            {step === 'done' && (
              <>
                {result?.success ? (
                  <>
                    <h3 style={{ color: 'var(--success, #4caf50)' }}>✅ Reset completato</h3>
                    <p style={{ fontSize: '0.85em', color: 'var(--text-sec)', marginBottom: 16 }}>
                      L'app è stata riportata allo stato iniziale. Verrai reindirizzato alla tab Oggi.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 style={{ color: '#EF9F27' }}>⚠️ Reset completato con avvisi</h3>
                    <p style={{ fontSize: '0.85em', color: 'var(--text-sec)', marginBottom: 8 }}>
                      Alcuni elementi non sono stati eliminati correttamente:
                    </p>
                    <ul style={{ fontSize: '0.75em', color: 'var(--text-sec)', margin: '0 0 16px', paddingLeft: 18, maxHeight: 160, overflowY: 'auto' }}>
                      {result?.errors?.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </>
                )}
                <button
                  className="btn-backup"
                  onClick={() => window.location.reload()}
                  style={{ fontWeight: 700 }}
                >
                  Continua
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
}

// ─── Esportazione allenamenti (PDF leggibile o CSV per Google Sheets) ──────────
function WorkoutExportSection({ exerciseLog, quickExercises, mobilityLog, barefootLog, hangLog, sunExposureLog, mindSocialLog, themeId, actions }) {
  const [exporting, setExporting] = useState(null) // null | 'pdf' | 'csv'

  const hasData = Object.keys(exerciseLog || {}).length > 0
    || Object.keys(mobilityLog || {}).length > 0
    || Object.keys(barefootLog || {}).length > 0
    || Object.keys(hangLog || {}).length > 0
    || Object.keys(sunExposureLog || {}).length > 0
    || Object.keys(mindSocialLog || {}).length > 0

  async function handleExport(format) {
    if (!hasData) { actions.showToast('Nessun dato da esportare', '⚠️'); return }
    setExporting(format)
    const payload = { exerciseLog, quickExercises, mobilityLog, barefootLog, hangLog, sunExposureLog, mindSocialLog }
    try {
      if (format === 'pdf') await exportWorkoutPdf({ ...payload, themeId })
      else exportWorkoutCsv(payload)
      actions.showToast('Esportazione completata', '📤')
    } catch (e) {
      console.error('[export workout]', e)
      actions.showToast('Errore durante l\'esportazione', '❌')
    }
    setExporting(null)
  }

  return (
    <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: '0.85em', fontWeight: 600, marginBottom: 2 }}>Esporta allenamenti & benessere</div>
      <div style={{ fontSize: '0.68em', color: '#555', marginBottom: 10 }}>PDF leggibile con riepilogo e grafici, o CSV dettagliato per Google Sheets — include anche mobility, barefoot, hang, sole e social</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn-backup"
          style={{ flex: 1 }}
          disabled={!!exporting}
          onClick={() => handleExport('pdf')}
        >
          <span style={{ fontSize: '1.1em' }}>📄</span>
          {exporting === 'pdf' ? 'Genero...' : 'PDF'}
        </button>
        <button
          className="btn-backup"
          style={{ flex: 1 }}
          disabled={!!exporting}
          onClick={() => handleExport('csv')}
        >
          <span style={{ fontSize: '1.1em' }}>📊</span>
          {exporting === 'csv' ? 'Genero...' : 'CSV'}
        </button>
      </div>
    </div>
  )
}
