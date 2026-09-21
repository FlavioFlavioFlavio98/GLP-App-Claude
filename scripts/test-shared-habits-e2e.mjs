// Test end-to-end delle abitudini condivise contro gli EMULATORI Firebase
// (mai la produzione): regole Firestore per ogni account + Cloud Functions
// mirrorSharedHabits e setPartnerHabitStatus.
//
// Uso:  firebase emulators:start --only auth,firestore,functions --project demo-glp
//       node scripts/test-shared-habits-e2e.mjs
import assert from 'node:assert/strict'
import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'

const PROJECT = 'demo-glp'
const AUTH = 'http://127.0.0.1:9099'
const PASSWORD = 'test-password-123'

const ACCOUNTS = {
  flavio:   { email: 'flavio.rossi94@gmail.com',   verified: true },
  watch:    { email: 'flavio.rossi95@gmail.com',   verified: false }, // account watch: email/password non verificato, deve continuare a funzionare
  simona:   { email: 'simonaballini2000@gmail.com', verified: false }, // verificata più sotto, dopo il test "non verificata"
  stranger: { email: 'sconosciuto@example.com',    verified: true },
}

async function makeClient(name, { email, verified }) {
  const app = initializeApp({ apiKey: 'fake', projectId: PROJECT, authDomain: 'localhost' }, name)
  const auth = getAuth(app); connectAuthEmulator(auth, AUTH, { disableWarnings: true })
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080)
  const fns = getFunctions(app, 'europe-west1'); connectFunctionsEmulator(fns, '127.0.0.1', 5001)
  let cred
  try { cred = await createUserWithEmailAndPassword(auth, email, PASSWORD) }
  catch { cred = await signInWithEmailAndPassword(auth, email, PASSWORD) }
  if (verified) {
    await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?key=fake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: cred.user.uid, emailVerified: true }),
    })
  }
  await signInWithEmailAndPassword(auth, email, PASSWORD)
  await auth.currentUser.getIdToken(true) // rinfresca i claim (email_verified)
  const uid = cred.user.uid
  async function verify() {
    await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?key=fake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: uid, emailVerified: true }),
    })
    await signInWithEmailAndPassword(auth, email, PASSWORD)
    await auth.currentUser.getIdToken(true)
  }
  return { auth, db, verify, call: (n, data) => httpsCallable(fns, n)(data).then(r => r.data) }
}

