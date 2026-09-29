import { parseEntry, isHabitVisible, computeDayNet, getItemValueAtDate, toDateString } from './habitLogic'

// ─── Statistiche di coppia (Flavio + Simona) ────────────────────────────────
// Tutte calcolate sulle sole ABITUDINI, con le stesse regole dell'app
// (isHabitVisible per cadenza/date, computeDayNet per i punti): funzionano
// sia sui dati veri (users/<id>) sia sulla copia condivisa (sharedHabits/
// flavio), che ha solo habits + dailyLogs con lo stato di completamento.

function stableId(h) {
  return h.id || String(h.name || '').replace(/[^a-zA-Z0-9]/g, '')
}

function shift(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return toDateString(d)
}

// Lunedì della settimana che contiene dateStr (settimana lun→dom, come il
// resto dell'app).
function weekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay() // 0 = domenica
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return toDateString(d)
}

// Stato di una giornata: quante abitudini "regolari" (non bonus/obiettivi)
// erano dovute, quante fatte, se il giorno è "perfetto" (tutte fatte, quelle a
// livelli al massimo) e i punti netti delle sole abitudini.
export function dayStatus(data, dateStr) {
  const entry = parseEntry(data && data.dailyLogs && data.dailyLogs[dateStr])
  const due = ((data && data.habits) || []).filter(h =>
    h.type !== 'goal' && h.type !== 'if' &&
    isHabitVisible(h, dateStr, entry.habits, entry.failedHabits)
  )
  let done = 0, fully = 0, failed = 0
  due.forEach(h => {
    const id = stableId(h)
    if (entry.habits.includes(id)) {
      done++
      const isMulti = !!getItemValueAtDate(h, 'isMulti', dateStr)
      if (!isMulti || (entry.habitLevels[id] || 'max') === 'max') fully++
    }
    if (entry.failedHabits.includes(id)) failed++
  })
  const n = computeDayNet(data, dateStr)
  return {
    total: due.length, done, failed,
    perfect: due.length > 0 && fully === due.length,
    // Coin abitudini del giorno (guadagni - penalità - acquisti Negozio Premi
    // - premi tracciati) — stessa cifra mostrata come "🪙 Netto coin",
    // mai il punteggio generale dell'app.
    net: Math.round(n.habitCoinsNet * 10) / 10,
    dueIds: due.map(stableId), entry,
  }
}

// Giorni consecutivi "perfetti" fino a oggi (se oggi non è ancora perfetto si
// parte da ieri, come le altre streak dell'app). I giorni senza abitudini
// dovute non spezzano la serie.
export function perfectStreak(data, todayStr, maxDays = 365) {
  let cursor = todayStr
  if (!dayStatus(data, cursor).perfect) cursor = shift(cursor, -1)
  let streak = 0
  for (let i = 0; i < maxDays; i++) {
    const st = dayStatus(data, cursor)
    if (st.total === 0) { cursor = shift(cursor, -1); continue }
    if (!st.perfect) break
    streak++
    cursor = shift(cursor, -1)
  }
  return streak
}

function lastNDays(todayStr, n) {
  return Array.from({ length: n }, (_, i) => shift(todayStr, -(n - 1 - i)))
}

function completionPct(data, days) {
  let total = 0, done = 0
  days.forEach(d => { const s = dayStatus(data, d); total += s.total; done += s.done })
  return total > 0 ? Math.round((done / total) * 100) : null
}

function weekNet(data, todayStr, offsetWeeks) {
  const start = shift(weekStart(todayStr), -7 * offsetWeeks)
  const end = offsetWeeks === 0 ? todayStr : shift(start, 6)
  let sum = 0
  for (let d = start; d <= end; d = shift(d, 1)) sum += dayStatus(data, d).net
  return Math.round(sum * 10) / 10
}

// Abitudine su cui sei più costante / che fallisci più spesso negli ultimi 30
// giorni (servono almeno 5 giorni in cui era dovuta per contare come costante).
function habitInsight(data, days) {
  const stats = {}
  ;((data && data.habits) || []).forEach(h => {
    if (h.type === 'goal' || h.type === 'if') return
    stats[stableId(h)] = { name: h.name, due: 0, done: 0, failed: 0 }
  })
  days.forEach(d => {
    const st = dayStatus(data, d)
    st.dueIds.forEach(id => {
      if (!stats[id]) return
      stats[id].due++
      if (st.entry.habits.includes(id)) stats[id].done++
      if (st.entry.failedHabits.includes(id)) stats[id].failed++
    })
  })
  const list = Object.values(stats)
  const consistent = list.filter(s => s.due >= 5)
    .sort((a, b) => (b.done / b.due) - (a.done / a.due) || b.due - a.due)[0]
  const mostFailed = list.filter(s => s.failed > 0).sort((a, b) => b.failed - a.failed)[0]
  return {
    mostConsistent: consistent ? { name: consistent.name, pct: Math.round((consistent.done / consistent.due) * 100) } : null,
    mostFailed: mostFailed ? { name: mostFailed.name, fails: mostFailed.failed } : null,
  }
}

// people: [{ id, data }, { id, data }]  (gli ID sono 'flavio' / 'simona')
export function computeCoupleStats(people, todayStr) {
  const days30 = lastNDays(todayStr, 30)
  const days7 = lastNDays(todayStr, 7)
  const out = { people: {}, joint: {}, trend: { labels: days30 } }

  people.forEach(({ id, data }) => {
    out.people[id] = {
      streak: perfectStreak(data, todayStr),
      pct7: completionPct(data, days7),
      pct30: completionPct(data, days30),
      week: weekNet(data, todayStr, 0),
      lastWeek: weekNet(data, todayStr, 1),
      insight: habitInsight(data, days30),
    }
    const perDay = days30.map(d => dayStatus(data, d))
    out.trend[id] = {
      net: perDay.map(s => s.net),
      pct: perDay.map(s => (s.total > 0 ? Math.round((s.done / s.total) * 100) : null)),
    }
  })

  // Giorni "perfetti insieme": entrambi hanno completato tutto.
  const [a, b] = people
  const bothPerfect = d => dayStatus(a.data, d).perfect && dayStatus(b.data, d).perfect
  out.joint.perfect30 = days30.filter(bothPerfect).length
  let jointStreak = 0
  let cursor = bothPerfect(todayStr) ? todayStr : shift(todayStr, -1)
  for (let i = 0; i < 365 && bothPerfect(cursor); i++) { jointStreak++; cursor = shift(cursor, -1) }
  out.joint.streak = jointStreak

  const wa = out.people[a.id].week, wb = out.people[b.id].week
  out.joint.leader = wa === wb ? null : (wa > wb ? a.id : b.id)
  out.joint.weekGap = Math.round(Math.abs(wa - wb) * 10) / 10
  return out
}
