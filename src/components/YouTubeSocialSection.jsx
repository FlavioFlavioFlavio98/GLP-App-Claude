import { useState, useEffect } from 'react'
import { toDateString } from '../lib/habitLogic'
import {
  computeSocialPts, computeSocialStats, getSocialEntryForDate,
  getAfternoonBonus, setAfternoonBonus, getDurationPenalty, setDurationPenalty,
} from '../lib/mindStats'
import ActivityRateEditor from './ActivityRateEditor'

function StatCell({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.15em', fontWeight: 800, color: 'var(--theme-color)' }}>{value}</div>
      <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>{label}</div>
    </div>
  )
}

// Voce unica giornaliera (non sessioni) — inserita la sera, sovrascrivibile.
export default function YouTubeSocialSection({ mindSocialLog, actions }) {
  const todayStr = toDateString(new Date())
  const todayEntry = getSocialEntryForDate(mindSocialLog, todayStr)

  const [afterNoon, setAfterNoonLocal] = useState(todayEntry?.afterNoon ?? false)
  const [minutes, setMinutes] = useState(todayEntry?.minutes ?? 0)
  const [saving, setSaving] = useState(false)

  // Se arriva/cambia il dato reale di oggi (es. al primo caricamento), allinea i draft
  useEffect(() => {
    setAfterNoonLocal(todayEntry?.afterNoon ?? false)
    setMinutes(todayEntry?.minutes ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayEntry?.afterNoon, todayEntry?.minutes])

  const previewPts = computeSocialPts(afterNoon, minutes)
  const stats = computeSocialStats(mindSocialLog)

  function changeMinutes(delta) {
    setMinutes(prev => Math.max(0, prev + delta))
  }

  async function handleSave() {
    setSaving(true)
    await actions.setMindSocialEntry(todayStr, afterNoon, minutes)
    setSaving(false)
  }

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          📱 YouTube &amp; Social — oggi
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <ActivityRateEditor getRate={getAfternoonBonus} setRate={setAfternoonBonus} unit="pt bonus" label="Bonus dopo mezzogiorno" />
          <ActivityRateEditor getRate={getDurationPenalty} setRate={setDurationPenalty} unit="pt/min" label="Penalità durata" />
        </div>
      </div>

      <div style={{ fontSize: '0.72em', color: '#888', fontWeight: 600, marginBottom: 6 }}>
        Prima apertura dopo mezzogiorno?
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[{ v: true, label: 'Sì' }, { v: false, label: 'No' }].map(opt => (
          <button
            key={String(opt.v)}
            onClick={() => setAfterNoonLocal(opt.v)}
            style={{
              flex: 1, padding: '8px 6px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.82em',
              background: afterNoon === opt.v ? 'var(--theme-glow)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${afterNoon === opt.v ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`,
              color: afterNoon === opt.v ? 'var(--theme-color)' : 'var(--text)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: '0.72em', color: '#888', fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>
        Minuti totali di utilizzo
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
        <button onClick={() => changeMinutes(-15)} style={btnStyle}>−15</button>
        <button onClick={() => changeMinutes(-5)} style={{ ...btnStyle, width: 48, height: 48 }}>−5</button>
        <div style={{ textAlign: 'center', minWidth: 60 }}>
          <div style={{ fontSize: '2em', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{minutes}</div>
          <div style={{ fontSize: '0.55em', color: '#555', textTransform: 'uppercase' }}>minuti</div>
        </div>
        <button onClick={() => changeMinutes(5)} style={{ ...btnStyle, width: 48, height: 48 }}>+5</button>
        <button onClick={() => changeMinutes(15)} style={btnStyle}>+15</button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 12, fontSize: '1.1em', fontWeight: 800, color: previewPts > 0 ? 'var(--success)' : '#666' }}>
        = +{previewPts} pt {!afterNoon && <span style={{ fontSize: '0.6em', color: '#666', fontWeight: 400 }}>(0 se aperto prima di mezzogiorno)</span>}
      </div>

      <button className="btn-main" style={{ width: '100%', padding: '12px', marginBottom: 12 }} onClick={handleSave} disabled={saving}>
        {saving ? '⏳ Salvataggio...' : (todayEntry ? 'Aggiorna' : 'Salva')}
      </button>

      {stats.trackedDays > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <StatCell label="Gg tracciati" value={stats.trackedDays} />
          <StatCell label="Media 7gg" value={`${stats.weekAvgMinutes}′`} />
          <StatCell label="Lifetime" value={`+${stats.lifetimePts}pt`} />
          <StatCell label="Streak" value={stats.streak.current > 0 ? `${stats.streak.current}🔥` : '0'} />
        </div>
      )}
    </div>
  )
}

const btnStyle = {
  width: 44, height: 44, borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff', fontSize: '0.8em', fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
