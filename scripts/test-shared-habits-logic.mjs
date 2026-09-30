// Test della LOGICA delle Cloud Function mirrorSharedHabits/setPartnerHabitStatus
// contro un vero Firestore emulato (Admin SDK), usando esattamente le stesse
// funzioni pure di functions/sharedHabits.js che girano in produzione — qui si
// verifica solo il "collante" (transazione reale, trigger reale), la logica in
// sé è già coperta da functions/sharedHabits.test.js.
// Uso:  firebase emulators:start --only firestore --project demo-glp
//       node scripts/test-shared-habits-logic.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')
const shared = require('../functions/sharedHabits.js')

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
const app = admin.initializeApp({ projectId: 'demo-glp' }, 'logic-test')
const db = app.firestore()

const results = []
async function check(name, fn) {
  try { await fn(); results.push(1); console.log('✔', name) }
  catch (e) { results.push(0); console.log('✘', name, '\n   ', e.stack.split('\n').slice(0, 2).join('\n   ')) }
}

const today = new Date().toISOString().slice(0, 10)

await db.doc('users/flavio').set({
  habits: [
    { id: 'f1', name: 'Cold Shower', reward: 3, penalty: 1, why: 'MOTIVO-PRIVATO', voiceNotes: [{ text: 'NOTA-PRIVATA' }] },
    { id: 'f2', name: 'Workout', reward: 4, rewardMin: 2, penalty: 2, isMulti: true },
    { id: 'f3', name: 'Sonno', numericType: 'x', numericConfig: { threshold: 7 } },
  ],
  tags: [{ id: 't1', name: 'Salute' }], dailyLogs: {}, profile: { avatar: '🔥' },
  rewards: [{ id: 'fr1', name: 'Film', cost: 10 }],
  diaryLog: { [today]: { text: 'DIARIO-PRIVATO' } },
})
await db.doc('users/simona').set({
  habits: [{ id: 's1', name: 'Yoga', reward: 3, penalty: 1 }], tags: [], dailyLogs: {},
  rewards: [{ id: 'sr1', name: 'Serie TV', cost: 5 }],
})

// ── mirrorSharedHabits (stesso corpo dell'onDocumentWritten in index.js) ──
async function runMirror() {
  const snap = await db.doc('users/flavio').get()
  const payload = shared.buildSharedHabits(snap.data(), new Date().toISOString().slice(0, 10))
  await db.doc('sharedHabits/flavio').set({ ...payload, hash: shared.hashPayload(payload) })
}
await runMirror()

await check('Il mirror non contiene dati privati ed espone le abitudini', async () => {
  const m = (await db.doc('sharedHabits/flavio').get()).data()
  const json = JSON.stringify(m)
  assert.ok(!json.includes('PRIVAT'))
  assert.equal(m.habits.length, 3)
})

// ── setPartnerHabitStatus (stesso corpo della callable in index.js) ──
async function runSetPartnerHabitStatus(caller, habitId, date, action) {
  const target = shared.PARTNER_OF[caller]
  return db.runTransaction(async tx => {
    const ref = db.doc(`users/${target}`)
    const snap = await tx.get(ref)
    const data = snap.data()
    const r = shared.applyHabitAction(data, habitId, date, action)
    if (r.error) { const e = new Error(r.error); e.code = 'failed-precondition'; throw e }
    tx.update(ref, {
      [`dailyLogs.${date}.habits`]: r.entry.habits,
      [`dailyLogs.${date}.failedHabits`]: r.entry.failedHabits,
      [`dailyLogs.${date}.habitLevels`]: r.entry.habitLevels,
      habits: r.habits,
    })
    return r
  })
}

await check('Simona completa un\'abitudine di Flavio → transazione reale su users/flavio', async () => {
  const r = await runSetPartnerHabitStatus('simona', 'f1', today, 'next')
  assert.equal(r.actionType, 'done')
  const f = (await db.doc('users/flavio').get()).data()
  assert.deepEqual(f.dailyLogs[today].habits, ['f1'])
  assert.equal(f.habits.find(h => h.id === 'f1').lastDone, today)
  assert.equal(f.habits.find(h => h.id === 'f1').why, 'MOTIVO-PRIVATO', 'campi privati intatti')
})
await check('Il mirror si aggiorna dopo la scrittura (ri-eseguendo il trigger)', async () => {
  await runMirror()
  const m = (await db.doc('sharedHabits/flavio').get()).data()
  assert.deepEqual(m.dailyLogs[today].habits, ['f1'])
})
await check('Flavio completa un\'abitudine di Simona → transazione reale su users/simona', async () => {
  const r = await runSetPartnerHabitStatus('flavio', 's1', today, 'next')
  assert.equal(r.actionType, 'done')
  const s = (await db.doc('users/simona').get()).data()
  assert.deepEqual(s.dailyLogs[today].habits, ['s1'])
})
await check('Abitudine numerica: rifiutata (solo il proprietario)', async () => {
  await assert.rejects(runSetPartnerHabitStatus('simona', 'f3', today, 'next'), /numeric-owner-only/)
})
await check('Scritture concorrenti sullo stesso giorno non si perdono (transazione)', async () => {
  await Promise.all([
    runSetPartnerHabitStatus('simona', 'f2', today, 'next'),
    runSetPartnerHabitStatus('simona', 'f1', today, 'failed'),
  ])
  const f = (await db.doc('users/flavio').get()).data()
  assert.ok(f.dailyLogs[today].habits.includes('f2') || f.dailyLogs[today].habitLevels?.f2, 'f2 registrata')
  assert.ok(f.dailyLogs[today].failedHabits.includes('f1'), 'f1 fallita')
})

