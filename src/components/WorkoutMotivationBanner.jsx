import {
  getMostRecentLoggedExercise, getExerciseRecordStatus, getEffortPercentile,
} from '../lib/workoutStats'

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
function fmtDateLong(d) {
  if (!d) return ''
  const [y, m, dd] = d.split('-')
  return `${parseInt(dd)} ${MONTHS[parseInt(m) - 1]}`
}

export default function WorkoutMotivationBanner({ exerciseLog, quickExercises }) {
  const recent = getMostRecentLoggedExercise(exerciseLog, quickExercises)

  let icon = '💪'
  let title = ''
  let sub = null
  let tone = 'neutral' // 'record' | 'push' | 'compare' | 'neutral'

  if (!recent) {
    // Nessuna serie loggata oggi ancora — stato sempre visibile, non a scomparsa
    const { percentile, totalDays } = getEffortPercentile(exerciseLog)
    icon = '🎯'
    title = 'Non ti sei ancora allenato oggi'
    sub = totalDays > 0
      ? `Registra la prima serie per iniziare a costruire lo sforzo di oggi`
      : `Registra la tua prima serie per iniziare a tracciare i progressi`
  } else {
    const record = getExerciseRecordStatus(exerciseLog, recent.exercise.id)

    if (record.isNewRecord) {
      tone = 'record'
      icon = '🏆'
      title = `Nuovo record! ${record.todayReps} ${recent.exercise.name.toLowerCase()} oggi`
      sub = `Superato il precedente di ${record.prevBestReps} del ${fmtDateLong(record.prevBestDate)}`
    } else if (record.closeToRecord) {
      tone = 'push'
      icon = '🔥'
      title = `Mancano ${record.remaining} rip. per battere il record`
      sub = `${recent.exercise.name}: record storico ${record.prevBestReps} rip.`
    } else {
      tone = 'compare'
      const { todayEffort, percentile, totalDays } = getEffortPercentile(exerciseLog)
      icon = '📊'
      if (percentile === null) {
        title = `Oggi: ${todayEffort}pt di sforzo`
        sub = `Prima giornata di allenamento tracciata — continua così!`
      } else {
        title = `Oggi: ${todayEffort}pt di sforzo`
        sub = percentile >= 50
          ? `Meglio dell'${percentile}% dei tuoi ${totalDays} giorni di allenamento`
          : `Sopra il ${percentile}% dei tuoi ${totalDays} giorni di allenamento — puoi ancora spingere`
      }
    }
  }

  const toneStyles = {
    record:  { bg: 'linear-gradient(135deg, rgba(255,202,40,0.18), rgba(255,112,67,0.12))', border: 'var(--theme-color)' },
    push:    { bg: 'rgba(255,112,67,0.10)', border: '#ff7043' },
    compare: { bg: 'var(--card)', border: 'var(--card-border)' },
    neutral: { bg: 'var(--card)', border: 'var(--card-border)' },
  }[tone]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px', borderRadius: 14, marginBottom: 12,
      background: toneStyles.bg, border: `1px solid ${toneStyles.border}`,
    }}>
      <span style={{ fontSize: '1.8em', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '0.92em', color: tone === 'record' ? 'var(--theme-color)' : 'var(--text)' }}>
          {title}
        </div>
        {sub && <div style={{ fontSize: '0.72em', color: 'var(--text-sec)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}
