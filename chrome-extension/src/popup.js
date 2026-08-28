import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, doc, updateDoc, arrayUnion } from 'firebase/firestore'

// Stessa config del progetto Firebase della web app (src/lib/firebase.js) —
// apiKey pubblica lato client, non è un segreto.
const firebaseConfig = {
  apiKey: 'AIzaSyA001klzJou17djB76Q-t2eRTKbU9NZoQs',
  authDomain: 'gamification-life-project.firebaseapp.com',
  projectId: 'gamification-life-project',
  storageBucket: 'gamification-life-project.firebasestorage.app',
  messagingSenderId: '925252547674',
  appId: '1:925252547674:web:1316a5d96cb54c0a515463',
}

// Stesso account dedicato creato per l'app Wear OS (vedi android/wear) —
// email diversa da quella Google principale per evitare la collisione "un
// account per email" di Firebase Auth, ma stessi identici dati (users/flavio,
// autorizzato in firestore.rules). Il popup di un'estensione non può fare
// Google Sign-In interattivo in modo semplice (serve un client OAuth dedicato
// registrato su Google Cloud), mentre email/password funziona senza altra
// configurazione.
const FIXED_EMAIL = 'flavio.rossi95@gmail.com'

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

const loginView = document.getElementById('loginView')
const taskView = document.getElementById('taskView')
const statusEl = document.getElementById('status')
const passwordInput = document.getElementById('password')
const titleInput = document.getElementById('title')
const descriptionInput = document.getElementById('description')
const deadlineInput = document.getElementById('deadline')
const priorityInput = document.getElementById('priority')
const rewardInput = document.getElementById('reward')
const penaltyInput = document.getElementById('penalty')

function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
deadlineInput.value = tomorrow()
deadlineInput.min = new Date().toISOString().slice(0, 10)

function setStatus(msg) { statusEl.textContent = msg }

onAuthStateChanged(auth, user => {
  if (user) {
    loginView.style.display = 'none'
    taskView.style.display = 'block'
    titleInput.focus()
  } else {
    loginView.style.display = 'block'
    taskView.style.display = 'none'
    passwordInput.focus()
  }
})

document.getElementById('loginBtn').addEventListener('click', async () => {
  const password = passwordInput.value
  if (!password) return
  setStatus('Accesso...')
  try {
    await signInWithEmailAndPassword(auth, FIXED_EMAIL, password)
    setStatus('')
  } catch (e) {
    setStatus('Password errata')
  }
})
passwordInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click()
})

document.getElementById('saveBtn').addEventListener('click', async () => {
  const title = titleInput.value.trim()
  if (!title) { setStatus('Scrivi cosa devi fare'); return }
  const deadline = deadlineInput.value || tomorrow()
  const priority = priorityInput.value
  const reward = parseInt(rewardInput.value) || 0
  const penalty = parseInt(penaltyInput.value) || 0

  setStatus('Salvataggio...')
  try {
    const ref = doc(db, 'users', 'flavio')
    const newTask = {
      id: `task_${Date.now().toString(36)}`,
      title,
      description: descriptionInput.value.trim(),
      deadline,
      reward,
      penalty,
      priority,
      status: 'active',
      createdAt: new Date().toISOString(),
      completedAt: null,
      expiredAt: null,
      rewardApplied: false,
      penaltyApplied: false,
    }
    // arrayUnion invece di get()+update(): niente lettura, niente race con
    // scritture concorrenti da web/telefono nella stessa finestra (stessa
    // classe di bug della perdita dati del 28/8/2026).
    await updateDoc(ref, { tasks: arrayUnion(newTask) })
    setStatus('✅ Aggiunta!')
    titleInput.value = ''
    descriptionInput.value = ''
    deadlineInput.value = tomorrow()
    rewardInput.value = '0'
    penaltyInput.value = '0'
    setTimeout(() => window.close(), 700)
  } catch (e) {
    setStatus('Errore: ' + e.message)
  }
})
titleInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('saveBtn').click()
})
