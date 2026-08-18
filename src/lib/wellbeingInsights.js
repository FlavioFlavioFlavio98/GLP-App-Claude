import { getDayEffort } from './workoutStats'

const MIN_DAYS_PER_GROUP = 3 // sotto questa soglia il confronto non è affidabile

function avg(arr) {
  return arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0
}

// Confronti semplici tra i nuovi dati (mobility/barefoot/hang/social) e lo
// sforzo di allenamento — non vera statistica, solo una media a media per dare
// un riscontro motivazionale onesto. Ogni confronto appare solo se ci sono
// abbastanza giorni in entrambi i gruppi, altrimenti verrebbe fuorviante.
export function computeWellbeingInsights({ exerciseLog, mobilityLog, barefootLog, hangLog, mindSocialLog }) {
  const insights = []
  const exerciseDates = Object.keys(exerciseLog || {})
  if (exerciseDates.length === 0) return insights

  // 1) Giorni con attività di benessere (mobility/barefoot/hang) vs giorni senza
  const wellbeingDays = new Set([
    ...Object.keys(mobilityLog || {}).filter(d => (mobilityLog[d] || []).some(s => (parseFloat(s.pts) || 0) > 0)),
    ...Object.keys(barefootLog || {}).filter(d => (barefootLog[d] || []).some(s => (parseFloat(s.pts) || 0) > 0)),
    ...Object.keys(hangLog || {}).filter(d => (hangLog[d] || []).some(s => (parseFloat(s.pts) || 0) > 0)),
  ])
  if (wellbeingDays.size >= MIN_DAYS_PER_GROUP) {
    const withIt = exerciseDates.filter(d => wellbeingDays.has(d)).map(d => getDayEffort(exerciseLog, d))
    const withoutIt = exerciseDates.filter(d => !wellbeingDays.has(d)).map(d => getDayEffort(exerciseLog, d))
    if (withIt.length >= MIN_DAYS_PER_GROUP && withoutIt.length >= MIN_DAYS_PER_GROUP) {
      const a = avg(withIt), b = avg(withoutIt)
      insights.push({
        icon: '🔗',
        text: a > b
          ? `Nei giorni in cui fai mobility, barefoot o hang ti alleni di più in media: ${a}pt contro ${b}pt negli altri giorni.`
          : `Per ora non emerge un legame chiaro tra le attività di benessere e quanto ti alleni.`,
      })
    }
  }

  // 2) Giorni social dopo mezzogiorno vs prima — confronto con sforzo allenamento
  const afterNoonDates = Object.keys(mindSocialLog || {}).filter(d => mindSocialLog[d]?.afterNoon)
  const beforeNoonDates = Object.keys(mindSocialLog || {}).filter(d => mindSocialLog[d] && !mindSocialLog[d].afterNoon)
  if (afterNoonDates.length >= MIN_DAYS_PER_GROUP && beforeNoonDates.length >= MIN_DAYS_PER_GROUP) {
    const a = avg(afterNoonDates.map(d => getDayEffort(exerciseLog, d)))
    const b = avg(beforeNoonDates.map(d => getDayEffort(exerciseLog, d)))
    insights.push({
      icon: '📱',
      text: a > b
        ? `Nei giorni in cui apri YouTube/Social solo dopo mezzogiorno ti alleni di più: ${a}pt contro ${b}pt negli altri giorni.`
        : `Aprire i social dopo mezzogiorno non sembra ancora avere un impatto chiaro sul tuo allenamento.`,
    })
  }

  return insights
}
