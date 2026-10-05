// Momenti di consapevolezza — logica pura (testata in mindful.test.mjs).
// Dati su users/flavio, scritti anche dall'app Wear OS (MindfulStore.kt):
//   mindfulLog: { 'YYYY-MM-DD': ['HH:mm:ss', ...] }   un orario per ogni momento
//   mindfulGoal: numero di momenti al giorno da raggiungere (default 3)
// Volutamente solo orari (niente oggetti/punti): si registra con un tocco dal
// polso, più volte al giorno, e il documento non deve gonfiarsi.

export const DEFAULT_MINDFUL_GOAL = 3

function parse(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

function addDays(dateStr, delta) {
  const dt = parse(dateStr)
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

export function mindfulGoal(data) {
  const g = parseInt(data?.mindfulGoal)
  return g >= 1 ? g : DEFAULT_MINDFUL_GOAL
}

export function mindfulTimes(data, dateStr) {
  return (data?.mindfulLog?.[dateStr] || []).slice().sort()
}

export function mindfulCount(data, dateStr) {
  return (data?.mindfulLog?.[dateStr] || []).length
}

// Ultimi `days` giorni fino a todayStr (incluso), dal più vecchio al più recente.
export function mindfulHistory(data, todayStr, days = 7) {
  const goal = mindfulGoal(data)
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(todayStr, i - (days - 1))
    const count = mindfulCount(data, date)
    return { date, count, reached: count >= goal }
  })
}

// Giorni consecutivi con obiettivo raggiunto. Oggi conta se già raggiunto, ma
// se non lo è ancora non azzera la serie (la giornata non è finita).
export function mindfulStreak(data, todayStr) {
  const goal = mindfulGoal(data)
  let streak = 0
  let date = todayStr
  if (mindfulCount(data, date) < goal) date = addDays(date, -1)
  while (mindfulCount(data, date) >= goal) {
    streak++
    date = addDays(date, -1)
  }
  return streak
}
