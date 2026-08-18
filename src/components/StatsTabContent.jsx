export default function StatsTabContent({ actions, globalData, authUserId, isNative, isReadOnly }) {
  const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 12,
    width: '100%', padding: '16px 18px', marginBottom: 10,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, cursor: 'pointer', color: '#e0e0e0',
    fontSize: '0.95em', fontWeight: 600, textAlign: 'left',
  }

  return (
    <div style={{ paddingTop: 8 }}>
      <button style={btnStyle} onClick={() => actions.openModal('stats')}>
        <span className="material-icons-round" style={{ color: 'var(--theme-color)', fontSize: 24 }}>bar_chart</span>
        Statistiche abitudini
      </button>
      <button style={btnStyle} onClick={() => actions.openModal('analytics')}>
        <span className="material-icons-round" style={{ color: 'var(--theme-color)', fontSize: 24 }}>insights</span>
        Analytics
      </button>
      <button style={btnStyle} onClick={() => actions.openModal('weeklyView')}>
        <span className="material-icons-round" style={{ color: 'var(--theme-color)', fontSize: 24 }}>calendar_view_week</span>
        Vista settimanale
      </button>
      {authUserId === 'flavio' && !isReadOnly && (
        <button style={btnStyle} onClick={() => actions.openModal('appUsage')}>
          <span className="material-icons-round" style={{ color: 'var(--theme-color)', fontSize: 24 }}>phone_android</span>
          Uso app
        </button>
      )}
    </div>
  )
}
