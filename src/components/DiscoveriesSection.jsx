function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DiscoveriesSection({ discoveries, actions }) {
  const active = (discoveries || []).filter(d => !d.archived)
  const dueCount = active.filter(d => d.nextReviewAt <= todayStr()).length

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          💡 Scoperte
        </div>
        {active.length > 0 && (
          <span style={{ fontSize: '0.7em', color: 'var(--text-sec)' }}>
            {active.length} salvat{active.length === 1 ? 'a' : 'e'}{dueCount > 0 ? ` · ${dueCount} da ripassare` : ''}
          </span>
        )}
      </div>

      <div style={{ fontSize: '0.78em', color: 'var(--text-sec)', marginBottom: 12, lineHeight: 1.4 }}>
        Cose che ti capitano e vuoi ricordare/riprovare tra qualche giorno — niente si perde.
      </div>

      <button
        onClick={() => actions.openModal('discoveries')}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
          borderRadius: 12, cursor: 'pointer', color: 'var(--text)',
          fontSize: '0.9em', fontWeight: 700,
        }}
      >
        <span className="material-icons-round" style={{ fontSize: 20 }}>lightbulb</span>
        {active.length === 0 ? 'Aggiungi una scoperta' : 'Apri Scoperte'}
      </button>
    </div>
  )
}
