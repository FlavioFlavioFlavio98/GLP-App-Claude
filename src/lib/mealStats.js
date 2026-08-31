import { toDateString } from './habitLogic'

// ─── Pasti consapevoli ──────────────────────────────────────────────────────
// Trattare il pasto come una "sessione" (start/end, come un allenamento)
// invece di una semplice abitudine da spuntare — richiesta esplicita di
// Flavio per un problema digestivo reale legato al mangiare troppo in fretta.
// mealLog: { [dateStr]: [{id, time, durationMin, level, pts}] }
// level: 1 veloce, 2 normale, 3 con calma — non possiamo rilevare le
// masticazioni senza sensori, quindi è un'autovalutazione subito dopo il
// pasto, sullo stesso principio dello sforzo percepito negli esercizi.

const MEAL_RATE_KEY = 'glp_meal_pts_per_min'
export const DEFAULT_MEAL_RATE = 0.3

export function getMealRate() {
  try {
    const stored = localStorage.getItem(MEAL_RATE_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_MEAL_RATE
  } catch { return DEFAULT_MEAL_RATE }
}

export function setMealRate(rate) {
  try { localStorage.setItem(MEAL_RATE_KEY, String(Math.max(0.01, rate))) } catch { /* ignore */ }
}

// ─── Pasti non tracciati (penalità) ─────────────────────────────────────────
// Registrare un pasto mangiato ma non cronometrato costa punti — l'obiettivo
// è disincentivare i "buchi" nel tracking (richiesta esplicita di Flavio: "mi
// motiva a tracciare tutto"), non punire l'aver mangiato in fretta quel
// pasto (che non sappiamo, non essendo stato cronometrato).
const MEAL_UNTRACKED_PENALTY_KEY = 'glp_meal_untracked_penalty'
export const DEFAULT_MEAL_UNTRACKED_PENALTY = 2

export function getUntrackedMealPenalty() {
  try {
    const stored = localStorage.getItem(MEAL_UNTRACKED_PENALTY_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_MEAL_UNTRACKED_PENALTY
  } catch { return DEFAULT_MEAL_UNTRACKED_PENALTY }
}

export function setUntrackedMealPenalty(value) {
  try { localStorage.setItem(MEAL_UNTRACKED_PENALTY_KEY, String(Math.max(0.1, value))) } catch { /* ignore */ }
}

// ─── Obiettivo di durata ────────────────────────────────────────────────────
// Impostato prima di iniziare il pasto per dare un traguardo concreto durante
// la sessione ("tieni duro altri 4 minuti") invece di un timer che sale e
// basta — richiesta esplicita di Flavio. Ricordato in locale (non per-pasto)
// così il prossimo pasto riparte già con l'ultimo obiettivo scelto.
const MEAL_TARGET_KEY = 'glp_meal_target_min'
export const DEFAULT_MEAL_TARGET = 15
export const MEAL_TARGET_OPTIONS = [5, 10, 15, 20, 25, 30]

export function getMealTarget() {
  try {
    const stored = localStorage.getItem(MEAL_TARGET_KEY)
    const n = parseInt(stored, 10)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_MEAL_TARGET
  } catch { return DEFAULT_MEAL_TARGET }
}

export function setMealTarget(minutes) {
  try { localStorage.setItem(MEAL_TARGET_KEY, String(Math.max(1, Math.round(minutes)))) } catch { /* ignore */ }
}

export const MEAL_LEVELS = [
  { level: 1, label: 'Veloce', sub: 'da rallentare', emoji: '🔴', multiplier: 0.3 },
  { level: 2, label: 'Normale', sub: 'nella media', emoji: '🟡', multiplier: 0.7 },
  { level: 3, label: 'Con calma', sub: 'masticato bene', emoji: '🟢', multiplier: 1.2 },
]

export function getMealLevelInfo(level) {
  return MEAL_LEVELS.find(l => l.level === level) || MEAL_LEVELS[1]
}

export function computeMealPoints(durationMin, level) {
  const mult = getMealLevelInfo(level).multiplier
  return Math.round(durationMin * getMealRate() * mult * 10) / 10
}

function flattenEntries(mealLog) {
  const entries = []
  Object.entries(mealLog || {}).forEach(([date, sessions]) => {
    (sessions || []).forEach(e => entries.push({ ...e, date }))
  })
  entries.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  return entries
}

export function getMealHistory(mealLog) {
  return flattenEntries(mealLog).reverse()
}

// Raggruppa lo storico (già ordinato dal più recente) per giornata, con il
// totale minuti/pasti di quel giorno — per mostrarlo visivamente diviso
// invece di un'unica lista piatta indistinguibile giorno da giorno.
export function groupMealHistoryByDay(history) {
  const groups = []
  const byDate = new Map()
  history.forEach(e => {
    let group = byDate.get(e.date)
    if (!group) {
      group = { date: e.date, entries: [], totalMin: 0 }
      byDate.set(e.date, group)
      groups.push(group)
    }
    group.entries.push(e)
    if (!e.untracked) group.totalMin += (e.durationMin || 0)
  })
  return groups
}

// Totale minuti mangiati per giorno (somma di tutti i pasti di quel giorno,
// non la media) per gli ultimi N giorni, dal più vecchio al più recente —
// l'unico numero che conta per l'obiettivo di Flavio: "voglio aumentare quel
// tempo", non il numero di pasti o la durata media di uno solo.
export function computeDailyTotals(mealLog, days = 14) {
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const dateStr = toDateString(d)
    // Solo i pasti realmente cronometrati hanno una durata — quelli non
    // tracciati non hanno un tempo da sommare (è proprio il punto: non
    // sappiamo quanto sono durati, altrimenti sarebbero stati tracciati).
    const dayEntries = (mealLog[dateStr] || []).filter(e => !e.untracked)
    result.push({
      date: dateStr,
      totalMin: dayEntries.reduce((s, e) => s + (e.durationMin || 0), 0),
      count: dayEntries.length,
    })
  }
  return result
}

export function computeMealWeekStats(mealLog) {
  const todayStr = toDateString(new Date())
  const weekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return toDateString(d) })()
  const prevWeekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 13); return toDateString(d) })()
  const all = flattenEntries(mealLog)
  const entries = all.filter(e => e.date >= weekCutoff)
  const prevEntries = all.filter(e => e.date >= prevWeekCutoff && e.date < weekCutoff)

  // Le metriche di qualità (durata, calma, streak) contano solo i pasti
  // realmente cronometrati — un pasto "non tracciato" non è un pasto veloce,
  // è un pasto di cui semplicemente non sappiamo nulla, includerlo
  // diluirebbe queste statistiche in modo scorretto. Conta invece per il
  // totale punti (la penalità) e per le statistiche di copertura qui sotto.
  const trackedAll = all.filter(e => !e.untracked)
  const trackedEntries = entries.filter(e => !e.untracked)
  const trackedPrevEntries = prevEntries.filter(e => !e.untracked)

  const netPts = Math.round(entries.reduce((s, e) => s + (parseFloat(e.pts) || 0), 0) * 10) / 10
  const avgDuration = trackedEntries.length > 0
    ? Math.round(trackedEntries.reduce((s, e) => s + (e.durationMin || 0), 0) / trackedEntries.length)
    : 0
  const prevAvgDuration = trackedPrevEntries.length > 0
    ? Math.round(trackedPrevEntries.reduce((s, e) => s + (e.durationMin || 0), 0) / trackedPrevEntries.length)
    : 0
  const calmCount = trackedEntries.filter(e => e.level === 3).length
  const calmPct = trackedEntries.length > 0 ? Math.round((calmCount / trackedEntries.length) * 100) : 0
  const longestMeal = trackedAll.reduce((max, e) => Math.max(max, e.durationMin || 0), 0)
  // "e.durationMin != null" invece di "e.durationMin || Infinity": con
  // l'operatore || un pasto legittimo da 0 minuti verrebbe scambiato per
  // "nessun valore" e ignorato, facendo risultare il più breve più lungo di
  // quanto sia davvero (o "Infinity" se fosse l'unico pasto tracciato).
  const shortestMealRaw = trackedAll.reduce((min, e) => {
    const d = e.durationMin
    return (d != null && d < min) ? d : min
  }, Infinity)
  const shortestMeal = shortestMealRaw === Infinity ? 0 : shortestMealRaw
  const lifetimeTotalMin = trackedAll.reduce((s, e) => s + (e.durationMin || 0), 0)

  // Distribuzione veloce/normale/con calma sulla settimana — non solo la
  // % "con calma" isolata, ma il quadro completo di come si distribuiscono
  // i tre livelli.
  const levelCounts = { 1: 0, 2: 0, 3: 0 }
  trackedEntries.forEach(e => { if (levelCounts[e.level] != null) levelCounts[e.level]++ })
  const levelDistribution = trackedEntries.length > 0
    ? { 1: Math.round((levelCounts[1] / trackedEntries.length) * 100), 2: Math.round((levelCounts[2] / trackedEntries.length) * 100), 3: Math.round((levelCounts[3] / trackedEntries.length) * 100) }
    : { 1: 0, 2: 0, 3: 0 }

  // Media pasti/giorno sui soli giorni in cui è stato tracciato almeno un
  // pasto (non su 7 fissi: altrimenti un utente nuovo con 2 giorni di dati
  // vedrebbe una media artificialmente bassa).
  const trackedDaysThisWeek = new Set(trackedEntries.map(e => e.date)).size
  const avgMealsPerDay = trackedDaysThisWeek > 0 ? Math.round((trackedEntries.length / trackedDaysThisWeek) * 10) / 10 : 0

  // Tempo totale oggi (somma pasti tracciati di oggi) e trend settimanale
  // dello stesso aggregato — il numero che Flavio vuole vedere salire nel
  // tempo.
  const todayEntries = all.filter(e => e.date === todayStr)
  const todayTrackedEntries = todayEntries.filter(e => !e.untracked)
  const todayTotalMin = todayTrackedEntries.reduce((s, e) => s + (e.durationMin || 0), 0)
  const todayUntrackedCount = todayEntries.filter(e => e.untracked).reduce((s, e) => s + (e.count || 1), 0)
  const weekTotalMin = trackedEntries.reduce((s, e) => s + (e.durationMin || 0), 0)
  const prevWeekTotalMin = trackedPrevEntries.reduce((s, e) => s + (e.durationMin || 0), 0)
  const targetHits = trackedEntries.filter(e => e.target && e.durationMin >= e.target).length
  const targetedEntries = trackedEntries.filter(e => e.target).length

  // Copertura del tracking: quanti pasti su tutti quelli registrati (tracciati
  // + non tracciati) sono stati effettivamente cronometrati — il numero che
  // rende visibile se ti stai "dimenticando" spesso.
  const untrackedCount7d = entries.filter(e => e.untracked).reduce((s, e) => s + (e.count || 1), 0)
  const trackedCount7d = trackedEntries.length
  const trackingCoveragePct = (trackedCount7d + untrackedCount7d) > 0
    ? Math.round((trackedCount7d / (trackedCount7d + untrackedCount7d)) * 100)
    : null

  // Record giornaliero (da sempre, non solo ultimi 14gg): il giorno con più
  // minuti totali mangiati — un traguardo motivante indipendente dalla
  // finestra del grafico.
  const totalsByDate = {}
  trackedAll.forEach(e => { totalsByDate[e.date] = (totalsByDate[e.date] || 0) + (e.durationMin || 0) })
  let bestDay = null
  Object.entries(totalsByDate).forEach(([date, totalMin]) => {
    if (!bestDay || totalMin > bestDay.totalMin) bestDay = { date, totalMin }
  })

  return {
    entries, netPts, avgDuration, calmCount, calmPct,
    lifetimeTotal: trackedAll.length, longestMeal, shortestMeal, lifetimeTotalMin,
    durationTrend: (trackedEntries.length > 0 && trackedPrevEntries.length > 0) ? avgDuration - prevAvgDuration : null,
    todayTotalMin, todayMealCount: todayTrackedEntries.length, todayUntrackedCount,
    weekTotalTrend: prevWeekTotalMin > 0 ? weekTotalMin - prevWeekTotalMin : null,
    targetHitPct: targetedEntries > 0 ? Math.round((targetHits / targetedEntries) * 100) : null,
    untrackedCount7d, trackingCoveragePct,
    levelDistribution, avgMealsPerDay, bestDay,
    dailyTotals: computeDailyTotals(mealLog, 14),
    ...computeStreak(trackedAll),
  }
}

