import { useState, useEffect, useRef } from 'react'
import { useApp } from '../lib/store'
import { db } from '../lib/firebase'
import {
  collection, onSnapshot, orderBy, query,
  getDocs,
} from 'firebase/firestore'

// ── Urgenza letture ────────────────────────────────────────────────────────────
// Restituisce { level, label, color, urgencyRank } in base ai giorni trascorsi
// dall'ultima lettura (o dal caricamento se mai letto).
export function readingUrgency(reading) {
  const ref = reading.lastReadAt || reading.uploadedAt
  if (!ref) return { level: 0, label: null, color: null, urgencyRank: 0 }
  const ms = Date.now() - (ref.toDate ? ref.toDate() : new Date(ref)).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days >= 90) return { level: 3, label: 'Dimenticato?',  color: '#e53935', urgencyRank: 3 }
  if (days >= 60) return { level: 2, label: 'Rileggi presto', color: '#FF6D00', urgencyRank: 2 }
  if (days >= 30) return { level: 1, label: 'Da ripassare',  color: '#FFCA28', urgencyRank: 1 }
  return { level: 0, label: null, color: null, urgencyRank: 0 }
}

function sortReadings(list) {
  return [...list].sort((a, b) => {
    const diff = readingUrgency(b).urgencyRank - readingUrgency(a).urgencyRank
    if (diff !== 0) return diff
    // A parità di urgenza: più recente prima
    const ta = a.uploadedAt?.toDate?.() ?? new Date(a.uploadedAt ?? 0)
    const tb = b.uploadedAt?.toDate?.() ?? new Date(b.uploadedAt ?? 0)
    return tb - ta
  })
}

