// Test delle REGOLE Firestore per le abitudini condivise, contro
// l'emulatore Auth+Firestore (mai la produzione).
// Uso:  firebase emulators:start --only auth,firestore --project demo-glp
//       node scripts/test-shared-habits-rules.mjs
import assert from 'node:assert/strict'
import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')

const AUTH = 'http://127.0.0.1:9099'
const PASSWORD = 'test-password-123'

async function makeClient(name, email) {
  const app = initializeApp({ apiKey: 'fake', projectId: 'demo-glp', authDomain: 'localhost' }, name)
  const auth = getAuth(app); connectAuthEmulator(auth, AUTH, { disableWarnings: true })
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080)
  let cred
  try { cred = await createUserWithEmailAndPassword(auth, email, PASSWORD) }
  catch { cred = await signInWithEmailAndPassword(auth, email, PASSWORD) }
  async function verify() {
    await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?key=fake`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: cred.user.uid, emailVerified: true }),
    })
    await signInWithEmailAndPassword(auth, email, PASSWORD)
    await auth.currentUser.getIdToken(true)
  }
  return { auth, db, verify }
}

async function denied(promise, label) {
  try { await promise } catch (e) {
    assert.match(String(e.code || e.message), /permission-denied|PERMISSION_DENIED|permission/i, `${label}: errore inatteso ${e.code || e.message}`)
    return
  }
  assert.fail(`${label}: doveva essere NEGATO ma è riuscito`)
}

const results = []
async function check(name, fn) {
  try { await fn(); results.push(1); console.log('✔', name) }
  catch (e) { results.push(0); console.log('✘', name, '\n   ', e.message.split('\n')[0]); process.exitCode = 1 }
}

// Applica le regole vere del progetto all'emulatore (l'emulatore le legge da
// firebase.json/firestore.rules solo all'avvio: qui le forziamo via Admin API
// REST per essere certi di testare esattamente il file su disco).
async function loadRules() {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  const res = await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-glp:securityRules', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }),
  })
  assert.ok(res.ok, `caricamento regole fallito: ${res.status} ${await res.text()}`)
}
await loadRules()
console.log('Regole caricate da firestore.rules\n')

const flavio = await makeClient('flavio', 'flavio.rossi94@gmail.com')
const watch = await makeClient('watch', 'flavio.rossi95@gmail.com')
const simona = await makeClient('simona', 'simonaballini2000@gmail.com')
const stranger = await makeClient('stranger', 'sconosciuto@example.com')

// Simona parte NON verificata (come una registrazione email/password fatta
// da chiunque): le regole devono bloccarla comunque.
await check('Simona con email NON verificata NON accede a nulla', async () => {
  await denied(getDoc(doc(simona.db, 'users', 'simona')), 'unverified users/simona')
  await denied(getDoc(doc(simona.db, 'sharedHabits', 'flavio')), 'unverified sharedHabits')
})
await simona.verify() // da qui in poi è il login Google reale di Simona (email verificata)

// Dati di partenza scritti con l'Admin SDK (bypassa le regole, esattamente
// come farebbero le Cloud Functions reali): serve soprattutto per popolare
// sharedHabits/flavio, che le regole vietano di scrivere a QUALSIASI client,
// Flavio incluso — solo così possiamo poi testare che nessuno ci scriva.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
const adminApp = admin.initializeApp({ projectId: 'demo-glp' }, 'admin-seed')
const adb = adminApp.firestore()
await adb.doc('users/flavio').set({
  habits: [{ id: 'f1', name: 'Cold Shower', reward: 3, penalty: 1, why: 'MOTIVO-PRIVATO' }],
  dailyLogs: {}, tags: [], profile: { avatar: '🔥' },
  diaryLog: { x: { text: 'DIARIO-PRIVATO' } },
})
await adb.doc('users/simona').set({ habits: [{ id: 's1', name: 'Yoga', reward: 3, penalty: 1 }], dailyLogs: {}, tags: [] })
await adb.doc('sharedHabits/flavio').set({ habits: [{ id: 'f1', name: 'Cold Shower', reward: 3, penalty: 1 }], dailyLogs: {}, tags: [], profile: { avatar: '🔥' } })

await check('Simona NON può leggere users/flavio (documento monolitico)', () => denied(getDoc(doc(simona.db, 'users', 'flavio')), 'read users/flavio'))
await check('Simona NON può scrivere users/flavio', () => denied(updateDoc(doc(simona.db, 'users', 'flavio'), { x: 1 }), 'write users/flavio'))
await check('Simona NON può leggere i backup di Flavio', () => denied(getDoc(doc(simona.db, 'users', 'flavio', 'backups', 'b1')), 'read backups'))
await check('Simona può leggere/scrivere users/simona', async () => {
  assert.ok((await getDoc(doc(simona.db, 'users', 'simona'))).exists())
  await updateDoc(doc(simona.db, 'users', 'simona'), { 'profile.avatar': '💜' })
})
await check('Simona può leggere sharedHabits/flavio (solo abitudini)', async () => {
  const s = await getDoc(doc(simona.db, 'sharedHabits', 'flavio'))
  assert.ok(s.exists())
  assert.ok(!JSON.stringify(s.data()).includes('PRIVATO'))
})
await check('Simona NON può scrivere sharedHabits (solo Admin SDK)', () => denied(setDoc(doc(simona.db, 'sharedHabits', 'flavio'), { habits: [] }), 'write sharedHabits'))
await check('Flavio NON può scrivere sharedHabits (solo Admin SDK)', () => denied(setDoc(doc(flavio.db, 'sharedHabits', 'flavio'), { habits: [] }), 'flavio write sharedHabits'))
await check('Flavio: accesso invariato a entrambi i documenti utente', async () => {
  assert.ok((await getDoc(doc(flavio.db, 'users', 'flavio'))).exists())
  assert.ok((await getDoc(doc(flavio.db, 'users', 'simona'))).exists())
})
await check('Account watch (rossi95) continua ad accedere a users/flavio', async () => {
  assert.ok((await getDoc(doc(watch.db, 'users', 'flavio'))).exists())
})
await check('Sconosciuto non legge nulla', async () => {
  await denied(getDoc(doc(stranger.db, 'users', 'simona')), 'stranger users/simona')
  await denied(getDoc(doc(stranger.db, 'users', 'flavio')), 'stranger users/flavio')
  await denied(getDoc(doc(stranger.db, 'sharedHabits', 'flavio')), 'stranger sharedHabits')
})

console.log(`\n${results.filter(Boolean).length}/${results.length} controlli superati`)
process.exit(process.exitCode || 0)
