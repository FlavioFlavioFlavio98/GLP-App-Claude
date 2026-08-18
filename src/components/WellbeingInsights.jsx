import { computeWellbeingInsights } from '../lib/wellbeingInsights'

// Confronti semplici (non vera correlazione statistica) tra le nuove aree
// tracciate e lo sforzo di allenamento — appare solo se c'è abbastanza
// storico per un confronto onesto, vedi wellbeingInsights.js.
export default function WellbeingInsights({ exerciseLog, mobilityLog, barefootLog, hangLog, mindSocialLog }) {
  const insights = computeWellbeingInsights({ exerciseLog, mobilityLog, barefootLog, hangLog, mindSocialLog })
  if (insights.length === 0) return null

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
        💡 Cosa noto nei tuoi dati
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.82em', lineHeight: 1.5 }}>
            <span style={{ fontSize: '1.1em', flexShrink: 0 }}>{ins.icon}</span>
            <span style={{ color: 'var(--text-sec)' }}>{ins.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
