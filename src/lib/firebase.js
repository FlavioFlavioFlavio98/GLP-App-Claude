import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth'
import { getMessaging, isSupported } from 'firebase/messaging'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

export const firebaseConfig = {
  apiKey: 'AIzaSyA001klzJou17djB76Q-t2eRTKbU9NZoQs',
  authDomain: 'gamification-life-project.firebaseapp.com',
  projectId: 'gamification-life-project',
  storageBucket: 'gamification-life-project.firebasestorage.app',
  messagingSenderId: '925252547674',
  appId: '1:925252547674:web:1316a5d96cb54c0a515463',
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const storage = getStorage(app)

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
  connectStorageEmulator(storage, '127.0.0.1', 9199)
  // eslint-disable-next-line no-console
  console.warn('[GLP] 🧪 Modalità TEST attiva — connesso agli emulatori Firebase locali, nessun dato reale coinvolto. Le Cloud Functions (Coach/Psicologo AI) non sono emulate e non funzioneranno in questa modalità.')
}

// Whitelist: solo questa email può accedere
export const ALLOWED_EMAILS = [
  'flavio.rossi94@gmail.com',
]

export const EMAIL_TO_USER = {
  'flavio.rossi94@gmail.com': 'flavio',
}

// FCM — lazy-initialized
let _messaging = null
export async function getMessagingInstance() {
  if (_messaging) return _messaging
  try {
    const supported = await isSupported()
    if (!supported) return null
    _messaging = getMessaging(app)
    return _messaging
  } catch {
    return null
  }
}