function computeStreak(sortedEntries) {
  const dates = [...new Set(sortedEntries.map(e => e.date))].sort()
  const todayStr = toDateString(new Date())
  const yesterdayStr = toDateString(new Date(Date.now() - 86400000))
  const dateSet = new Set(dates)

  let cursor = dateSet.has(todayStr) ? todayStr : (dateSet.has(yesterdayStr) ? yesterdayStr : null)
  let streak = 0
  if (cursor) {
    while (dateSet.has(cursor)) {
      streak++
      // 'T00:00:00' forza il parsing in locale invece che UTC — altrimenti in
      // fusi orari indietro rispetto a UTC (offset negativo) la data risultante
      // sarebbe quella locale del giorno prima (stesso bug che toDateString
      // esiste apposta per evitare, vedi habitLogic.js).
      const d = new Date(cursor + 'T00:00:00'); d.setDate(d.getDate() - 1)
      cursor = toDateString(d)
    }
  }

  // Record storico: la striscia consecutiva più lunga mai fatta, non solo
  // quella attuale — dà un traguardo motivante anche dopo aver saltato dei
  // giorni.
  let bestStreak = 0
  let running = 0
  let prevDate = null
  dates.forEach(dateStr => {
    if (prevDate) {
      const expected = new Date(prevDate + 'T00:00:00'); expected.setDate(expected.getDate() + 1)
      running = (toDateString(expected) === dateStr) ? running + 1 : 1
    } else {
      running = 1
    }
    bestStreak = Math.max(bestStreak, running)
    prevDate = dateStr
  })

  return { streak, bestStreak }
}

