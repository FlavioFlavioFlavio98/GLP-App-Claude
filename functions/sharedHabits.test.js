'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const s = require('./sharedHabits')

const TODAY = '2026-09-21'

function baseData() {
  return {
    habits: [
      { id: 'h1', name: 'Cold Shower', reward: 3, penalty: 1, voiceNotes: [{ id: 'n1', text: 'privato' }], why: 'motivo privato', notes: ['x'] },
      { id: 'h2', name: 'Workout', reward: 4, rewardMin: 2, penalty: 2, isMulti: true, changes: [{ date: '2026-01-01', reward: 4, rewardMin: 2, penalty: 2, isMulti: true }] },
      { id: 'h3', name: 'Sonno', reward: 0, numericType: 'x', numericConfig: { threshold: 7 } },
      { id: 'g1', name: 'Obiettivo', type: 'goal', goalConfig: { secret: 1 } },
    ],
    tags: [{ id: 't1', name: 'Salute', color: '#fff' }],
    rewards: [
      { id: 'r1', name: 'Film', cost: 10 },
      { id: 'r2', name: 'Snack tracciato', cost: 2, type: 'tracked' },
    ],
    rewardCategories: [{ id: 'c1', name: 'Svago', color: '#f0f' }],
    dailyLogs: {
      '2026-09-20': { habits: ['h1'], failedHabits: [], habitLevels: { h1: 'max' }, habitNotes: { h1: 'nota privata' }, mood: { a: 1 }, purchases: [{ name: 'Film', cost: 10, time: 1 }], trackedRewards: { r2: { quantity: 2, cost: 4 } }, readingEarned: 3 },
      '2025-01-01': { habits: ['h1'] }, // fuori finestra (> 365 giorni)
      '2026-09-19': ['h2'], // formato legacy (array)
    },
    profile: { avatar: '🔥', name: 'segreto' },
    diary: 'PRIVATO', tasks: [{ title: 'privato' }], psychSessions: [1],
  }
}

test('mirror: tiene abitudini/tag/stato/premi (incluso Negozio Premi) e toglie tutto ciò che è privato', () => {
  const m = s.buildSharedHabits(baseData(), TODAY)
  const json = JSON.stringify(m)
  for (const secret of ['privato', 'PRIVATO', 'motivo', 'nota privata', 'segreto', 'goalConfig', 'mood', 'readingEarned', 'tasks', 'psychSessions']) {
    assert.ok(!json.includes(secret), `il mirror non deve contenere "${secret}"`)
  }
  assert.equal(m.habits.length, 3, 'gli obiettivi (goal) sono esclusi')
  assert.deepEqual(m.profile, { avatar: '🔥' })
  assert.deepEqual(Object.keys(m.dailyLogs).sort(), ['2026-09-19', '2026-09-20'])
  assert.deepEqual(m.dailyLogs['2026-09-19'], { habits: ['h2'] }, 'array legacy normalizzato')
  assert.deepEqual(m.dailyLogs['2026-09-20'], { habits: ['h1'], habitLevels: { h1: 'max' }, purchases: [{ name: 'Film', cost: 10, time: 1 }], trackedRewards: { r2: { quantity: 2, cost: 4 } } }, 'acquisti e premi tracciati condivisi (servono al calcolo coin del partner)')
  assert.deepEqual(m.rewards, baseData().rewards, 'il Negozio Premi è condiviso')
  assert.deepEqual(m.rewardCategories, baseData().rewardCategories)
})

test('hash stabile e sensibile ai cambiamenti', () => {
  const a = s.hashPayload(s.buildSharedHabits(baseData(), TODAY))
  const b = s.hashPayload(s.buildSharedHabits(baseData(), TODAY))
  assert.equal(a, b)
  const d = baseData(); d.dailyLogs['2026-09-20'].habits.push('h2')
  assert.notEqual(a, s.hashPayload(s.buildSharedHabits(d, TODAY)))
  // un cambiamento in un campo privato non deve cambiare l'hash del mirror
  const p = baseData(); p.diary = 'altro'; p.habits[0].why = 'altro'
  assert.equal(a, s.hashPayload(s.buildSharedHabits(p, TODAY)))
})

