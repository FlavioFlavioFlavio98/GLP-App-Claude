import { useApp } from '../lib/store'

const THEMES = [
  { id: 'dark', label: 'Dark', color: '#EF9F27' },
  { id: 'forest', label: 'Forest', color: '#1D9E75' },
  { id: 'volcano', label: 'Volcano', color: '#E24B4A' },
  { id: 'midnight', label: 'Midnight', color: '#6E7FCA' },
  { id: 'aurora', label: 'Aurora', color: '#9B59B6' },
]

const TEXT_SIZES = [
  { id: 'small', label: 'A-', style: { fontSize: '0.8em' } },
  { id: 'normal', label: 'A', style: { fontSize: '0.9em' } },
  { id: 'large', label: 'A+', style: { fontSize: '1em' } },
]

const DENSITIES = [
  { id: 'compact', label: 'Compatta' },
  { id: 'normal', label: 'Normale' },
  { id: 'spacious', label: 'Spaziosa' },
]

const BUBBLE_STYLES = [
  { id: 'rounded', label: 'Arrotondata' },
  { id: 'square', label: 'Squadrata' },
  { id: 'flat', label: 'Flat' },
]

const PSYCH_COLORS = [
  { id: 'theme', label: 'Tema' },
  { id: 'neutral', label: 'Neutro' },
  { id: 'custom', label: 'Custom' },
]

export const DEFAULT_PREFS = {
  textSize: 'normal',
  density: 'normal',
  bubbleStyle: 'rounded',
  psychColor: 'theme',
  psychColorCustom: '#2a2a2a',
}

export function loadPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('glp_psych_chat_prefs') || '{}') } }
  catch { return DEFAULT_PREFS }
}

export function savePrefs(prefs) {
  localStorage.setItem('glp_psych_chat_prefs', JSON.stringify(prefs))
}

// Props: prefs, onPrefsChange, onClose
export default function PsychChatSettings({ prefs, onPrefsChange, onClose }) {
  const { state, actions } = useApp()
  const { theme } = state

  function set(key, val) {
    const next = { ...prefs, [key]: val }
    onPrefsChange(next)
    savePrefs(next)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10300, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10301, background: 'var(--bg)', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95em' }}>⚙️ Impostazioni Chat</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1.1em', padding: '2px 4px' }}>✕</button>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 14 }} />

          {/* Theme */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.68em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: 8 }}>Tema</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {THEMES.map(t => (
                <button key={t.id} onClick={() => actions.setTheme(t.id)}
                  style={{ flex: '1 1 0', minWidth: 52, padding: '8px 4px', background: theme === t.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${theme === t.id ? t.color : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.color }} />
                  <span style={{ fontSize: '0.65em', color: theme === t.id ? t.color : '#666' }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text size */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.68em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: 8 }}>Dimensione Testo</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {TEXT_SIZES.map(s => (
                <button key={s.id} onClick={() => set('textSize', s.id)}
                  style={{ flex: 1, padding: '8px', background: prefs.textSize === s.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${prefs.textSize === s.id ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, cursor: 'pointer', color: prefs.textSize === s.id ? 'var(--theme-color)' : '#666', fontWeight: 700, ...s.style }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Density */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.68em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: 8 }}>Densità Messaggi</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {DENSITIES.map(d => (
                <button key={d.id} onClick={() => set('density', d.id)}
                  style={{ flex: 1, padding: '8px 4px', background: prefs.density === d.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${prefs.density === d.id ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, cursor: 'pointer', color: prefs.density === d.id ? 'var(--theme-color)' : '#666', fontSize: '0.75em', fontWeight: 600 }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bubble style */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.68em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: 8 }}>Bolla Messaggi</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {BUBBLE_STYLES.map(b => (
                <button key={b.id} onClick={() => set('bubbleStyle', b.id)}
                  style={{ flex: 1, padding: '8px 4px', background: prefs.bubbleStyle === b.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${prefs.bubbleStyle === b.id ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, cursor: 'pointer', color: prefs.bubbleStyle === b.id ? 'var(--theme-color)' : '#666', fontSize: '0.75em', fontWeight: 600 }}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Psych color */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.68em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: 8 }}>Colore Messaggi Psicologo</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {PSYCH_COLORS.map(c => (
                <button key={c.id} onClick={() => set('psychColor', c.id)}
                  style={{ flex: 1, padding: '8px 4px', background: prefs.psychColor === c.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${prefs.psychColor === c.id ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, cursor: 'pointer', color: prefs.psychColor === c.id ? 'var(--theme-color)' : '#666', fontSize: '0.75em', fontWeight: 600 }}>
                  {c.label}
                </button>
              ))}
              {prefs.psychColor === 'custom' && (
                <input type="color" value={prefs.psychColorCustom || '#2a2a2a'} onChange={e => set('psychColorCustom', e.target.value)}
                  style={{ width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }} />
              )}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 12 }} />

          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <button onClick={() => { onPrefsChange(DEFAULT_PREFS); savePrefs(DEFAULT_PREFS) }}
              style={{ flex: 1, padding: '9px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#666', cursor: 'pointer', fontSize: '0.8em' }}>
              Ripristina default
            </button>
            <button onClick={onClose}
              style={{ flex: 2, padding: '9px', background: 'var(--theme-color)', border: 'none', borderRadius: 10, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: '0.8em' }}>
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