export default function ReadingsPage({ onClose }) {
  const { state, actions } = useApp()
  const { authUserId } = state

  const [view, setView] = useState('list')        // 'list' | 'read' | 'history'
  const [readings, setReadings] = useState([])
  const [selected, setSelected] = useState(null)
  const [historyLogs, setHistoryLogs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completedAnim, setCompletedAnim] = useState(false)
  const [editReward, setEditReward] = useState(null)  // { id, value }
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTitle, setEditTitle] = useState(null)    // { id, value }
  const fileInputRef = useRef()

  // Subscribe alla lista readings — ordine gestito lato client per urgenza
  useEffect(() => {
    if (!authUserId) return
    const q = query(
      collection(db, 'users', authUserId, 'readings'),
      orderBy('uploadedAt', 'desc')
    )
    return onSnapshot(q, snap => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setReadings(sortReadings(raw))
    })
  }, [authUserId])

  // Aggiorna il reading selezionato quando la lista si aggiorna
  useEffect(() => {
    if (!selected) return
    const updated = readings.find(r => r.id === selected.id)
    if (updated) setSelected(updated)
  }, [readings])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      actions.showToast('Seleziona un file PDF', '❌')
      return
    }
    setUploading(true)
    try {
      await actions.uploadReading(file)
    } catch (err) {
      actions.showToast('Errore caricamento: ' + err.message, '❌')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleComplete() {
    setCompleting(true)
    try {
      await actions.completeReading(selected)
      setCompletedAnim(true)
      setTimeout(() => setCompletedAnim(false), 2500)
    } catch (err) {
      actions.showToast('Errore: ' + err.message, '❌')
    } finally {
      setCompleting(false)
    }
  }

  async function handleDelete(reading) {
    try {
      await actions.deleteReading(reading)
      if (view !== 'list') { setView('list'); setSelected(null) }
    } catch (err) {
      actions.showToast('Errore eliminazione', '❌')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleSaveReward(readingId, val) {
    const n = parseFloat(val)
    if (isNaN(n) || n < 0) { actions.showToast('Valore non valido', '❌'); return }
    try {
      await actions.updateReadingReward(readingId, n)
    } catch (err) {
      actions.showToast('Errore salvataggio', '❌')
    } finally {
      setEditReward(null)
    }
  }

  async function handleSaveTitle(readingId, val) {
    const trimmed = val.trim()
    if (!trimmed) return
    try {
      const { updateDoc, doc } = await import('firebase/firestore')
      const { db } = await import('../lib/firebase')
      await updateDoc(doc(db, 'users', authUserId, 'readings', readingId), { title: trimmed })
    } catch {}
    setEditTitle(null)
  }

  async function openHistory(reading) {
    setSelected(reading)
    setHistoryLogs([])
    setView('history')
    try {
      const q = query(
        collection(db, 'users', authUserId, 'readings', reading.id, 'logs'),
        orderBy('completedAt', 'desc')
      )
      const snap = await getDocs(q)
      setHistoryLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      actions.showToast('Errore caricamento storico', '❌')
    }
  }

  function formatDate(ts) {
    if (!ts) return 'Mai'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function formatDateTime(ts) {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // ── Stili condivisi ────────────────────────────────────────────────────────

  const S = {
    overlay: {
      position: 'fixed', inset: 0, background: 'var(--bg, #111)',
      zIndex: 1000, display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    },
    header: {
      position: 'sticky', top: 0, zIndex: 10,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px', background: 'var(--bg, #111)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
    },
    backBtn: {
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--theme-color, #FFCA28)', padding: '4px 0',
      display: 'flex', alignItems: 'center', gap: 4,
    },
    title: { flex: 1, fontSize: '1em', fontWeight: 700, color: 'var(--text, #fff)' },
    card: {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '14px 14px 12px',
      marginBottom: 10,
    },
    row: { display: 'flex', alignItems: 'center', gap: 8 },
    iconBtn: {
      background: 'none', border: 'none', cursor: 'pointer',
      padding: 4, color: '#666', fontSize: 18, lineHeight: 1,
    },
    chip: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: '0.7em', fontWeight: 600,
    },
    badgePts: {
      background: 'rgba(76,175,80,0.15)', color: '#4caf50',
      border: '1px solid rgba(76,175,80,0.3)',
    },
    uploadBtn: {
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(255,202,40,0.12)', border: '1px solid rgba(255,202,40,0.3)',
      borderRadius: 12, padding: '12px 16px', cursor: 'pointer',
      color: 'var(--theme-color, #FFCA28)', fontWeight: 700, fontSize: '0.88em',
      width: '100%', justifyContent: 'center',
    },
  }

  // ── VISTA LISTA ────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div style={S.overlay}>
        <div style={S.header}>
          <button style={S.backBtn} onClick={onClose}>
            <span className="material-icons-round" style={{ fontSize: 20 }}>arrow_back</span>
          </button>
          <span style={S.title}>📚 Letture</span>
          <span style={{ fontSize: '0.72em', color: '#555' }}>{readings.length} PDF</span>
        </div>

        <div style={{ padding: '14px 14px 80px' }}>
          {/* Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          <button
            style={{ ...S.uploadBtn, opacity: uploading ? 0.6 : 1 }}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <span className="material-icons-round" style={{ fontSize: 20 }}>
              {uploading ? 'hourglass_empty' : 'upload_file'}
            </span>
            {uploading ? 'Caricamento…' : '+ Carica PDF'}
          </button>

          <div style={{ marginTop: 16 }}>
            {readings.length === 0 && !uploading && (
              <div style={{ textAlign: 'center', color: '#444', fontSize: '0.85em', marginTop: 40 }}>
                Nessun PDF caricato.<br />Inizia caricando il tuo primo documento!
              </div>
            )}

            {readings.map(r => {
              const urg = readingUrgency(r)
              return (
              <div key={r.id} style={{
                ...S.card,
                ...(urg.level >= 2 ? { borderColor: urg.color + '44' } : {}),
              }}>
                {/* Badge urgenza */}
                {urg.label && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '0.65em', fontWeight: 700, color: urg.color,
                    background: urg.color + '18', border: `1px solid ${urg.color}44`,
                    borderRadius: 20, padding: '2px 8px', marginBottom: 6,
                  }}>
                    {urg.level === 3 ? '⚠️' : urg.level === 2 ? '🔔' : '💡'} {urg.label}
                  </div>
                )}
                {/* Titolo — editabile */}
                <div style={{ ...S.row, marginBottom: 6 }}>
                  {editTitle?.id === r.id ? (
                    <input
                      autoFocus
                      value={editTitle.value}
                      onChange={e => setEditTitle({ id: r.id, value: e.target.value })}
                      onBlur={() => handleSaveTitle(r.id, editTitle.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveTitle(r.id, editTitle.value)
                        if (e.key === 'Escape') setEditTitle(null)
                      }}
                      style={{
                        flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,202,40,0.4)',
                        borderRadius: 8, padding: '4px 8px', color: 'var(--text,#fff)', fontSize: '0.9em',
                      }}
                    />
                  ) : (
                    <span
                      style={{ flex: 1, fontWeight: 700, fontSize: '0.9em', cursor: 'pointer' }}
                      onClick={() => setEditTitle({ id: r.id, value: r.title })}
                    >
                      {r.title}
                    </span>
                  )}

                  {/* Punti reward editabili */}
                  {editReward?.id === r.id ? (
                    <input
                      autoFocus
                      type="number"
                      value={editReward.value}
                      min={0}
                      max={100}
                      onChange={e => setEditReward({ id: r.id, value: e.target.value })}
                      onBlur={() => handleSaveReward(r.id, editReward.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveReward(r.id, editReward.value)
                        if (e.key === 'Escape') setEditReward(null)
                      }}
                      style={{
                        width: 54, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(76,175,80,0.4)',
                        borderRadius: 8, padding: '3px 6px', color: '#4caf50', fontSize: '0.82em',
                        textAlign: 'center',
                      }}
                    />
                  ) : (
                    <span
                      style={{ ...S.chip, ...S.badgePts, cursor: 'pointer' }}
                      title="Tap per modificare i punti"
                      onClick={() => setEditReward({ id: r.id, value: r.rewardPoints ?? 5 })}
                    >
                      +{r.rewardPoints ?? 5}pt
                    </span>
                  )}
                </div>

                {/* Metadati */}
                <div style={{ fontSize: '0.72em', color: '#555', marginBottom: 10, display: 'flex', gap: 12 }}>
                  <span>📅 {formatDate(r.uploadedAt)}</span>
                  <span>📖 {r.totalReadCount || 0}× letto</span>
                  <span style={{ color: r.lastReadAt ? '#666' : '#3a3a3a' }}>
                    Ultima: {formatDate(r.lastReadAt)}
                  </span>
                </div>

                {/* Azioni */}
                <div style={{ ...S.row, gap: 6 }}>
                  <button
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 10,
                      background: 'var(--theme-glow, rgba(255,202,40,0.15))',
                      border: '1px solid rgba(255,202,40,0.3)',
                      color: 'var(--theme-color, #FFCA28)', fontWeight: 700, fontSize: '0.8em', cursor: 'pointer',
                    }}
                    onClick={() => { setSelected(r); setView('read') }}
                  >
                    <span className="material-icons-round" style={{ fontSize: 15, verticalAlign: 'middle', marginRight: 4 }}>menu_book</span>
                    Leggi
                  </button>
                  <button
                    style={{
                      padding: '8px 12px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#888', fontSize: '0.8em', cursor: 'pointer',
                    }}
                    onClick={() => openHistory(r)}
                    title="Storico letture"
                  >
                    <span className="material-icons-round" style={{ fontSize: 15, verticalAlign: 'middle' }}>history</span>
                  </button>
                  <button
                    style={{
                      padding: '8px 12px', borderRadius: 10,
                      background: 'rgba(229,57,53,0.08)', border: '1px solid rgba(229,57,53,0.2)',
                      color: '#e53935', fontSize: '0.8em', cursor: 'pointer',
                    }}
                    onClick={() => setDeleteTarget(r)}
                    title="Elimina PDF"
                  >
                    <span className="material-icons-round" style={{ fontSize: 15, verticalAlign: 'middle' }}>delete</span>
                  </button>
                </div>
              </div>
            )
          })}
          </div>
        </div>

        {/* Conferma eliminazione */}
        {deleteTarget && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
            <div style={{ background: 'var(--card-solid,#1e1e1e)', borderRadius: 16, padding: 24, maxWidth: 320, width: '100%' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Elimina PDF?</div>
              <div style={{ fontSize: '0.82em', color: '#888', marginBottom: 20 }}>
                "{deleteTarget.title}" verrà rimosso definitivamente da Storage e Firestore.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer' }}
                  onClick={() => setDeleteTarget(null)}
                >
                  Annulla
                </button>
                <button
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'rgba(229,57,53,0.15)', border: '1px solid rgba(229,57,53,0.4)', color: '#e53935', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => handleDelete(deleteTarget)}
                >
                  Elimina
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── VISTA LETTURA ──────────────────────────────────────────────────────────
  if (view === 'read' && selected) {
    return (
      <div style={{ ...S.overlay, background: '#0a0a0a' }}>
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => { setView('list'); setSelected(null) }}>
            <span className="material-icons-round" style={{ fontSize: 20 }}>arrow_back</span>
          </button>
          <span style={{ ...S.title, fontSize: '0.88em' }} title={selected.title}>
            {selected.title.length > 32 ? selected.title.slice(0, 32) + '…' : selected.title}
          </span>
          <span style={{ ...S.chip, ...S.badgePts }}>+{selected.rewardPoints ?? 5}pt</span>
        </div>

        {/* PDF embed */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <iframe
            src={selected.fileUrl}
            style={{
              flex: 1, width: '100%', border: 'none',
              minHeight: 'calc(100vh - 130px)',
            }}
            title={selected.title}
          />
        </div>

        {/* Bottone completamento — fisso in basso */}
        <div style={{
          position: 'sticky', bottom: 0,
          padding: '12px 16px',
          background: 'rgba(10,10,10,0.95)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}>
          {completedAnim ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '14px 0', color: '#4caf50', fontWeight: 700, fontSize: '1em',
              animation: 'fadeIn 0.3s ease',
            }}>
              <span className="material-icons-round" style={{ fontSize: 24 }}>check_circle</span>
              Lettura completata! +{selected.rewardPoints ?? 5}pt
            </div>
          ) : (
            <button
              style={{
                width: '100%', padding: '14px 0', borderRadius: 14,
                background: completing ? 'rgba(76,175,80,0.2)' : 'rgba(76,175,80,0.85)',
                border: 'none', color: '#fff', fontWeight: 800, fontSize: '1em',
                cursor: completing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onClick={handleComplete}
              disabled={completing}
            >
              <span className="material-icons-round" style={{ fontSize: 20 }}>
                {completing ? 'hourglass_empty' : 'check_circle'}
              </span>
              {completing ? 'Salvataggio…' : 'Ho finito di leggere ✓'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── VISTA STORICO ──────────────────────────────────────────────────────────
  if (view === 'history' && selected) {
    return (
      <div style={S.overlay}>
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => { setView('list'); setSelected(null) }}>
            <span className="material-icons-round" style={{ fontSize: 20 }}>arrow_back</span>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.88em' }}>Storico letture</div>
            <div style={{ fontSize: '0.72em', color: '#555', marginTop: 1 }}>{selected.title}</div>
          </div>
          <span style={{ fontSize: '0.72em', color: '#555' }}>{selected.totalReadCount || 0}×</span>
        </div>

        <div style={{ padding: '14px 14px 40px' }}>
          {historyLogs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#444', fontSize: '0.85em', marginTop: 40 }}>
              Nessuna lettura completata ancora.
            </div>
          ) : (
            historyLogs.map((log, i) => (
              <div key={log.id} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(76,175,80,0.15)', border: '1px solid rgba(76,175,80,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.72em', fontWeight: 700, color: '#4caf50',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82em', color: 'var(--text,#fff)' }}>
                    {formatDateTime(log.completedAt)}
                  </div>
                </div>
                <span style={{ ...S.chip, ...S.badgePts }}>+{log.pointsAwarded ?? 0}pt</span>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  return null
}
