import { useState } from 'react'
import { useApp } from '../lib/store'

function isValidEmoji(str) {
  if (!str || str.length === 0) return false
  const t = str.trim()
  return t.length >= 1 && t.length <= 8 && /[^\x00-\x7F]/.test(t)
}

const QUICK_EMOJIS = ['🔥', '⭐', '💪', '🚀', '🎯', '🦁', '🐉', '⚡', '🌟', '🏆', '🎮', '🧠', '🦊', '🐺', '🦅', '💎', '🌈', '🍀', '☀️', '🌙', '🌊', '🎵', '🎨', '🏋️', '🧘', '🤸', '🦋', '🌺', '🎪', '🍕']

export default function AvatarModal() {
  const { state, actions } = useApp()
  const { modal, allUsersData, authUserId } = state
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  if (modal !== 'avatar') return null

  const currentAvatar = allUsersData[authUserId]?.profile?.avatar || (authUserId === 'flavio' ? '🔥' : '⭐')
  const preview = isValidEmoji(input.trim()) ? input.trim() : currentAvatar

  async function handleSave() {
    const emoji = input.trim()
    if (!isValidEmoji(emoji)) { actions.showToast('Inserisci una sola emoji valida', '⚠️'); return }
    setSaving(true)
    try {
      await actions.saveAvatar(emoji)
      actions.showToast('Avatar aggiornato!', emoji)
      actions.closeModal()
    } catch {
      actions.showToast('Errore nel salvataggio', '❌')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <h3>Personalizza Avatar</h3>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            fontSize: '4em', lineHeight: 1, width: 80, height: 80,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)',
            borderRadius: '50%', margin: '0 auto 8px',
          }}>
            {preview}
          </div>
          <div style={{ fontSize: '0.7em', color: '#555' }}>Anteprima</div>
        </div>

        <div className="input-group">
          <label>Scrivi un'emoji...</label>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={currentAvatar}
            maxLength={8}
            style={{ fontSize: '1.5em', textAlign: 'center', letterSpacing: 4 }}
          />
          <div style={{ fontSize: '0.65em', color: '#555', marginTop: 4 }}>Usa una sola emoji</div>
        </div>

        <div style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 }}>Scelta rapida</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {QUICK_EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => setInput(e)}
              style={{
                fontSize: '1.4em', cursor: 'pointer', lineHeight: 1, padding: '4px 6px', borderRadius: 8,
                background: input === e ? 'var(--theme-glow)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${input === e ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >{e}</button>
          ))}
        </div>

        <button className="btn-main" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvataggio...' : 'Salva'}
        </button>
        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}
