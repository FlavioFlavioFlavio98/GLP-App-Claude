// Verifica la separazione tra punteggio generale (calculateTotalScore) e coin
// abitudini (calculateTotalHabitCoins) — richiesta esplicita di Flavio
// (29/9/2026): le abitudini e gli acquisti al Negozio Premi non devono più
// contribuire al punteggio generale, e viceversa.
// Uso: node src/lib/habitLogic.test.mjs
import assert from 'node:assert/strict'
import { computeDayNet, calculateTotalScore, calculateTotalHabitCoins } from './habitLogic.js'

const DATE = '2026-09-29'

const userData = {
  habits: [
    { id: 'h1', name: 'Cold Shower', reward: 5, penalty: 2 },
    { id: 'h2', name: 'Workout', reward: 3, penalty: 1 },
    { id: 'g1', name: 'Obiettivo', type: 'goal', goalConfig: { completedAt: DATE, rewardOnComplete: 20 } },
  ],
  dailyLogs: {
    [DATE]: {
      habits: ['h1'], // fatta: +5
      failedHabits: ['h2'], // fallita: -1
      habitLevels: {},
      purchases: [{ name: 'Film', cost: 4, time: 1 }], // -4
      trackedRewards: { r1: { quantity: 1, cost: 2 } }, // -2
      checkIns: { morning: { done: true, pts: 1 } }, // +1 (generale)
      readingEarned: 3, // +3 (generale)
    },
  },
  tasks: [
    { id: 't1', status: 'completed', completedAt: `${DATE}T10:00:00.000Z`, reward: 7 }, // +7 (generale)
  ],
}

// ── computeDayNet: netto generale separato dai coin abitudini ──
const n = computeDayNet(userData, DATE)
assert.equal(n.totalHabitPoints, 5, 'solo h1 completata')
assert.equal(n.penaltyCost, 1, 'penalità di h2 fallita')
assert.equal(n.purchaseCost, 4)
assert.equal(n.trackedCost, 2)
assert.equal(n.habitCoinsNet, 5 - 1 - 4 - 2, 'coin = guadagni abitudine - penalità - acquisti - tracciati')
assert.equal(n.taskPts, 7)
assert.equal(n.checkInPts, 1)
assert.equal(n.readingPts, 3)
assert.equal(n.net, 7 + 1 + 3, 'netto generale: SOLO task/check-in/letture, mai abitudini/acquisti')
console.log('✔ computeDayNet separa correttamente netto generale e coin abitudini')

// ── calculateTotalScore: non include più abitudini/acquisti/bonus obiettivo ──
const score = calculateTotalScore(userData)
assert.equal(score, 7 + 1 + 3, 'score generale = task + check-in + letture, niente abitudini/coin')
console.log('✔ calculateTotalScore esclude abitudini/acquisti/bonus obiettivo')

// ── calculateTotalHabitCoins: abitudini + acquisti + tracciati + bonus obiettivo, mai il resto ──
const coins = calculateTotalHabitCoins(userData)
assert.equal(coins, (5 - 1 - 4 - 2) + 20, 'coin giornalieri + bonus completamento obiettivo')
console.log('✔ calculateTotalHabitCoins include solo abitudini/negozio/bonus obiettivo')
