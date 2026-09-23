'use strict'

// Logica pura (nessuna dipendenza da firebase-admin) per le abitudini
// condivise Flavio + Simona — separata da index.js per poterla testare con un
// semplice `node --test` senza emulatori.
//
// Due responsabilità:
//  1) buildSharedHabits: costruisce il MIRROR in sola lettura (sharedHabits/
//     flavio) con SOLO i dati delle abitudini. users/flavio è un documento
//     monolitico (diario, psicologo, task, peso…): dare a Simona la lettura
//     del documento significherebbe darle tutto, quindi legge solo questa copia.
//  2) applyHabitAction: stessa transizione di stato di setHabitStatus in
//     src/lib/store.jsx (fatta / a livelli / fallita / annulla), eseguita lato
//     server quando uno dei due completa l'abitudine dell'altro. Una copia
//     identica vive in src/lib/partnerHabits.js (aggiornamento ottimistico
//     sul client): il test partnerHabits.test.mjs verifica che restino uguali.

const crypto = require('crypto')

const EMAIL_TO_USER = {
  'flavio.rossi94@gmail.com': 'flavio',
  'simonaballini2000@gmail.com': 'simona',
}
const PARTNER_OF = { flavio: 'simona', simona: 'flavio' }

const MIRROR_DAYS = 365
// Quanti giorni indietro si può completare l'abitudine dell'altro (a fine
// giornata, o al massimo qualche giorno dopo) — mai nel futuro.
const MAX_BACK_DAYS = 30

// Campi personali delle abitudini che NON devono finire nel mirror: note
// vocali/diario abitudine e il "perché" (motivazione personale).
const PRIVATE_HABIT_FIELDS = ['voiceNotes', 'notes', 'why']
// Dei log giornalieri il mirror tiene lo stato di completamento e gli
// acquisti al Negozio Premi (anch'esso condiviso — vedi buyPartnerReward).
const SHARED_LOG_FIELDS = ['habits', 'failedHabits', 'habitLevels', 'habitValues', 'purchases']

function stableId(h) {
  return h.id || String(h.name || '').replace(/[^a-zA-Z0-9]/g, '')
}

// Stessa logica di getItemValueAtDate in src/lib/habitLogic.js (solo i campi
// che servono qui).
function getItemValueAtDate(item, field, dateStr) {
  if (!item) return 0
  if (!item.changes || item.changes.length === 0) {
    if (field === 'isMulti') return item.isMulti || false
    return parseInt(item[field] || 0)
  }
  const sorted = item.changes.slice().sort((a, b) => a.date.localeCompare(b.date))
  let valid = null
  for (const ch of sorted) {
    if (ch.date <= dateStr) valid = ch
    else break
  }
  const src = valid || sorted[0]
  if (field === 'isMulti') return src.isMulti || false
  return parseInt(src[field] || 0)
}

function shiftDate(dateStr, deltaDays) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

function normalizeDay(raw) {
  if (!raw) return { habits: [], failedHabits: [], habitLevels: {}, habitValues: {}, purchases: [] }
  if (Array.isArray(raw)) return { habits: raw, failedHabits: [], habitLevels: {}, habitValues: {}, purchases: [] }
  return {
    habits: raw.habits || [],
    failedHabits: raw.failedHabits || [],
    habitLevels: raw.habitLevels || {},
    habitValues: raw.habitValues || {},
    purchases: raw.purchases || [],
  }
}

function buildSharedHabits(data, todayStr) {
  const since = shiftDate(todayStr, -MIRROR_DAYS)
  const habits = (data.habits || [])
    .filter(h => h && h.type !== 'goal')
    .map(h => {
      const copy = { ...h }
      PRIVATE_HABIT_FIELDS.forEach(f => delete copy[f])
      return copy
    })

  const dailyLogs = {}
  Object.keys(data.dailyLogs || {}).forEach(date => {
    if (date < since) return
    const day = normalizeDay(data.dailyLogs[date])
    const out = {}
    SHARED_LOG_FIELDS.forEach(f => {
      const v = day[f]
      const empty = Array.isArray(v) ? v.length === 0 : (v && typeof v === 'object' ? Object.keys(v).length === 0 : !v)
      if (!empty) out[f] = v
    })
    if (Object.keys(out).length > 0) dailyLogs[date] = out
  })

  return {
    habits,
    tags: data.tags || [],
    dailyLogs,
    rewards: data.rewards || [],
    rewardCategories: data.rewardCategories || [],
    profile: { avatar: (data.profile && data.profile.avatar) || null },
  }
}

