/**
 * Chip-based category picker for reward forms.
 * Shows all categories + "Nessuna" option.
 */
export default function RewardCategoryPicker({ categories, value, onChange }) {
  if (categories.length === 0) {
    return (
      <div style={{ fontSize: '0.78em', color: '#555', marginTop: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
        Nessuna categoria disponibile — creane una in Impostazioni → Categorie Premi
      </div>
    )
  }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Categoria Premio</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button
          type="button"
          className={`reward-cat-chip${!value ? ' selected' : ''}`}
          onClick={() => onChange('')}
        >
          Nessuna
        </button>
        {categories.map(c => (
          <button
            key={c.id}
            type="button"
            className={`reward-cat-chip${value === c.id ? ' selected' : ''}`}
            style={value === c.id ? { background: c.color, borderColor: c.color, color: '#fff' } : { borderColor: c.color, color: c.color }}
            onClick={() => onChange(c.id)}
          >
            {c.emoji && <span>{c.emoji} </span>}
            {c.name}
          </button>
        ))}
      </div>
    </div>
  )
}