// ─── Aforismi ───────────────────────────────────────────────────────────────
// Un promemoria diverso ogni volta che si apre la tab, per rinforzare
// l'obiettivo (mangiare lentamente, masticare) senza diventare ripetitivo.
export const MEAL_QUOTES = [
  'Chi mangia in fretta, mangia due volte: una con la bocca, una con lo stomaco che soffre dopo.',
  'La digestione comincia in bocca: ogni boccone masticato bene è un favore che fai al tuo stomaco.',
  'Posa le posate tra un boccone e l\'altro: il corpo impiega 20 minuti a sentirsi sazio.',
  'Non stai solo mangiando: stai dando al tuo corpo il tempo di dirti quando basta.',
  'Un pasto lento è un pasto che ricordi. Uno veloce è solo carburante ingoiato.',
  'Mastica finché il cibo non ha più forma: è lì che inizia davvero la digestione.',
  'La fretta a tavola si paga dopo, in stomaco pesante. Rallentare oggi è prevenire domani.',
  'Ogni boccone masticato con calma è un piccolo atto di cura verso te stesso.',
  'Non è una gara. Il piatto non scappa.',
  'Respira, posa la forchetta, mastica. Ripeti.',
  'Lo stomaco non ha i denti: il lavoro che non fai in bocca lo paga lui dopo.',
  'Mangiare piano non è un lusso, è manutenzione del corpo.',
  'Il primo boccone lento dà il tono a tutto il pasto.',
  'Chi divora non assapora: stai perdendo il gusto insieme alla calma.',
  'Il corpo digerisce meglio quando la mente si è seduta a tavola con te.',
  'Ogni volta che rallenti, insegni al tuo stomaco a fidarsi di nuovo di te.',
  'Non è quanto mangi, è quanto tempo dai al tuo corpo per gestirlo.',
  'La fame vera aspetta. Quella nervosa no — per questo va rallentata apposta.',
  'Un pasto masticato bene è metà del lavoro già fatto per il tuo stomaco.',
  'Rallentare a tavola è uno dei pochi momenti in cui puoi solo guadagnarci.',
  'Il boccone perfetto non è quello più grande, è quello masticato di più.',
  'Se finisci per primo, probabilmente hai anche masticato per ultimo.',
  'Ogni pausa tra un boccone e l\'altro è un messaggio di calma al tuo sistema nervoso.',
  'Mangiare in fretta è un\'abitudine. Rallentare, con pratica, può diventarlo altrettanto.',
  'Il cibo non scappa, ma la tua attenzione sì se non la alleni a restare a tavola.',
  'Più mastichi, meno lavoro chiedi al resto dell\'apparato digerente.',
  'Un pasto consapevole comincia dall\'odore, prima ancora che dal sapore.',
  'Rallentare non ti fa perdere tempo: te lo restituisce dopo, in meno gonfiore.',
  'La velocità con cui mangi oggi è un\'abitudine che deciderai domattina come sarà.',
  'Tra un boccone e l\'altro, il corpo aspetta solo un segnale: che tu rallenti.',
]

