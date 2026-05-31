import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getMessaging, isSupported } from 'firebase/messaging'

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

// Whitelist: solo queste due email possono accedere
export const ALLOWED_EMAILS = [
  'flavio.rossi94@gmail.com',
  'simonaballini2000@gmail.com',
]

export const EMAIL_TO_USER = {
  'flavio.rossi94@gmail.com': 'flavio',
  'simonaballini2000@gmail.com': 'simona',
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
