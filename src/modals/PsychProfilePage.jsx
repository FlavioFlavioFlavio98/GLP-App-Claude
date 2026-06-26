import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useApp } from '../lib/store'

export default function PsychProfilePage({ psychProfile, psychSessions, psychStats, onClose, authUserId }) {
  const { actions } = useApp()
  const [showSessions, setShowSessions] = useState(false)

  async function handleReset() {
    if (!window.confirm('Sei sicuro? Questa azione elimina tutto il profilo psicologico accumulato.')) return
    if (!window.confirm('Conferma definitiva: eliminare il profilo psicologico?')) return
    await updateDoc(doc(db, 'users', 'flavio'), {
      psychProfile: {},
      psychSessions: [],
      psychStats: { totalTokensLifetime: 0, totalCostEURLifetime: 0, totalSessions: 0, totalMessages: 0 },
    })
    actions.showToast('Profilo psicologico resettato', '🗑️')
    onClose()
  }

  const hasProfile = psychProfile?.narrative

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg)', zIndex: 10000, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: '1.5em', cursor: 'pointer', padding: '4px 8px 4px 0', lineHeight: 1 }}>←</button>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05em' }}>Il tuo Profilo Psicologico</div>
          {psychProfile?.lastUpdated && (
            <div style={{ fontSize: '0.72em', color: 'var(--text-sec)' }}>
              Aggiornato: {new Date(psychProfile.lastUpdated).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })} · {new Date(psychProfile.lastUpdated).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 16px 60px' }}>
        {!hasProfile && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#555', fontSize: '0.9em' }}>
            <div style={{ fontSize: '2em', marginBottom: 12 }}>🧠</div>
            Inizia una conversazione con lo Psicologo AI per generare il tuo profilo.
          </div>
        )}

        {hasProfile && (
          <>
            <ProfileSection title="📖 Chi sei" content={psychProfile.narrative} big />
            {psychProfile.coreThemes?.length > 0 && <ProfileListSection title="🎯 Temi ricorrenti" items={psychProfile.coreThemes} />}
            {psychProfile.emotionalPatterns?.length > 0 && <ProfileListSection title="💭 Pattern emotivi" items={psychProfile.emotionalPatterns} />}
            {psychProfile.growthAreas?.length > 0 && <ProfileListSection title="🌱 Aree di crescita" items={psychProfile.growthAreas} />}
            {psychProfile.strengths?.length > 0 && <ProfileListSection title="💪 Punti di forza" items={psychProfile.strengths} />}
            {psychProfile.recentInsights?.length > 0 && <ProfileListSection title="💡 Insight recenti" items={psychProfile.recentInsights} italic />}
          </>
        )}

        {/* Sessions */}
        {psychSessions?.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <button onClick={() => setShowSessions(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.82em', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              {showSessions ? '▲' : '▼'} 📋 Storico sessioni ({psychSessions.length})
            </button>
            {showSessions && [...psychSessions].reverse().map(sess => (
              <div key={sess.id} style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.78em', color: 'var(--theme-color)', fontWeight: 700 }}>{sess.date}</span>
                  <span style={{ fontSize: '0.7em', color: '#555' }}>{sess.model}</span>
                </div>
                <div style={{ fontSize: '0.78em', color: '#666' }}>{sess.messageCount} msg · {sess.totalTokens?.toLocaleString()} tok · €{sess.totalCostEUR?.toFixed(4)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Reset */}
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={handleReset} style={{ background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.25)', borderRadius: 10, padding: '10px 16px', color: '#e57373', cursor: 'pointer', fontSize: '0.85em', width: '100%' }}>
            🗑️ Resetta profilo psicologico
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileSection({ title, content, big, italic }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: '0.72em', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: big ? '0.92em' : '0.88em', color: 'var(--text)', lineHeight: 1.65, fontStyle: italic ? 'italic' : 'normal' }}>{content}</div>
    </div>
  )
}

function ProfileListSection({ title, items, italic }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: '0.72em', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {items.map((item, i) => (
        <div key={i} style={{ fontSize: '0.88em', color: 'var(--text)', lineHeight: 1.5, paddingLeft: 8, marginBottom: 4, fontStyle: italic ? 'italic' : 'normal' }}>• {item}</div>
      ))}
    </div>
  )
}