// Benefici scientifici del mangiare lentamente, riassunti da una lista di
// ricerche fornita da Flavio — un beneficio per riga invece del testo esteso,
// stesso tono diretto delle citazioni sopra, da mostrare a rotazione insieme
// a loro durante il pasto per motivare a continuare.
export const MEAL_BENEFITS = [
  'Il cervello impiega 15-20 minuti a registrare la sazietà: mangiare lento gli dà il tempo di dirti basta prima che tu esageri.',
  'Mangiare lentamente alza gli ormoni della sazietà (PYY, GLP-1) e abbassa la grelina: la fame diminuisce da sola.',
  'Chi mangia piano assume meno calorie nello stesso pasto — e anche in quelli dopo.',
  'Un ritmo lento è associato a un rischio più che dimezzato di diabete di tipo 2: niente picchi glicemici che stressano il pancreas.',
  'Mangiare lentamente migliora la risposta insulinica e protegge dall\'insulino-resistenza.',
  'Un ritmo lento riduce il girovita e alza il colesterolo buono (HDL) — protegge dalla sindrome metabolica.',
  'Masticare a lungo produce più saliva: protegge lo stomaco, regola il pH e comincia già a scomporre i carboidrati.',
  'Masticare bene rallenta lo svuotamento gastrico in modo protettivo, evitando di inondare l\'intestino di cibo non digerito.',
  'Mangiare veloce è collegato a più gastriti erosive — masticare è la prima difesa dello stomaco.',
  'Particelle di cibo più piccole significano più superficie per i batteri buoni dell\'intestino: meglio mastichi, meglio li nutri.',
  'Masticare bene aiuta l\'intestino a produrre SCFA (acidi grassi a catena corta) che nutrono e proteggono le pareti intestinali.',
  'Una buona masticazione protegge la barriera intestinale e riduce l\'infiammazione in tutto il corpo, fegato compreso.',
  'Cibo inghiottito a pezzi grandi fermenta male nel colon: gonfiore, stipsi e disbiosi spesso partono da lì.',
  'Masticare lentamente calma il sistema nervoso: meno stress, anche solo per come mangi.',
  'Masticare più a lungo ogni boccone è collegato a più soddisfazione verso il cibo e miglior qualità di vita.',
  'Rallentare ti fa notare colori, profumi e consistenze che a velocità doppia semplicemente non percepisci.',
  'Mangiare con consapevolezza aiuta a distinguere la fame vera da quella emotiva — meno abbuffate, più controllo.',
]

