import { useState } from 'react'
import { useApp } from '../lib/store'
import { APP_VERSION, APP_UPDATED } from '../version'

export default function SettingsModal() {
  const { state, actions } = useApp()
  const { modal, userColors, density, authUserId, allUsersData } = state
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  if (modal !== 'settings') return null

  function openAfter(name) {
    actions.closeModal()
    setTimeout(() => actions.openModal(name), 60)
  }

  async function checkForUpdates() {
    setCheckingUpdate(true)
    try {
      const reg = window.__swRegistration
      if (reg) {
        await reg.update()
        if (reg.waiting) {
          // New version waiting — trigger install
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
          actions.showToast('Installazione aggiornamento...', '🔄')
          setTimeout(() => window.location.reload(), 800)
          return
        }
      }
      // Fallback: clear caches and reload
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      actions.showToast('Sei già all\'ultima versione ✓', '✅')
    } catch (e) {
      actions.showToast('Sei già all\'ultima versione ✓', '✅')
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
          <UserColorRow name="Flavio" color={userColors.flavio} onChange={c => actions.setUserColor('flavio', c)} />
          <UserColorRow name="Simona" color={userColors.simona} onChange={c => actions.setUserColor('simona', c)} />
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

        {/* VISUALIZZAZIONE */}
        <div className="settings-section">
          <div className="settings-section-title">Visualizzazione</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'compact', icon: 'density_small', label: 'Compatta' },
              { id: 'normal', icon: 'density_medium', label: 'Normale' },
              { id: 'expanded', icon: 'density_large', label: 'Espansa' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => actions.setDensity(opt.id)}
                style={{
                  flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                  background: density === opt.id ? 'var(--theme-glow)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${density === opt.id ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`,
                  color: density === opt.id ? 'var(--theme-color)' : '#888',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  transition: 'all 0.2s',
                }}
              >
                <span className="material-icons-round" style={{ fontSize: 20 }}>{opt.icon}</span>
                <span style={{ fontSize: '0.7em', fontWeight: density === opt.id ? 700 : 400 }}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ASPETTO */}
        <div className="settings-section">
          <div className="settings-section-title">Aspetto</div>
          <button className="btn-backup" onClick={() => openAfter('themeModal')}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>palette</span>
            Temi
          </button>
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

        {/* PESO — solo Flavio */}
        {authUserId === 'flavio' && (
          <div className="settings-section">
            <div className="settings-section-title">Salute</div>
            <button className="btn-backup" onClick={() => openAfter('weight')}>
              <span style={{ fontSize: '1.1em' }}>⚖️</span>
              Tracciamento Peso
            </button>
          </div>
        )}

        {/* STORICO */}
        <div className="settings-section">
          <div className="settings-section-title">Storico</div>
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
            Statistiche Complete
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
          </div>
          <button className="btn-backup" onClick={checkForUpdates} disabled={checkingUpdate} style={{ marginTop: 8 }}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>system_update</span>
            {checkingUpdate ? 'Controllo in corso...' : 'Controlla aggiornamenti'}
          </button>
        </div>

        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}

function UserColorRow({ name, color, onChange }) {
  return (
    <div className="user-color-row">
      <div className="user-color-dot" style={{ background: color }}>{name[0]}</div>
      <span className="user-color-name">{name}</span>
      <input type="color" className="user-color-picker" value={color} onChange={e => onChange(e.target.value)} title={`Colore di ${name}`} />
    </div>
  )
}