function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'
  }
  return JSON.stringify(v === undefined ? null : v)
}

function hashPayload(payload) {
  return crypto.createHash('sha1').update(stableStringify(payload)).digest('hex')
}

// Transizione di stato di una abitudine per un giorno. `data` = documento
// utente (users/<id>). Restituisce { entry, habits, actionType } oppure
// { error }. Le abitudini numeriche (valore da inserire) e gli obiettivi non
// sono completabili dall'altro: solo il proprietario.
function applyHabitAction(data, habitId, date, action) {
  const habits = [...(data.habits || [])]
  const idx = habits.findIndex(h => stableId(h) === habitId)
  if (idx < 0) return { error: 'habit-not-found' }
  const habit = habits[idx]
  if (habit.type === 'goal') return { error: 'not-allowed' }
  if (habit.numericType && habit.numericConfig) return { error: 'numeric-owner-only' }
  if (action !== 'next' && action !== 'failed') return { error: 'bad-action' }

  const isMulti = !!getItemValueAtDate(habit, 'isMulti', date)
  const raw = normalizeDay(data.dailyLogs && data.dailyLogs[date])
  const entry = {
    habits: [...raw.habits],
    failedHabits: [...raw.failedHabits],
    habitLevels: { ...raw.habitLevels },
  }

  const wasDone = entry.habits.includes(habitId)
  const wasLevel = entry.habitLevels[habitId] || 'max'

  if (wasDone) {
    entry.habits = entry.habits.filter(id => id !== habitId)
    delete entry.habitLevels[habitId]
  }
  if (entry.failedHabits.includes(habitId)) {
    entry.failedHabits = entry.failedHabits.filter(id => id !== habitId)
  }

  let actionType = 'neutral'
  if (action === 'failed') {
    entry.failedHabits.push(habitId)
    actionType = 'failed'
  } else if (action === 'next') {
    if (!wasDone) {
      entry.habits.push(habitId)
      if (isMulti) {
        entry.habitLevels[habitId] = 'min'
      } else {
        entry.habitLevels[habitId] = 'max'
        actionType = 'done'
      }
    } else if (isMulti && wasLevel === 'min') {
      entry.habits.push(habitId)
      entry.habitLevels[habitId] = 'max'
      actionType = 'done'
    }
  }

  // lastDone tenuto sincronizzato con "è davvero segnata fatta" (serve alla
  // cadenza multi-giorno, vedi isHabitVisible).
  if (entry.habits.includes(habitId)) {
    habits[idx] = { ...habit, lastDone: date }
  } else if (habit.lastDone) {
    const { lastDone, ...rest } = habit
    habits[idx] = rest
  }

  return { entry, habits, actionType }
}

// Acquisto di un premio DELL'ALTRO (Negozio Premi condiviso). `data` = suo
// documento utente, `rewardId` = id del premio (i premi, a differenza delle
// abitudini, hanno sempre un id). Il costo è sempre letto dal documento del
// proprietario (mai fidarsi di un costo passato dal chiamante): evita che un
// client desincronizzato o manomesso paghi/faccia pagare un importo diverso.
// I premi "tracked" (consumo giornaliero a soglia) restano solo del
// proprietario: la UI di tracciamento non ha senso per il partner.
function applyRewardPurchase(data, rewardId, date, now) {
  const rewards = data.rewards || []
  const reward = rewards.find(r => r.id === rewardId)
  if (!reward) return { error: 'reward-not-found' }
  if (reward.type === 'tracked') return { error: 'not-allowed' }
  if (reward.archivedAt && date >= reward.archivedAt) return { error: 'reward-archived' }

  const cost = getItemValueAtDate(reward, 'cost', date)
  const raw = normalizeDay(data.dailyLogs && data.dailyLogs[date])
  const purchases = [...raw.purchases, { name: reward.name, cost, time: now }]

  return { purchases, cost, name: reward.name }
}

function validateDate(date, todayUtc) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  if (Number.isNaN(new Date(date + 'T00:00:00Z').getTime())) return false
  // +1: tolleranza per fusi orari avanti rispetto a UTC (Italia/Bulgaria).
  if (date > shiftDate(todayUtc, 1)) return false
  if (date < shiftDate(todayUtc, -MAX_BACK_DAYS)) return false
  return true
}

module.exports = {
  EMAIL_TO_USER, PARTNER_OF, MIRROR_DAYS, MAX_BACK_DAYS,
  stableId, getItemValueAtDate, shiftDate,
  buildSharedHabits, hashPayload, applyHabitAction, applyRewardPurchase, validateDate,
}
