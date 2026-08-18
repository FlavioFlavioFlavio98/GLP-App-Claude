import BarefootStats from './BarefootStats'
import HangStats from './HangStats'
import SunExposureSection from './SunExposureSection'
import ActivityRateEditor from './ActivityRateEditor'
import { getBarefootRate, setBarefootRate, getHangRate, setHangRate } from '../lib/bodyStats'

export default function BodyTab({ actions, authUserId, isReadOnly, globalData }) {
  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione non disponibile</div>
  }

  const barefootLog = globalData?.barefootLog || {}
  const hangLog = globalData?.hangLog || {}
  const sunExposureLog = globalData?.sunExposureLog || {}

  const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 12,
    width: '100%', padding: '14px 18px', marginBottom: 8,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, cursor: 'pointer', color: 'var(--text)',
    fontSize: '0.92em', fontWeight: 600, textAlign: 'left',
  }

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Barefoot */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => actions.openModal('barefoot')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
            borderRadius: 12, cursor: 'pointer', color: 'var(--text)',
            fontSize: '0.85em', fontWeight: 600,
          }}
        >
          <span style={{ fontSize: '1.1em' }}>🦶</span>
          Aggiungi sessione Barefoot
        </button>
        <ActivityRateEditor getRate={getBarefootRate} setRate={setBarefootRate} unit="pt/min" label="Punti Barefoot" />
      </div>

      <BarefootStats barefootLog={barefootLog} actions={actions} />

      {/* Hang */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => actions.openModal('hang')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
            borderRadius: 12, cursor: 'pointer', color: 'var(--text)',
            fontSize: '0.85em', fontWeight: 600,
          }}
        >
          <span style={{ fontSize: '1.1em' }}>🧗</span>
          Aggiungi sessione Hang
        </button>
        <ActivityRateEditor getRate={getHangRate} setRate={setHangRate} unit="pt/min" label="Punti Hang" />
      </div>

      <HangStats hangLog={hangLog} actions={actions} />

      {/* Sun Exposure */}
      <SunExposureSection sunExposureLog={sunExposureLog} actions={actions} />

      {/* Peso corporeo — spostato qui da Workout */}
      <button style={btnStyle} onClick={() => actions.openModal('weight')}>
        <span className="material-icons-round" style={{ color: 'var(--theme-color)', fontSize: 22 }}>monitor_weight</span>
        Peso corporeo
      </button>
    </div>
  )
}
