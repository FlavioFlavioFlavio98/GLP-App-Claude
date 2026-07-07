export default function WorkoutTab({ actions, authUserId, isReadOnly }) {
  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione workout non disponibile</div>
  }

  const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 12,
    width: '100%', padding: '16px 18px', marginBottom: 10,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, cursor: 'pointer', color: '#e0e0e0',
    fontSize: '0.95em', fontWeight: 600, textAlign: 'left',
  }

  return (
    <div style={{ paddingTop: 8 }}>
      <button style={btnStyle} onClick={() => actions.openModal('quickExercise')}>
        <span className="material-icons-round" style={{ color: 'var(--theme-color)', fontSize: 24 }}>fitness_center</span>
        Allenamento rapido
      </button>
      <button style={btnStyle} onClick={() => actions.openModal('weight')}>
        <span className="material-icons-round" style={{ color: 'var(--theme-color)', fontSize: 24 }}>monitor_weight</span>
        Peso corporeo
      </button>
      <button style={btnStyle} onClick={() => actions.openModal('exerciseStats')}>
        <span className="material-icons-round" style={{ color: 'var(--theme-color)', fontSize: 24 }}>bar_chart</span>
        Statistiche esercizi
      </button>
    </div>
  )
}