test('azione: completa, annulla, fallisce (abitudine semplice)', () => {
  const d = baseData()
  let r = s.applyHabitAction(d, 'h1', '2026-09-21', 'next')
  assert.equal(r.actionType, 'done')
  assert.deepEqual(r.entry.habits, ['h1'])
  assert.equal(r.habits.find(h => h.id === 'h1').lastDone, '2026-09-21')
  d.dailyLogs['2026-09-21'] = r.entry; d.habits = r.habits
  r = s.applyHabitAction(d, 'h1', '2026-09-21', 'next')
  assert.equal(r.actionType, 'neutral', 'secondo tap annulla')
  assert.deepEqual(r.entry.habits, [])
  assert.equal(r.habits.find(h => h.id === 'h1').lastDone, undefined)
  r = s.applyHabitAction(d, 'h1', '2026-09-21', 'failed')
  assert.equal(r.actionType, 'failed')
  assert.deepEqual(r.entry.failedHabits, ['h1'])
  assert.deepEqual(r.entry.habits, [])
})

test('azione: abitudine a livelli min -> max -> annulla', () => {
  const d = baseData()
  let r = s.applyHabitAction(d, 'h2', '2026-09-21', 'next')
  assert.equal(r.entry.habitLevels.h2, 'min'); assert.equal(r.actionType, 'neutral')
  d.dailyLogs['2026-09-21'] = r.entry; d.habits = r.habits
  r = s.applyHabitAction(d, 'h2', '2026-09-21', 'next')
  assert.equal(r.entry.habitLevels.h2, 'max'); assert.equal(r.actionType, 'done')
  d.dailyLogs['2026-09-21'] = r.entry; d.habits = r.habits
  r = s.applyHabitAction(d, 'h2', '2026-09-21', 'next')
  assert.deepEqual(r.entry.habits, [])
})

test('azione: non tocca gli altri campi del giorno e gestisce il formato legacy', () => {
  const d = baseData()
  const r = s.applyHabitAction(d, 'h1', '2026-09-19', 'next') // giorno legacy con ['h2']
  assert.deepEqual(r.entry.habits.sort(), ['h1', 'h2'])
})

test('azione: rifiuta numeriche, obiettivi, sconosciute, azioni strane', () => {
  const d = baseData()
  assert.equal(s.applyHabitAction(d, 'h3', TODAY, 'next').error, 'numeric-owner-only')
  assert.equal(s.applyHabitAction(d, 'g1', TODAY, 'next').error, 'not-allowed')
  assert.equal(s.applyHabitAction(d, 'nope', TODAY, 'next').error, 'habit-not-found')
  assert.equal(s.applyHabitAction(d, 'h1', TODAY, 'delete').error, 'bad-action')
})

test('acquisto premio: costo sempre letto dal documento (mai dal chiamante), aggiunto ai purchases del giorno', () => {
  const d = baseData()
  const r = s.applyRewardPurchase(d, 'r1', '2026-09-21', 12345)
  assert.deepEqual(r, { purchases: [{ name: 'Film', cost: 10, time: 12345 }], cost: 10, name: 'Film' })
})

test('acquisto premio: si accumula sugli acquisti già presenti quel giorno', () => {
  const d = baseData()
  const r = s.applyRewardPurchase(d, 'r1', '2026-09-20', 999)
  assert.deepEqual(r.purchases, [{ name: 'Film', cost: 10, time: 1 }, { name: 'Film', cost: 10, time: 999 }])
})

test('acquisto premio: rifiuta premio inesistente, tracciato, o archiviato', () => {
  const d = baseData()
  assert.equal(s.applyRewardPurchase(d, 'nope', TODAY, 1).error, 'reward-not-found')
  assert.equal(s.applyRewardPurchase(d, 'r2', TODAY, 1).error, 'not-allowed', 'i premi "tracked" restano solo del proprietario')
  d.rewards[0].archivedAt = '2026-09-01'
  assert.equal(s.applyRewardPurchase(d, 'r1', TODAY, 1).error, 'reward-archived')
})

test('date valide: non nel futuro, non oltre 30 giorni indietro', () => {
  assert.ok(s.validateDate('2026-09-21', TODAY))
  assert.ok(s.validateDate('2026-09-22', TODAY), 'tolleranza fuso +1')
  assert.ok(s.validateDate('2026-08-22', TODAY))
  assert.ok(!s.validateDate('2026-09-23', TODAY))
  assert.ok(!s.validateDate('2026-08-21', TODAY))
  assert.ok(!s.validateDate('2026-13-45', TODAY))
  assert.ok(!s.validateDate('ieri', TODAY))
  assert.ok(!s.validateDate(20260921, TODAY))
})

test('mappa utenti', () => {
  assert.equal(s.EMAIL_TO_USER['simonaballini2000@gmail.com'], 'simona')
  assert.equal(s.PARTNER_OF.flavio, 'simona')
  assert.equal(s.PARTNER_OF.simona, 'flavio')
  assert.equal(s.EMAIL_TO_USER['flavio.rossi95@gmail.com'], undefined, 'il watch non passa dalle azioni partner')
})