// Contro del mangiare troppo velocemente, stesso criterio di MEAL_BENEFITS —
// mostrati alla pari nella stessa libreria, come richiesto ("trattali al
// pari di aforismi e benefici").
export const MEAL_CONS = [
  'Mangiare veloce salta la finestra di 15-20 minuti in cui il cervello registra la sazietà: finisci per mangiare più di quanto ti serva.',
  'Chi mangia in fretta ha livelli più bassi di GLP-1 e PYY dopo il pasto — gli ormoni che dovrebbero dirti "basta così".',
  'Mangiare veloce è collegato ad aumento di peso nel tempo, in particolare grasso addominale.',
  'I picchi glicemici da pasto veloce costringono il pancreas a produrre insulina a raffica: nel tempo si esaurisce.',
  'Chi mangia veloce ha più del doppio del rischio di sviluppare diabete di tipo 2.',
  'Mangiare in fretta alza la resistenza all\'insulina indipendentemente dal peso corporeo.',
  'Il mangiare veloce è associato quasi al doppio del rischio di sindrome metabolica.',
  'Mangiare veloce abbassa il colesterolo buono (HDL), alza i trigliceridi e la pressione.',
  'Mangiare di corsa scatena citochine infiammatorie che danneggiano i vasi sanguigni e peggiorano l\'insulino-resistenza.',
  'Senza abbastanza saliva (mangiando veloce) lo stomaco deve produrre più acido per compensare.',
  'Cibo inghiottito in pezzi grandi arriva intatto al colon e va in putrefazione invece che in sana fermentazione.',
  'Mangiare veloce danneggia la parete intestinale: le tossine batteriche (LPS) passano nel sangue e infiammano fegato e cuore.',
  'Il mangiare veloce è collegato a gastrite erosiva, fegato grasso e valori epatici alterati.',
]

