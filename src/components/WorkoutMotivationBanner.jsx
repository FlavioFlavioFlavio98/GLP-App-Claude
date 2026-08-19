import {
  getMostRecentLoggedExercise, getTodayLoggedExercises, getExerciseRecordStatus, getEffortPercentile,
} from '../lib/workoutStats'

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
function fmtDateLong(d) {
  if (!d) return ''
  const [y, m, dd] = d.split('-')
  return `${parseInt(dd)} ${MONTHS[parseInt(m) - 1]}`
}

const toneStyles = {
  record:  { bg: 'linear-gradient(135deg, rgba(255,202,40,0.18), rgba(255,112,67,0.12))', border: 'var(--theme-color)' },
  push:    { bg: 'rgba(255,112,67,0.10)', border: '#ff7043' },
  compare: { bg: 'var(--card)', border: 'var(--card-border)' },
}

function BannerCard({ icon, title, sub, tone, onDismiss }) {
  const styles = toneStyles[tone]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px', borderRadius: 14, marginBottom: 8,
      background: styles.bg, border: `1px solid ${styles.border}`,
    }}>
      <span style={{ fontSize: '1.8em', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '0.92em', color: tone === 'record' ? 'var(--theme-color)' : 'var(--text)' }}>
          {title}
        </div>
        {sub && <div style={{ fontSize: '0.72em', color: 'var(--text-sec)', marginTop: 2 }}>{sub}</div>}
      </div>
      {onDismiss && (
        <button className="btn-icon" onClick={onDismiss} title="Chiudi" style={{ flexShrink: 0 }}>
          <span className="material-icons-round" style={{ fontSize: 18, color: '#888' }}>close</span>
        </button>
      )}
    </div>
  )
}

// Un banner per ogni esercizio allenato oggi che è vicino/ha battuto il record —
// resta visibile finché non si chiude con la X o si termina la sessione (vedi
// dismissedIds/onDismiss, gestiti da WorkoutTab), invece di sparire da solo non
// appena si logga un esercizio diverso.
export default function WorkoutMotivationBanner({ exerciseLog, quickExercises, dismissedIds, onDismiss }) {
  const todayExercises = getTodayLoggedExercises(exerciseLog, quickExercises)

  const notable = todayExercises
    .map(exercise => ({ exercise, record: getExerciseRecordStatus(exerciseLog, exercise.id) }))
    .filter(({ record }) => (record.isNewRecord || record.closeToRecord) && !dismissedIds?.has(exercise.id))

  if (notable.length > 0) {
    return (
      <>
        {notable.map(({ exercise, record }) => (
          <BannerCard
            key={exercise.id}
            tone={record.isNewRecord ? 'record' : 'push'}
            icon={record.isNewRecord ? '🏆' : '🔥'}
            title={record.isNewRecord
              ? `Nuovo record! ${record.todayReps} ${exercise.name.toLowerCase()} oggi`
              : `Mancano ${record.remaining} rip. per battere il record di ${exercise.name}`}
            sub={record.isNewRecord
              ? `Superato il precedente di ${record.prevBestReps} del ${fmtDateLong(record.prevBestDate)}`
              : `${exercise.emoji} record storico ${record.prevBestReps} rip.`}
            onDismiss={() => onDismiss?.(exercise.id)}
          />
        ))}
      </>
    )
  }

  // Nessun record da segnalare — riepilogo generico dello sforzo di oggi
  const recent = getMostRecentLoggedExercise(exerciseLog, quickExercises)
  if (!recent) {
    const { totalDays } = getEffortPercentile(exerciseLog)
    return (
      <BannerCard
        tone="compare" icon="🎯"
        title="Non ti sei ancora allenato oggi"
        sub={totalDays > 0
          ? 'Registra la prima serie per iniziare a costruire lo sforzo di oggi'
          : 'Registra la tua prima serie per iniziare a tracciare i progressi'}
      />
    )
  }

  const { todayEffort, percentile, totalDays } = getEffortPercentile(exerciseLog)
  return (
    <BannerCard
      tone="compare" icon="📊"
      title={`Oggi: ${todayEffort}pt di sforzo`}
      sub={percentile === null
        ? 'Prima giornata di allenamento tracciata — continua così!'
        : percentile >= 50
          ? `Meglio dell'${percentile}% dei tuoi ${totalDays} giorni di allenamento`
          : `Sopra il ${percentile}% dei tuoi ${totalDays} giorni di allenamento — puoi ancora spingere`}
    />
  )
}
