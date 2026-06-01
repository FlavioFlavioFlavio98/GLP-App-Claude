import { useRef } from 'react'
import { useApp } from '../lib/store'

export default function BackupModal() {
  const { state, actions } = useApp()
  const { modal } = state
  const fileRef = useRef(null)

  if (modal !== 'backup') return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <h3>📦 Backup e Dati</h3>

        <div className="settings-section">
          <div className="settings-section-title">Esporta</div>
          <button className="btn-backup" onClick={actions.exportData}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>download</span>
            Backup JSON (tutti i dati)
          </button>
          <button className="btn-backup" onClick={() => actions.exportCsv(null, state.allUsersData, 'all')}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>table_chart</span>
            Esporta CSV (ZIP)
          </button>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Importa</div>
          <button className="btn-backup" onClick={() => fileRef.current.click()}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>upload</span>
            Ripristina da File JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) actions.importData(e.target.files[0]); e.target.value = '' }}
          />
          <div style={{ fontSize: '0.68em', color: '#555', marginTop: 4, padding: '0 4px' }}>
            ⚠️ Sovrascrive tutti i dati esistenti
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Zona Pericolosa</div>
          <button
            className="btn-danger"
            style={{ fontSize: '0.85em' }}
            onClick={actions.hardReset}
          >
            💣 Reset Account
          </button>
          <div style={{ fontSize: '0.65em', color: '#555', marginTop: 4, padding: '0 4px' }}>
            Elimina definitivamente tutti i tuoi dati
          </div>
        </div>

        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}
