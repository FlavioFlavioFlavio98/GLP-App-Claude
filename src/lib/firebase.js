import { initializeApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth'
// firebase/messaging e firebase/storage NON sono importati qui in cima di
// proposito — sono SDK pesanti usati solo per push notification e upload
// file/PDF, non al primo avvio. Caricarli eager rallentava l'apertura della
// PWA (richiesta esplicita di Flavio: avvio istantaneo). Vengono importati
// dinamicamente dentro getMessagingInstance()/getStorageInstance() qui
// sotto, solo quando (e se) servono davvero.

export const firebaseConfig = {
  apiKey: 'AIzaSyA001klzJou17djB76Q-t2eRTKbU9NZoQs',
  authDomain: 'gamification-life-project.firebaseapp.com',
  projectId: 'gamification-life-project',
  storageBucket: 'gamification-life-project.firebasestorage.app',
  messagingSenderId: '925252547674',
  appId: '1:925252547674:web:1316a5d96cb54c0a515463',
}

export const app = initializeApp(firebaseConfig)

// Cache locale persistente (IndexedDB): SENZA questa, una scrittura fatta
// offline (es. task aggiunta in modalità aereo) resta in coda SOLO in
// memoria — se la scheda/PWA si chiude o viene ricaricata prima di tornare
// online, quella scrittura è persa per sempre, senza alcun errore visibile
// (bug segnalato da Flavio il 27/9/2026: task aggiunta offline mai salvata).
// persistentMultipleTabManager: stessa cache condivisa se l'app è aperta in
// più schede contemporaneamente. Se IndexedDB non è disponibile (raro: es.
// alcune modalità di navigazione privata), si ricade sulla sola cache in
// memoria invece di far fallire l'intera app.
export let db
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
} catch (e) {
  console.warn('[GLP] Cache persistente non disponibile, uso la cache in memoria:', e)
  db = getFirestore(app)
}
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// ─── Modalità test (emulatori Firebase locali) ─────────────────────────────────
// MAI attiva in produzione: import.meta.env.DEV è sempre `false` per qualunque
// build (npm run build / build:web / build:android — solo `vite dev` lo rende
// true), e Vite sostituisce questa espressione staticamente, quindi l'intero
// blocco viene eliminato dal bundle di produzione. In più richiede anche il flag
// esplicito VITE_USE_EMULATOR (impostato solo da `npm run dev:emulator`), così un
// normale `npm run dev` continua a usare Firebase vero come sempre.
export const USE_EMULATOR = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true'

if (USE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  // Storage emulator connesso dentro getStorageInstance() qui sotto, al
  // primo utilizzo — lo storage stesso ora è lazy.
  // eslint-disable-next-line no-console
  console.warn('[GLP] 🧪 Modalità TEST attiva — connesso agli emulatori Firebase locali, nessun dato reale coinvolto. Le Cloud Functions (Coach/Psicologo AI) non sono emulate e non funzioneranno in questa modalità.')
}

// Whitelist: solo queste due email possono accedere. Flavio ha l'app completa;
// Simona (fidanzata) solo la sezione Abitudini condivise — le regole Firestore
// (firestore.rules) sono il vero controllo di sicurezza, questa lista è solo
// il filtro lato UI.
export const ALLOWED_EMAILS = [
  'flavio.rossi94@gmail.com',
  'simonaballini2000@gmail.com',
]

export const EMAIL_TO_USER = {
  'flavio.rossi94@gmail.com': 'flavio',
  'simonaballini2000@gmail.com': 'simona',
}

// Storage — lazy-initialized: caricato solo al primo upload/eliminazione di
// un file (foto progressi, PDF letture, backup), non al primo avvio.
let _storage = null
export async function getStorageInstance() {
  if (_storage) return _storage
  const { getStorage, connectStorageEmulator } = await import('firebase/storage')
  _storage = getStorage(app)
  if (USE_EMULATOR) connectStorageEmulator(_storage, '127.0.0.1', 9199)
  return _storage
}

// FCM — lazy-initialized (import dinamico incluso: firebase/messaging non
// deve entrare nel bundle scaricato al primo avvio)
let _messaging = null
export async function getMessagingInstance() {
  if (_messaging) return _messaging
  try {
    const { getMessaging, isSupported } = await import('firebase/messaging')
    const supported = await isSupported()
    if (!supported) return null
    _messaging = getMessaging(app)
    return _messaging
  } catch {
    return null
  }
}
