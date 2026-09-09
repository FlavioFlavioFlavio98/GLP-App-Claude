import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import { getLifeAreaNotes } from '../lib/lifeAreaStats'

// Vista di dettaglio di una singola area, con due sezioni distinte:
// - Diario: note libere e datate ("a cosa mi sono dedicato il giorno X"),
//   per riflettere a posteriori.
// - Idee: checklist senza scadenza ("cose da fare quando ho tempo per
//   quest'area"), volutamente separata dal sistema Task principale — niente
//   punti/scadenze, richiesta esplicita di Flavio per non mischiarle con le
//   task vere e proprie.
// Un'unica modale con due tab (stesso pattern di LifeAreaManageModal) invece
// di due modali separate, per tenere tutto ciò che riguarda un'area a un
// solo tocco di distanza quando la si apre con tempo libero da dedicarle.

function fmtNoteDate(dateStr) {
  const today = toDateString(new Date())
  const yesterday = toDateString(new Date(Date.now() - 86400000))
  if (dateStr === today) return 'Oggi'
  if (dateStr === yesterday) return 'Ieri'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}

export default function LifeAreaDetailModal() {
  const { state, actions } = useApp()
  const { modal, modalPayload, allUsersData, authUserId } = state

  const [tab, setTab] = useState('diario') // 'diario' | 'idee'
  const [text, setText] = useState('')
  const [noteDate, setNoteDate] = useState(toDateString(new Date()))
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [ideaText, setIdeaText] = useState('')
  const [savingIdea, setSavingIdea] = useState(false)

  const areaId = modalPayload?.areaId || null

  useEffect(() => {
    if (modal === 'lifeAreaDetail') {
      setTab('diario')
      setText('')
      setNoteDate(toDateString(new Date()))
      setEditingId(null)
      setIdeaText('')
    }
  }, [modal, modalPayload])

  if (modal !== 'lifeAreaDetail') return null
  if (authUserId !== 'flavio') return null

  const gd = allUsersData?.flavio
  const area = (gd?.lifeAreas || []).find(a => a.id === areaId)
  const notes = getLifeAreaNotes(gd?.lifeAreaNotes, areaId)
  const ideas = (gd?.lifeAreaIdeas || []).filter(i => i.areaId === areaId)
  const pendingIdeas = ideas.filter(i => !i.done)
  const doneIdeas = ideas.filter(i => i.done)

  async function handleAddNote() {
    if (!text.trim()) return
    setSaving(true)
    await actions.addLifeAreaNote(areaId, text, noteDate)
    setText('')
    setSaving(false)
  }

  function startEdit(note) {
    setEditingId(note.id)
    setEditingText(note.text)
  }

  async function saveEdit(note) {
    await actions.editLifeAreaNote(note.date, note.id, editingText)
    setEditingId(null)
  }

  async function handleDeleteNote(note) {
    if (!window.confirm('Eliminare questa nota?')) return
    await actions.deleteLifeAreaNote(note.date, note.id)
  }

  async function handleAddIdea() {
    if (!ideaText.trim()) return
    setSavingIdea(true)
    await actions.addLifeAreaIdea(areaId, ideaText)
    setIdeaText('')
    setSavingIdea(false)
  }

  function IdeaRow({ i }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, opacity: i.done ? 0.55 : 1 }}>
        <button
          className="btn-icon"
          style={{ padding: 0, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          title={i.done ? 'Segna da fare' : 'Segna fatta'}
          onClick={() => actions.toggleLifeAreaIdea(i.id)}
        >
          <span className="material-icons-round" style={{ fontSize: 21, color: i.done ? 'var(--success)' : '#666' }}>
            {i.done ? 'check_box' : 'check_box_outline_blank'}
          </span>
        </button>
        <div style={{ flex: 1, fontSize: '0.86em', textDecoration: i.done ? 'line-through' : 'none' }}>{i.text}</div>
        <button
          className="btn-icon"
          style={{ padding: 2 }}
          title="Elimina idea"
          onClick={() => actions.deleteLifeAreaIdea(i.id)}
        >
          <span className="material-icons-round" style={{ fontSize: 15, color: '#555' }}>delete</span>
        </button>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h3>{area?.emoji || '🌱'} {area?.name || 'Area'}</h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setTab('diario')}
            style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: tab === 'diario' ? 'var(--theme-color)' : 'rgba(255,255,255,0.05)', color: tab === 'diario' ? '#000' : 'var(--text)', fontWeight: 700, cursor: 'pointer' }}
          >📝 Diario</button>
          <button
            onClick={() => setTab('idee')}
            style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: tab === 'idee' ? 'var(--theme-color)' : 'rgba(255,255,255,0.05)', color: tab === 'idee' ? '#000' : 'var(--text)', fontWeight: 700, cursor: 'pointer' }}
          >💡 Idee{pendingIdeas.length > 0 ? ` (${pendingIdeas.length})` : ''}</button>
        </div>

        {tab === 'diario' && (
          <>
            <p style={{ fontSize: '0.78em', color: '#888', marginTop: 0, marginBottom: 16 }}>
              Scrivi liberamente a cosa ti sei dedicato — un pensiero, un progresso, un dettaglio da ricordare.
            </p>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Data</div>
              <input
                type="date"
                value={noteDate}
                max={toDateString(new Date())}
                onChange={e => setNoteDate(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9em', boxSizing: 'border-box', colorScheme: 'dark' }}
              />
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Cosa hai fatto, letto, provato, capito..."
              maxLength={1000}
              rows={5}
              style={{ width: '100%', padding: 14, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.95em', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, marginBottom: 10 }}
            />
            <button className="btn-main" style={{ width: '100%', padding: 12, marginBottom: 20, opacity: text.trim() ? 1 : 0.5 }} onClick={handleAddNote} disabled={saving || !text.trim()}>
              {saving ? '⏳' : '+ Aggiungi nota'}
            </button>

            <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Note passate</div>
            {notes.length === 0 && <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85em', padding: '10px 0' }}>Ancora nessuna nota qui.</p>}
            {notes.map(n => (
              <div key={n.id} style={{ padding: '12px 14px', marginBottom: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.68em', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{fmtNoteDate(n.date)}</span>
                  {editingId !== n.id && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" style={{ padding: 2 }} title="Modifica" onClick={() => startEdit(n)}>
                        <span className="material-icons-round" style={{ fontSize: 15, color: '#555' }}>edit</span>
                      </button>
                      <button className="btn-icon" style={{ padding: 2 }} title="Elimina" onClick={() => handleDeleteNote(n)}>
                        <span className="material-icons-round" style={{ fontSize: 15, color: '#555' }}>delete</span>
                      </button>
                    </div>
                  )}
                </div>
                {editingId === n.id ? (
                  <>
                    <textarea
                      value={editingText}
                      onChange={e => setEditingText(e.target.value)}
                      maxLength={1000}
                      rows={4}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.88em', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary" style={{ flex: 1, padding: 8 }} onClick={() => setEditingId(null)}>Annulla</button>
                      <button className="btn-main" style={{ flex: 1, padding: 8 }} onClick={() => saveEdit(n)}>Salva</button>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.88em', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.text}</div>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'idee' && (
          <>
            <p style={{ fontSize: '0.78em', color: '#888', marginTop: 0, marginBottom: 14 }}>
              Idee e piccoli miglioramenti per quest'area, senza scadenza — le prendi quando hai tempo da dedicarle.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={ideaText}
                onChange={e => setIdeaText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddIdea() }}
                placeholder="Es. Video YouTube esercizi a corpo libero"
                maxLength={200}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.88em', boxSizing: 'border-box' }}
              />
              <button className="btn-main" style={{ padding: '0 18px', fontSize: '1.2em' }} onClick={handleAddIdea} disabled={savingIdea || !ideaText.trim()}>+</button>
            </div>

            {pendingIdeas.length === 0 && doneIdeas.length === 0 && (
              <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85em', padding: '10px 0' }}>Ancora nessuna idea qui.</p>
            )}
            {pendingIdeas.map(i => <IdeaRow key={i.id} i={i} />)}
            {doneIdeas.length > 0 && (
              <>
                <div style={{ fontSize: '0.68em', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, margin: '14px 0 8px' }}>Fatte</div>
                {doneIdeas.map(i => <IdeaRow key={i.id} i={i} />)}
              </>
            )}
          </>
        )}

        <button className="btn-secondary" style={{ width: '100%', padding: '12px', marginTop: 16 }} onClick={actions.closeModal}>Chiudi</button>
      </div>
    </div>
  )
}
