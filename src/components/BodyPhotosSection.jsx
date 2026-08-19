import { useState, useEffect, useRef } from 'react'
import { useApp } from '../lib/store'
import { db } from '../lib/firebase'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { toDateString } from '../lib/habitLogic'

function fmtDate(dateStr) {
  if (!dateStr) return '-'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

export function daysSinceLastPhoto(entries) {
  if (!entries.length) return null
  const last = entries[0] // già ordinate desc per createdAt
  const ms = Date.now() - new Date(last.dateStr).getTime()
  return Math.floor(ms / 86_400_000)
}

export default function BodyPhotosSection({ authUserId }) {
  const { actions } = useApp()
  const [entries, setEntries] = useState([])
  const [note, setNote] = useState('')
  const [sessionDate, setSessionDate] = useState(toDateString(new Date()))
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef()

  useEffect(() => {
    if (authUserId !== 'flavio') return
    const q = query(collection(db, 'users', 'flavio', 'bodyPhotos'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [authUserId])

  async function handleFiles(e) {
    const files = [...(e.target.files || [])].filter(f => f.type.startsWith('image/'))
    if (files.length === 0) return
    setUploading(true)
    try {
      await actions.uploadBodyPhotos(files, note, sessionDate)
      setNote('')
      setSessionDate(toDateString(new Date()))
    } catch (err) {
      actions.showToast('Errore caricamento: ' + err.message, '❌')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const daysSince = daysSinceLastPhoto(entries)

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
        📸 Foto Progressi
      </div>

      <div style={{ fontSize: '0.78em', color: '#888', marginBottom: 12 }}>
        {entries.length === 0
          ? 'Nessun check fisico ancora — carica le prime foto per iniziare a tracciare i risultati'
          : daysSince === 0 ? 'Ultimo check: oggi' : `Ultimo check: ${daysSince} giorn${daysSince === 1 ? 'o' : 'i'} fa`}
      </div>

      {/* Upload */}
      <div style={{ marginBottom: 14 }}>
        <input
          type="date"
          value={sessionDate}
          max={toDateString(new Date())}
          onChange={e => setSessionDate(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.85em', boxSizing: 'border-box', colorScheme: 'dark', marginBottom: 8 }}
        />
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Nota (opzionale) — es. dopo 4 settimane di dieta"
          maxLength={200}
          rows={2}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.82em', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', marginBottom: 8 }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          style={{ display: 'none' }}
        />
        <button
          className="btn-main"
          style={{ width: '100%', padding: '12px', fontSize: '0.9em' }}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '⏳ Caricamento...' : '📷 Carica foto check fisico'}
        </button>
      </div>

      {/* Storico */}
      {entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map(entry => (
            <div key={entry.id} style={{
              padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.75em', fontWeight: 700, color: 'var(--theme-color)' }}>{fmtDate(entry.dateStr)}</span>
                <button
                  className="btn-icon"
                  style={{ padding: 2 }}
                  onClick={async () => {
                    if (!window.confirm(`Eliminare il check fisico del ${fmtDate(entry.dateStr)}?`)) return
                    await actions.deleteBodyPhotoEntry(entry)
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: 14, color: '#444' }}>delete</span>
                </button>
              </div>
              {entry.note && <div style={{ fontSize: '0.72em', color: '#888', marginBottom: 6 }}>{entry.note}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(entry.photos || []).map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }} />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