// ─── Contenuto persistente (aforismi + benefici) ───────────────────────────
// A differenza delle liste statiche sopra (MEAL_QUOTES/MEAL_BENEFITS, usate
// solo come seed iniziale), ogni voce vive su Firestore con un contatore di
// "mi piace", può essere modificata o archiviata per sempre — richiesta
// esplicita di Flavio: le voci più apprezzate devono ripresentarsi più
// spesso delle altre, non a rotazione fissa uguale per tutte.
// Struttura: globalData.mealContent = { [id]: {type, text, likes, archived} }
// — una mappa (non un array) apposta per poter aggiornare un singolo campo
// di una singola voce con un updateDoc a percorso puntato, senza mai dover
// leggere+riscrivere l'intera lista (stessa lezione della perdita dati del
// 28/8/2026 applicata qui fin dall'inizio).
function seedId(prefix, i) { return `${prefix}${i}` }

export function buildDefaultMealContent() {
  const content = {}
  MEAL_QUOTES.forEach((text, i) => {
    content[seedId('q', i)] = { type: 'quote', text, likes: 0, archived: false }
  })
  MEAL_BENEFITS.forEach((text, i) => {
    content[seedId('b', i)] = { type: 'benefit', text, likes: 0, archived: false }
  })
  MEAL_CONS.forEach((text, i) => {
    content[seedId('c', i)] = { type: 'con', text, likes: 0, archived: false }
  })
  return content
}

// PRNG deterministico (mulberry32) — a parità di seed restituisce sempre lo
// stesso valore, così la voce mostrata resta stabile per un minuto intero
// (o finché non si preme "prossimo") invece di cambiare ad ogni render.
function seededRandom(seed) {
  let s = seed | 0
  s = (s + 0x6D2B79F5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Selezione pesata: le voci con più "mi piace" hanno più probabilità di
// essere scelte (peso = 1 + likes, così anche una voce mai apprezzata ha
// sempre una possibilità), ma non è mai deterministicamente sempre la
// stessa — resta comunque una lotteria pesata, non una classifica fissa.
export function pickMealContent(mealContent, offset = 0) {
  const items = Object.entries(mealContent || {})
    .filter(([, v]) => v && !v.archived && v.text)
    .map(([id, v]) => ({ id, ...v }))
  if (items.length === 0) return null

  const seed = Math.floor(Date.now() / 60000) + offset * 97
  const weights = items.map(it => 1 + Math.max(0, it.likes || 0))
  const total = weights.reduce((a, b) => a + b, 0)
  const r = seededRandom(seed) * total
  let acc = 0
  for (let i = 0; i < items.length; i++) {
    acc += weights[i]
    if (r < acc) return items[i]
  }
  return items[items.length - 1]
}

// Lista completa per il pannello di gestione, ordinata per "mi piace"
// decrescente (le più apprezzate in cima, come richiesto) — include anche
// le archiviate in fondo, per poterle eventualmente ripristinare.
export function sortedMealContentList(mealContent) {
  const items = Object.entries(mealContent || {}).map(([id, v]) => ({ id, ...v }))
  return items.sort((a, b) => {
    if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1
    return (b.likes || 0) - (a.likes || 0)
  })
}

// ─── Trick durante il pasto ─────────────────────────────────────────────────
// Mostrati a rotazione insieme al richiamo periodico, azioni concrete da
// fare subito (non massime generiche come le citazioni sopra) — richiesta
// esplicita: "posa la posata, respira, odora e guarda il cibo".
export const EATING_TIPS = [
  { emoji: '🍴', text: 'Posa le posate tra un boccone e l\'altro' },
  { emoji: '🌬️', text: 'Fai un respiro profondo prima del prossimo boccone' },
  { emoji: '👃', text: 'Odora il cibo prima di assaggiarlo' },
  { emoji: '👀', text: 'Guarda bene cosa stai per mangiare, non lo schermo' },
  { emoji: '🦷', text: 'Mastica finché il boccone non ha più consistenza' },
  { emoji: '💧', text: 'Fai una piccola pausa e bevi un sorso d\'acqua' },
  { emoji: '👅', text: 'Nota il sapore: dolce, salato, amaro, acido?' },
  { emoji: '🤔', text: 'Chiediti: ho ancora davvero fame?' },
  { emoji: '🐢', text: 'Rallenta il ritmo delle posate della metà' },
  { emoji: '🧘', text: 'Rilassa le spalle e siediti bene composto' },
]

export function getEatingTip(index) {
  return EATING_TIPS[((index % EATING_TIPS.length) + EATING_TIPS.length) % EATING_TIPS.length]
}
