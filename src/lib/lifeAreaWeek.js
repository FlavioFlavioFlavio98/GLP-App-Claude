// Logica pura della tab Aree: voci frequenti, vista settimanale, intenzioni,
// mappa di equilibrio. Nessun accesso a Firestore qui (testata in
// lifeAreaWeek.test.mjs). Date sempre come stringhe locali 'YYYY-MM-DD'.

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const WEEKDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

function parse(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

function fmt(dt) {
  return dt.toISOString().slice(0, 10)
}

export function addDays(dateStr, delta) {
  const dt = parse(dateStr)
  dt.setUTCDate(dt.getUTCDate() + delta)
  return fmt(dt)
}

// Lunedì della settimana che contiene dateStr (settimana lun–dom).
export function mondayOf(dateStr) {
  const dow = parse(dateStr).getUTCDay() // 0 = dom
  return addDays(dateStr, dow === 0 ? -6 : 1 - dow)
}

export function weekDays(mondayStr) {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i))
}

export function weekLabel(mondayStr) {
  const a = parse(mondayStr)
  const b = parse(addDays(mondayStr, 6))
  const sameMonth = a.getUTCMonth() === b.getUTCMonth()
  return sameMonth
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
    : `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
}

export function shortDayLabel(dateStr) {
  const dt = parse(dateStr)
  return `${WEEKDAYS[dt.getUTCDay()]} ${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`
}

// Voci di un'area in un giorno: note del diario + sessioni (timer/manuali),
// ordinate per orario. Le sessioni hanno kind 'session' e la durata.
export function entriesFor(data, areaId, dateStr) {
  const notes = (data?.lifeAreaNotes?.[dateStr] || [])
    .filter(n => n.areaId === areaId)
    .map(n => ({ kind: 'note', id: n.id, text: n.text, time: n.time || '' }))
  const sessions = (data?.lifeAreaLog?.[dateStr] || [])
    .filter(s => s.areaId === areaId)
    .map(s => ({ kind: 'session', id: s.id, text: s.note || '', duration: s.duration, time: s.time || '' }))
  return [...notes, ...sessions].sort((x, y) => x.time.localeCompare(y.time))
}

// Un'area è "compilata" in un giorno se ha almeno una nota o una sessione —
// stesso criterio usato dalla notifica serale Android (NotificationReceiver.kt).
export function isAreaFilled(data, areaId, dateStr) {
  return (data?.lifeAreaNotes?.[dateStr] || []).some(n => n.areaId === areaId)
    || (data?.lifeAreaLog?.[dateStr] || []).some(s => s.areaId === areaId)
}

// Voci più frequenti di un'area (per i pulsanti a un tocco): conteggio sulle
// note passate, a parità di frequenza vince la più recente. Le voci lunghe non
// sono adatte a un pulsante e restano fuori; `exclude` toglie quelle già
// scritte nel giorno corrente.
export function frequentEntries(lifeAreaNotes, areaId, { exclude = [], limit = 4, maxLen = 40 } = {}) {
  const map = new Map()
  for (const [date, list] of Object.entries(lifeAreaNotes || {})) {
    for (const n of list || []) {
      if (n.areaId !== areaId) continue
      const text = (n.text || '').trim()
      if (!text || text.length > maxLen) continue
      const key = text.toLowerCase()
      const e = map.get(key) || { text, count: 0, last: '' }
      e.count++
      if (date >= e.last) { e.last = date; e.text = text }
      map.set(key, e)
    }
  }
  const ex = new Set(exclude.map(t => (t || '').trim().toLowerCase()))
  return [...map.entries()]
    .filter(([key]) => !ex.has(key))
    .map(([, e]) => e)
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, limit)
    .map(e => e.text)
}

// Riepilogo di una settimana: per area, i giorni con almeno una voce.
export function weekSummary(data, areas, mondayStr) {
  const days = weekDays(mondayStr)
  return areas.map(area => {
    const byDay = days
      .map(date => ({ date, items: entriesFor(data, area.id, date) }))
      .filter(d => d.items.length > 0)
    return {
      area,
      byDay,
      total: byDay.reduce((n, d) => n + d.items.length, 0),
      daysActive: byDay.length,
    }
  })
}

export function intentionFor(data, mondayStr, areaId) {
  return data?.lifeAreaIntentions?.[mondayStr]?.[areaId] || ''
}

// Mappa di equilibrio: per ogni area, `weeks` settimane complete (lun–dom) che
// finiscono con quella di endMondayStr. count = voci del giorno; future = giorno
// non ancora arrivato (da mostrare spento, non come "vuoto").
export function balanceGrid(data, areas, endMondayStr, todayStr, weeks = 4) {
  const start = addDays(endMondayStr, -7 * (weeks - 1))
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i))
  return areas.map(area => {
    const cells = days.map(date => ({
      date,
      count: date > todayStr ? 0 : entriesFor(data, area.id, date).length,
      future: date > todayStr,
    }))
    const pastDays = cells.filter(c => !c.future).length
    return { area, cells, activeDays: cells.filter(c => c.count > 0).length, pastDays }
  })
}
