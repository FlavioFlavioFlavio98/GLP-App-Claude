// Abitudini condivise Flavio + Simona — lato client.
//
// applyHabitAction è la stessa transizione di stato eseguita dalla Cloud
// Function setPartnerHabitStatus (functions/sharedHabits.js): serve per
// l'aggiornamento OTTIMISTICO in UI (il tap si vede subito, senza aspettare il
// giro di rete + il cold start della function). Il test
// src/lib/partnerHabits.test.mjs verifica che le due copie restino identiche.
import { getItemValueAtDate } from './habitLogic'

export const PARTNER_OF = { flavio: 'simona', simona: 'flavio' }

export const USER_LABEL = { flavio: 'Flavio', simona: 'Simona' }

function stableId(h) {
  return h.id || String(h.name || '').replace(/[^a-zA-Z0-9]/g, '')
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

// Le abitudini numeriche (valore da inserire) e gli obiettivi non sono
// completabili dall'altro: solo il proprietario.
export function isPartnerCompletable(habit) {
  if (!habit) return false
  if (habit.type === 'goal') return false
  if (habit.numericType && habit.numericConfig) return false
  return true
}

export function applyHabitAction(data, habitId, date, action) {
  const habits = [...(data.habits || [])]
  const idx = habits.findIndex(h => stableId(h) === habitId)
  if (idx < 0) return { error: 'habit-not-found' }
  const habit = habits[idx]
  if (!isPartnerCompletable(habit)) return { error: habit.type === 'goal' ? 'not-allowed' : 'numeric-owner-only' }
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

  if (entry.habits.includes(habitId)) {
    habits[idx] = { ...habit, lastDone: date }
  } else if (habit.lastDone) {
    const { lastDone, ...rest } = habit
    habits[idx] = rest
  }

  return { entry, habits, actionType }
}

// Applica il risultato di applyHabitAction a una copia dei dati utente
// (per l'aggiornamento ottimistico nello stato locale).
export function patchUserData(data, date, result) {
  const prevDay = data.dailyLogs && data.dailyLogs[date]
  const dayObj = (prevDay && !Array.isArray(prevDay)) ? prevDay : {}
  return {
    ...data,
    habits: result.habits,
    dailyLogs: { ...(data.dailyLogs || {}), [date]: { ...dayObj, ...result.entry } },
  }
}

// Acquisto di un premio DELL'ALTRO (Negozio Premi condiviso) — stessa
// transizione della Cloud Function buyPartnerReward (functions/sharedHabits.js),
// usata qui per l'aggiornamento ottimistico. Il costo è sempre letto dal
// documento del proprietario, mai passato dal chiamante.
export function applyRewardPurchase(data, rewardId, date, now) {
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

// Applica il risultato di applyRewardPurchase a una copia dei dati utente
// (aggiornamento ottimistico).
export function patchRewardPurchase(data, date, result) {
  const prevDay = data.dailyLogs && data.dailyLogs[date]
  const dayObj = (prevDay && !Array.isArray(prevDay)) ? prevDay : {}
  return {
    ...data,
    dailyLogs: { ...(data.dailyLogs || {}), [date]: { ...dayObj, purchases: result.purchases } },
  }
}

// Inserimento del valore di un'abitudine NUMERICA dell'ALTRO — stessa
// transizione della Cloud Function setPartnerNumericValue
// (functions/sharedHabits.js), usata qui per l'aggiornamento ottimistico.
// Gli obiettivi (goal) restano sempre solo del proprietario.
export function applyNumericValue(data, habitId, date, value) {
  const habits = data.habits || []
  const habit = habits.find(h => stableId(h) === habitId)
  if (!habit) return { error: 'habit-not-found' }
  if (habit.type === 'goal') return { error: 'not-allowed' }
  if (!habit.numericConfig) return { error: 'not-numeric' }

  const raw = normalizeDay(data.dailyLogs && data.dailyLogs[date])
  const entryHabits = [...raw.habits]
  if (!entryHabits.includes(habitId)) entryHabits.push(habitId)
  const habitValues = { ...raw.habitValues, [habitId]: value }

  return { entryHabits, habitValues }
}

// Applica il risultato di applyNumericValue a una copia dei dati utente.
export function patchNumericValue(data, date, result) {
  const prevDay = data.dailyLogs && data.dailyLogs[date]
  const dayObj = (prevDay && !Array.isArray(prevDay)) ? prevDay : {}
  return {
    ...data,
    dailyLogs: { ...(data.dailyLogs || {}), [date]: { ...dayObj, habits: result.entryHabits, habitValues: result.habitValues } },
  }
}

// Aggiorna il valore di un OBIETTIVO (goal) dell'ALTRO — stessa transizione
// della Cloud Function setPartnerGoalValue (functions/sharedHabits.js). Non
// è legato a un giorno: il progresso vive su habit.goalConfig, non su
// dailyLogs. `todayStr` va passato dal chiamante per restare pura/testabile.
export function applyGoalValue(data, habitId, value, todayStr) {
  const habits = [...(data.habits || [])]
  const idx = habits.findIndex(h => h.id === habitId)
  if (idx < 0) return { error: 'habit-not-found' }
  const habit = habits[idx]
  if (habit.type !== 'goal') return { error: 'not-goal' }

  const gc = habit.goalConfig || {}
  const target = gc.targetValue || 1
  const newGc = { ...gc, currentValue: value }
  const justCompleted = value >= target && !gc.completedAt
  if (justCompleted) newGc.completedAt = todayStr
  habits[idx] = { ...habit, goalConfig: newGc }

  return { habits, justCompleted, rewardOnComplete: gc.rewardOnComplete || 0 }
}

// Applica il risultato di applyGoalValue a una copia dei dati utente.
export function patchGoalValue(data, result) {
  return { ...data, habits: result.habits }
}
