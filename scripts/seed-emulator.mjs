// Popola gli emulatori Firebase locali (Auth + Firestore) con un utente di test
// e dati realistici, cosi le funzionalita Workout hanno qualcosa da mostrare
// durante i test. Esegui con `npm run seed:emulator` mentre gli emulatori
// (`npm run emulators`) sono attivi.

import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore'

// Config copiata da src/lib/firebase.js (non importata da li: quel file esegue
// import.meta.env, valido solo sotto Vite, non in uno script Node semplice).
// Va bene comunque: contro l'emulatore questi valori servono solo a inizializzare
// l'SDK, nessuna chiamata raggiunge il progetto Firebase reale.
const firebaseConfig = {
  apiKey: 'AIzaSyA001klzJou17djB76Q-t2eRTKbU9NZoQs',
  authDomain: 'gamification-life-project.firebaseapp.com',
  projectId: 'gamification-life-project',
  storageBucket: 'gamification-life-project.firebasestorage.app',
  messagingSenderId: '925252547674',
  appId: '1:925252547674:web:1316a5d96cb54c0a515463',
}

const TEST_EMAIL = 'flavio.rossi94@gmail.com'
const TEST_PASSWORD = 'glp-emulator-test'

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
connectFirestoreEmulator(db, '127.0.0.1', 8080)

async function ensureTestUser() {
  try {
    const cred = await createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD)
    console.log('Utente di test creato:', cred.user.uid)
    return cred.user
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD)
      console.log('Utente di test gia esistente, riusato:', cred.user.uid)
      return cred.user
    }
    throw err
  }
}

function isoDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function buildExerciseLog() {
  const exerciseLog = {}
  const exercises = [
    { exerciseId: 'flessioni', pts: 1 },
    { exerciseId: 'squat', pts: 1 },
    { exerciseId: 'trazioni', pts: 2 },
  ]
  for (let day = 19; day >= 0; day--) {
    if (day % 3 === 0) continue // salta qualche giorno per un pattern di heatmap realistico
    const date = isoDaysAgo(day)
    const entries = []
    const numSets = 2 + (day % 3)
    let hour = 8
    for (let i = 0; i < numSets; i++) {
      const ex = exercises[(day + i) % exercises.length]
      const reps = 8 + ((day + i * 3) % 12)
      entries.push({
        exerciseId: ex.exerciseId,
        reps,
        pts: reps * ex.pts,
        time: `${String(hour).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}:00`,
      })
      hour++
    }
    exerciseLog[date] = entries
  }
  return exerciseLog
}

async function seedUserDoc(uid) {
  const userData = {
    quickExercises: [
      {
        id: 'flessioni',
        name: 'Flessioni',
        emoji: '💪',
        pointsPerRep: 1,
        active: true,
        changes: [{ pointsPerRep: 1, date: isoDaysAgo(60) }],
      },
      {
        id: 'squat',
        name: 'Squat',
        emoji: '🦵',
        pointsPerRep: 1,
        active: true,
        changes: [{ pointsPerRep: 1, date: isoDaysAgo(60) }],
      },
      {
        id: 'trazioni',
        name: 'Trazioni',
        emoji: '🔙',
        pointsPerRep: 2,
        active: true,
        changes: [{ pointsPerRep: 2, date: isoDaysAgo(60) }],
      },
    ],
    exerciseLog: buildExerciseLog(),
    score: 0,
    habits: [],
    rewards: [],
    history: [],
    dailyLogs: {},
    tags: [],
    tasks: [],
  }

  await setDoc(doc(db, 'users', 'flavio'), userData)
  console.log('Documento users/flavio scritto con dati di test.')
}

const user = await ensureTestUser()
await seedUserDoc(user.uid)
console.log('Seed completato.')
process.exit(0)
