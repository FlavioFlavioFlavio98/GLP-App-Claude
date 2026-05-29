import { useRef } from 'react'
import { useApp } from '../lib/store'

export default function SettingsModal() {
  const { state, actions } = useApp()
  const { modal } = state
  const fileRef = useRef(null)

  if (modal !== 'settings') return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box" style={{ textAlign: 'center' }}>
        <h3>Impostazioni</h3>
        <button className="btn-backup" onClick={() => { actions.closeModal(); setTimeout(() => actions.openModal('analytics'), 50) }}>📉 Analisi</button>
        <button className="btn-backup" onClick={() => { actions.closeModal(); setTimeout(() => actions.openModal('stats'), 50) }}>📊 Statistiche</button>
        <button className="btn-backup" onClick={() => { actions.closeModal(); setTimeout(() => actions.openModal('tags'), 50) }}>🏷️ Tag</button>
        <hr style={{ margin: '20px 0', border: '1px solid #333' }} />
        <button className="btn-backup" onClick={actions.exportData}>Backup JSON</button>
        <button className="btn-backup" onClick={() => fileRef.current.click()}>Ripristina da File</button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) actions.importData(e.target.files[0]); e.target.value = '' }} />
        <hr style={{ margin: '20px 0', border: '1px solid #333' }} />
        <button className="btn-danger" onClick={actions.hardReset}>RESET ACCOUNT</button>
        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}