// ── buyPartnerReward (stesso corpo della callable in index.js) ──
async function runBuyPartnerReward(caller, rewardId, date) {
  const target = shared.PARTNER_OF[caller]
  return db.runTransaction(async tx => {
    const ref = db.doc(`users/${target}`)
    const snap = await tx.get(ref)
    const data = snap.data()
    const r = shared.applyRewardPurchase(data, rewardId, date, Date.now())
    if (r.error) { const e = new Error(r.error); e.code = 'failed-precondition'; throw e }
    tx.update(ref, { [`dailyLogs.${date}.purchases`]: r.purchases })
    return r
  })
}

await check('Simona compra un premio del negozio di Flavio → transazione reale su users/flavio, costo dal server', async () => {
  const r = await runBuyPartnerReward('simona', 'fr1', today)
  assert.equal(r.cost, 10)
  const f = (await db.doc('users/flavio').get()).data()
  assert.deepEqual(f.dailyLogs[today].purchases, [{ name: 'Film', cost: 10, time: r.purchases[0].time }])
})
await check('Il mirror include il Negozio Premi e gli acquisti dopo la scrittura', async () => {
  await runMirror()
  const m = (await db.doc('sharedHabits/flavio').get()).data()
  assert.deepEqual(m.rewards, [{ id: 'fr1', name: 'Film', cost: 10 }])
  assert.deepEqual(m.dailyLogs[today].purchases, [{ name: 'Film', cost: 10, time: m.dailyLogs[today].purchases[0].time }])
})
await check('Flavio compra un premio del negozio di Simona → transazione reale su users/simona', async () => {
  const r = await runBuyPartnerReward('flavio', 'sr1', today)
  assert.equal(r.cost, 5)
  const s = (await db.doc('users/simona').get()).data()
  assert.deepEqual(s.dailyLogs[today].purchases, [{ name: 'Serie TV', cost: 5, time: r.purchases[0].time }])
})
await check('Acquisto: rifiuta premio inesistente', async () => {
  await assert.rejects(runBuyPartnerReward('simona', 'nope', today), /reward-not-found/)
})

// ── setPartnerNumericValue (stesso corpo della callable in index.js) ──
async function runSetPartnerNumericValue(caller, habitId, date, value) {
  const target = shared.PARTNER_OF[caller]
  return db.runTransaction(async tx => {
    const ref = db.doc(`users/${target}`)
    const snap = await tx.get(ref)
    const data = snap.data()
    const r = shared.applyNumericValue(data, habitId, date, value)
    if (r.error) { const e = new Error(r.error); e.code = 'failed-precondition'; throw e }
    tx.update(ref, {
      [`dailyLogs.${date}.habits`]: r.entryHabits,
      [`dailyLogs.${date}.habitValues`]: r.habitValues,
    })
    return r
  })
}

await check('Simona inserisce un valore numerico per Flavio (rimosso vincolo solo-proprietario) → transazione reale', async () => {
  const r = await runSetPartnerNumericValue('simona', 'f3', today, '7.5')
  assert.deepEqual(r.habitValues, { f3: '7.5' })
  const f = (await db.doc('users/flavio').get()).data()
  assert.equal(f.dailyLogs[today].habitValues.f3, '7.5')
  assert.ok(f.dailyLogs[today].habits.includes('f3'), 'segnata come fatta per la visibilità')
})
await check('Valore numerico: rifiuta abitudine non numerica e obiettivo', async () => {
  await assert.rejects(runSetPartnerNumericValue('simona', 'f1', today, '1'), /not-numeric/)
})

console.log(`\n${results.filter(Boolean).length}/${results.length} controlli superati`)
process.exit(results.includes(0) ? 1 : 0)
