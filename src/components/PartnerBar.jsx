import { useState, lazy, Suspense } from 'react'
import { useApp } from '../lib/store'
import { PARTNER_OF, USER_LABEL } from '../lib/partnerHabits'

const CoupleStatsPanel = lazy(() => import('./CoupleStatsPanel'))

// Barra in cima alla tab Abitudini: switch "Le mie | Di <partner>" e, dietro
// un toggle (chiuso di default, su richiesta di Flavio), le statistiche di
// coppia. In "vista partner" tutto è di sola lettura tranne il completamento
// delle abitudini (vedi setPartnerHabitStatus in store.jsx).
export default function PartnerBar() {
  const { state, actions } = useApp()
  const { authUserId, viewUserId, allUsersData, userColors } = state
  const partnerId = PARTNER_OF[authUserId]
  const [showStats, setShowStats] = useState(() => {
    try { return localStorage.getItem('glp_couple_stats') === 'true' } catch { return false }
  })
  if (!partnerId) return null

  const ownData = allUsersData[authUserId]
  const partnerData = allUsersData[partnerId]
  const viewingPartner = viewUserId === partnerId
  const partnerName = USER_LABEL[partnerId]
  const partnerAvatar = partnerData?.profile?.avatar || (partnerId === 'flavio' ? '🔥' : '⭐')
  const ownAvatar = ownData?.profile?.avatar || (authUserId === 'flavio' ? '🔥' : '⭐')
  const color = id => userColors[id] || (id === 'flavio' ? '#ffca28' : '#d05ce3')

  function toggleStats() {
    const next = !showStats
    setShowStats(next)
    try { localStorage.setItem('glp_couple_stats', String(next)) } catch { /* ignore */ }
  }

  const segBtn = (active, c, disabled) => ({
    flex: 1, padding: '9px 6px', borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
    border: `1px solid ${active ? c : 'var(--card-border)'}`,
    background: active ? `${c}22` : 'var(--surface)',
    color: active ? c : 'var(--text-sec)', fontWeight: active ? 800 : 600, fontSize: '0.82em',
    opacity: disabled ? 0.5 : 1,
  })

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => actions.restoreOwnUser()} style={segBtn(!viewingPartner, color(authUserId), false)}>
          {ownAvatar} Le mie
        </button>
        <button
          onClick={() => actions.switchToViewUser(partnerId)}
          disabled={!partnerData}
          style={segBtn(viewingPartner, color(partnerId), !partnerData)}
        >
          {partnerAvatar} Di {partnerName}
        </button>
      </div>

      {!partnerData && (
        <div style={{ fontSize: '0.72em', color: '#888', margin: '8px 2px 0' }}>
          {partnerId === 'flavio'
            ? 'Le abitudini di Flavio non sono ancora disponibili — appariranno appena Flavio usa l\'app.'
            : 'Simona non ha ancora aperto l\'app: le sue abitudini appariranno dopo il suo primo accesso.'}
        </div>
      )}

      {viewingPartner && (
        <div style={{ fontSize: '0.74em', margin: '8px 0 0', padding: '8px 12px', borderRadius: 10, background: `${color(partnerId)}14`, border: `1px solid ${color(partnerId)}44`, color: 'var(--text)' }}>
          Stai guardando le abitudini di <b>{partnerName}</b> — puoi segnarle come fatte o fallite per {partnerId === 'simona' ? 'lei' : 'lui'} (i valori numerici li inserisce solo {partnerId === 'simona' ? 'lei' : 'lui'}).
        </div>
      )}

      <button
        onClick={toggleStats}
        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-sec)', fontSize: '0.72em', fontWeight: 700, cursor: 'pointer', padding: '10px 2px 4px', textTransform: 'uppercase', letterSpacing: 0.4 }}
      >
        {showStats ? '▾' : '▸'} 📊 Statistiche di coppia
      </button>
      {showStats && (
        partnerData && ownData ? (
          <Suspense fallback={<div className="empty-state" style={{ fontSize: '0.8em' }}>Carico le statistiche…</div>}>
            <CoupleStatsPanel people={[{ id: authUserId, data: ownData }, { id: partnerId, data: partnerData }]} />
          </Suspense>
        ) : (
          <div style={{ fontSize: '0.74em', color: '#888', padding: '6px 2px' }}>Disponibili quando i dati di entrambi sono caricati.</div>
        )
      )}
    </div>
  )
}