async function denied(promise, label) {
  try { await promise } catch (e) {
    assert.match(String(e.code || e.message), /permission-denied|PERMISSION_DENIED|permission/i, `${label}: errore inatteso ${e.code || e.message}`)
    return
  }
  assert.fail(`${label}: doveva essere NEGATO ma è riuscito`)
}
async function fnError(promise, code, label) {
  try { await promise } catch (e) {
    assert.ok(String(e.code).includes(code), `${label}: atteso ${code}, ottenuto ${e.code} (${e.message})`)
    return
  }
  assert.fail(`${label}: doveva fallire con ${code}`)
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function waitFor(fn, label, tries = 40) {
  for (let i = 0; i < tries; i++) { const v = await fn(); if (v) return v; await sleep(500) }
  assert.fail(`timeout in attesa di: ${label}`)
}

const results = []
async function check(name, fn) {
  try { await fn(); results.push(['✔', name]); console.log('✔', name) }
  catch (e) { results.push(['✘', name]); console.log('✘', name, '\n   ', e.message.split('\n')[0]); process.exitCode = 1 }
}

const flavio = await makeClient('flavio', ACCOUNTS.flavio)
const watch = await makeClient('watch', ACCOUNTS.watch)
const simona = await makeClient('simona', ACCOUNTS.simona)
const stranger = await makeClient('stranger', ACCOUNTS.stranger)

const today = new Date().toISOString().slice(0, 10)
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

// ── Dati di partenza: Flavio ha dati PRIVATI mescolati alle abitudini ──
await setDoc(doc(flavio.db, 'users', 'flavio'), {
  habits: [
    { id: 'f1', name: 'Cold Shower', reward: 3, penalty: 1, why: 'MOTIVO-PRIVATO', voiceNotes: [{ text: 'NOTA-VOCALE-PRIVATA' }] },
    { id: 'f2', name: 'Workout', reward: 4, rewardMin: 2, penalty: 2, isMulti: true },
    { id: 'f3', name: 'Ore sonno', reward: 0, numericType: 'x', numericConfig: { threshold: 7, pointsPerUnit: 1 } },
  ],
  tags: [{ id: 't1', name: 'Salute', color: '#4caf50' }],
  dailyLogs: { [yesterday]: { habits: ['f1'], failedHabits: [], habitLevels: { f1: 'max' }, habitNotes: { f1: 'NOTA-GIORNO-PRIVATA' }, readingEarned: 5 } },
  profile: { avatar: '🔥' },
  journalEntries: { [today]: { answer: 'DIARIO-PRIVATO' } },
  diaryLog: { [today]: { text: 'DIARIO-LIBERO-PRIVATO' } },
  tasks: [{ id: 'k1', title: 'TASK-PRIVATA' }],
  psychStats: { note: 'PSICOLOGO-PRIVATO' },
})
await setDoc(doc(flavio.db, 'users', 'simona'), {
  habits: [{ id: 's1', name: 'Yoga', reward: 3, penalty: 1 }],
  tags: [], dailyLogs: {}, profile: { avatar: '⭐' },
})

// ────────────────────────── REGOLE ──────────────────────────
await check('Simona con email NON verificata (registrazione email/password) NON accede a nulla', async () => {
  await denied(getDoc(doc(simona.db, 'users', 'simona')), 'unverified users/simona')
  await denied(getDoc(doc(simona.db, 'sharedHabits', 'flavio')), 'unverified sharedHabits')
  await fnError(simona.call('setPartnerHabitStatus', { habitId: 'f1', date: today, action: 'next' }), 'permission-denied', 'unverified callable')
  await simona.verify() // da qui in poi è il login Google reale di Simona (email verificata)
})
await check('Simona NON può leggere users/flavio', () => denied(getDoc(doc(simona.db, 'users', 'flavio')), 'read users/flavio'))
await check('Simona NON può scrivere users/flavio', () => denied(updateDoc(doc(simona.db, 'users', 'flavio'), { 'dailyLogs.x.habits': ['f1'] }), 'write users/flavio'))
await check('Simona NON può leggere sottocollezioni/backup di Flavio', () => denied(getDoc(doc(simona.db, 'users', 'flavio', 'backups', 'b1')), 'read backups'))
await check('Simona può leggere e scrivere users/simona', async () => {
  const s = await getDoc(doc(simona.db, 'users', 'simona')); assert.ok(s.exists())
  await updateDoc(doc(simona.db, 'users', 'simona'), { 'profile.avatar': '💜' })
})
await check('Simona NON può scrivere sharedHabits', () => denied(setDoc(doc(simona.db, 'sharedHabits', 'flavio'), { habits: [] }), 'write sharedHabits'))
await check('Sconosciuto NON legge nulla', async () => {
  await denied(getDoc(doc(stranger.db, 'users', 'simona')), 'stranger users/simona')
  await denied(getDoc(doc(stranger.db, 'users', 'flavio')), 'stranger users/flavio')
  await denied(getDoc(doc(stranger.db, 'sharedHabits', 'flavio')), 'stranger sharedHabits')
})
await check('Flavio: accesso totale invariato (users/flavio, users/simona, sharedHabits in lettura)', async () => {
  assert.ok((await getDoc(doc(flavio.db, 'users', 'flavio'))).exists())
  assert.ok((await getDoc(doc(flavio.db, 'users', 'simona'))).exists())
})
await check('Flavio NON può scrivere sharedHabits (solo Cloud Function)', () => denied(setDoc(doc(flavio.db, 'sharedHabits', 'flavio'), { habits: [] }), 'flavio write sharedHabits'))
await check('Account watch (flavio.rossi95, non verificato) continua ad accedere a users/flavio', async () => {
  assert.ok((await getDoc(doc(watch.db, 'users', 'flavio'))).exists())
})

// ────────────────────────── MIRROR ──────────────────────────
let mirror
await check('Il trigger crea sharedHabits/flavio e Simona lo può leggere', async () => {
  mirror = await waitFor(async () => { const s = await getDoc(doc(simona.db, 'sharedHabits', 'flavio')).catch(() => null); return s && s.exists() ? s.data() : null }, 'mirror')
  assert.equal(mirror.habits.length, 3)
  assert.equal(mirror.profile.avatar, '🔥')
})
await check('Il mirror NON contiene NESSUN dato privato', () => {
  const json = JSON.stringify(mirror)
  for (const secret of ['PRIVAT', 'MOTIVO', 'NOTA-', 'DIARIO', 'TASK-', 'PSICOLOGO', 'readingEarned', 'voiceNotes', 'habitNotes']) {
    assert.ok(!json.includes(secret), `il mirror contiene "${secret}"`)
  }
  assert.ok(json.includes('Cold Shower') && json.includes('f1'))
})

// ────────────────────────── COMPLETAMENTO INCROCIATO ──────────────────────────
await check('Simona completa un\'abitudine di Flavio → users/flavio e mirror aggiornati', async () => {
  const r = await simona.call('setPartnerHabitStatus', { habitId: 'f1', date: today, action: 'next' })
  assert.equal(r.actionType, 'done')
  const f = (await getDoc(doc(flavio.db, 'users', 'flavio'))).data()
  assert.deepEqual(f.dailyLogs[today].habits, ['f1'])
  assert.equal(f.habits.find(h => h.id === 'f1').lastDone, today)
  // i campi privati di Flavio NON sono stati toccati
  assert.equal(f.habits.find(h => h.id === 'f1').why, 'MOTIVO-PRIVATO')
  assert.equal(f.habits.find(h => h.id === 'f1').voiceNotes[0].text, 'NOTA-VOCALE-PRIVATA')
  assert.equal(f.dailyLogs[yesterday].habitNotes.f1, 'NOTA-GIORNO-PRIVATA')
  assert.equal(f.dailyLogs[yesterday].readingEarned, 5)
  assert.equal(f.journalEntries[today].answer, 'DIARIO-PRIVATO')
  const m = await waitFor(async () => { const s = (await getDoc(doc(simona.db, 'sharedHabits', 'flavio'))).data(); return s.dailyLogs[today]?.habits?.includes('f1') ? s : null }, 'mirror aggiornato')
  assert.ok(m)
})
await check('Secondo tap annulla; "failed" segna fallita', async () => {
  let r = await simona.call('setPartnerHabitStatus', { habitId: 'f1', date: today, action: 'next' })
  assert.equal(r.actionType, 'neutral')
  r = await simona.call('setPartnerHabitStatus', { habitId: 'f1', date: today, action: 'failed' })
  assert.equal(r.actionType, 'failed')
  const f = (await getDoc(doc(flavio.db, 'users', 'flavio'))).data()
  assert.deepEqual(f.dailyLogs[today].failedHabits, ['f1'])
})
await check('Abitudine a livelli: min poi max', async () => {
  let r = await simona.call('setPartnerHabitStatus', { habitId: 'f2', date: today, action: 'next' })
  assert.equal(r.actionType, 'neutral')
  r = await simona.call('setPartnerHabitStatus', { habitId: 'f2', date: today, action: 'next' })
  assert.equal(r.actionType, 'done')
})
await check('Flavio completa un\'abitudine di Simona → users/simona aggiornato', async () => {
  const r = await flavio.call('setPartnerHabitStatus', { habitId: 's1', date: today, action: 'next' })
  assert.equal(r.actionType, 'done')
  const s = (await getDoc(doc(flavio.db, 'users', 'simona'))).data()
  assert.deepEqual(s.dailyLogs[today].habits, ['s1'])
})
await check('Abitudini numeriche: solo il proprietario (rifiutate)', () => fnError(simona.call('setPartnerHabitStatus', { habitId: 'f3', date: today, action: 'next' }), 'failed-precondition', 'numerica'))
await check('Data nel futuro / troppo vecchia / malformata rifiutate', async () => {
  const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  const old = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10)
  await fnError(simona.call('setPartnerHabitStatus', { habitId: 'f1', date: future, action: 'next' }), 'invalid-argument', 'futuro')
  await fnError(simona.call('setPartnerHabitStatus', { habitId: 'f1', date: old, action: 'next' }), 'invalid-argument', 'vecchia')
  await fnError(simona.call('setPartnerHabitStatus', { habitId: 'f1', date: 'ieri', action: 'next' }), 'invalid-argument', 'malformata')
})
await check('Abitudine inesistente / azione non valida rifiutate', async () => {
  await fnError(simona.call('setPartnerHabitStatus', { habitId: 'zzz', date: today, action: 'next' }), 'failed-precondition', 'inesistente')
  await fnError(simona.call('setPartnerHabitStatus', { habitId: 'f1', date: today, action: 'delete' }), 'invalid-argument', 'azione')
})
await check('Sconosciuto e account watch NON possono usare la funzione', async () => {
  await fnError(stranger.call('setPartnerHabitStatus', { habitId: 'f1', date: today, action: 'next' }), 'permission-denied', 'sconosciuto')
  await fnError(watch.call('setPartnerHabitStatus', { habitId: 'f1', date: today, action: 'next' }), 'permission-denied', 'watch')
})

console.log(`\n${results.filter(r => r[0] === '✔').length}/${results.length} controlli superati`)
process.exit(process.exitCode || 0)
