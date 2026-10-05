// Menu "Altro": raccoglie le sezioni che non stanno nella barra in basso.
// Ogni voce apre la tab corrispondente (la barra evidenzia "Altro" finché si è
// in una di queste sezioni).
export const ALTRO_ITEMS = [
  { id: 'oggi',       icon: 'today',         label: 'Oggi',       desc: 'Riepilogo della giornata' },
  { id: 'body',       icon: 'spa',           label: 'Benessere',  desc: 'Corpo, sonno, energia' },
  { id: 'mente',      icon: 'psychology',    label: 'Mente',      desc: 'Consapevolezza, meditazione, willpower' },
  { id: 'nutrizione', icon: 'restaurant',    label: 'Nutrizione', desc: 'Alimentazione e macro' },
  { id: 'pasti',      icon: 'lunch_dining',  label: 'Pasti',      desc: 'Pasti consapevoli' },
  { id: 'stats',      icon: 'bar_chart',     label: 'Stats',      desc: 'Statistiche e andamento' },
]

export default function AltroTab({ onOpen }) {
  return (
    <div style={{ padding: '16px 14px' }}>
      <h2 style={{ margin: '0 0 12px', fontSize: '1.1em' }}>Altro</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {ALTRO_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onOpen(item.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
              padding: '14px 12px', textAlign: 'left', cursor: 'pointer',
              background: 'var(--card-solid, #1e1e1e)', color: 'var(--text)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
            }}
          >
            <span className="material-icons-round" style={{ fontSize: 26, color: 'var(--theme-color, #ffca28)' }}>{item.icon}</span>
            <span style={{ fontWeight: 700, fontSize: '0.95em' }}>{item.label}</span>
            <span style={{ fontSize: '0.72em', color: '#888' }}>{item.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
