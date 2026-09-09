import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { toDateString } from '../../src/lib/habitLogic'

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
const destinationSelect = document.getElementById('destination')
const taskOnlyFields = document.getElementById('taskOnlyFields')
const ideaHint = document.getElementById('ideaHint')

// toDateString usa la data locale, non UTC: alle 00:xx ora italiana
// new Date().toISOString().slice(0,10) restituisce ancora il giorno UTC
// precedente — lo stesso bug che habitLogic.js documenta di aver già
// corretto una volta nel resto dell'app (vedi il commento su toDateString).
function todayLocal() { return toDateString(new Date()) }
function dateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toDateString(d)
}
// Default su oggi (non più domani): la maggior parte delle task rapide
// aggiunte da qui sono per la giornata corrente — richiesta esplicita di
// Flavio, con i pulsanti rapidi sotto per gli altri casi comuni senza dover
// aprire il mini-calendario.
deadlineInput.value = todayLocal()
deadlineInput.min = todayLocal()

const quickDateBtns = Array.from(document.querySelectorAll('.quick-date-btn'))
function syncQuickDateActive() {
  quickDateBtns.forEach(btn => {
    btn.classList.toggle('active', dateOffset(parseInt(btn.dataset.days, 10)) === deadlineInput.value)
  })
}
quickDateBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    deadlineInput.value = dateOffset(parseInt(btn.dataset.days, 10))
    syncQuickDateActive()
  })
})
deadlineInput.addEventListener('input', syncQuickDateActive)
syncQuickDateActive()

function setStatus(msg) { statusEl.textContent = msg }

// Mostra/nasconde i campi che non hanno senso per un'idea di area della vita
// (niente scadenza, priorità o punti — vedi addLifeAreaIdea in store.jsx,
// stessa scelta di design della web app in TaskModal.jsx).
function updateDestinationUI() {
  const isIdea = destinationSelect.value !== 'tasks'
  taskOnlyFields.style.display = isIdea ? 'none' : ''
  ideaHint.style.display = isIdea ? 'block' : 'none'
  titleInput.placeholder = isIdea ? 'Es. Video YouTube esercizi a corpo libero' : 'Cosa devi fare?'
}
destinationSelect.addEventListener('change', updateDestinationUI)

// Popolate una sola volta dopo il login: stessa fonte (users/flavio) usata
// dal watch e dalla web app per le aree della vita — richiesta esplicita di
// Flavio di poter scegliere subito la destinazione anche da qui, dato che
// aggiunge spesso task/idee proprio dall'estensione.
let areasLoaded = false
async function loadLifeAreas() {
  if (areasLoaded) return
  try {
    const snap = await getDoc(doc(db, 'users', 'flavio'))
    const areas = (snap.data()?.lifeAreas || []).filter(a => a.active !== false)
    areas.forEach(a => {
      const opt = document.createElement('option')
      opt.value = a.id
      opt.textContent = `${a.emoji} ${a.name} (idea, senza scadenza)`
      destinationSelect.appendChild(opt)
    })
    areasLoaded = true
  } catch (e) { /* select resta con la sola opzione "Task generali" */ }
}

onAuthStateChanged(auth, user => {
  if (user) {
    loginView.style.display = 'none'
    taskView.style.display = 'block'
    titleInput.focus()
    loadLifeAreas()
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

let saving = false
document.getElementById('saveBtn').addEventListener('click', async () => {
  // Guardia anti-doppio-invio: senza, un doppio click/doppio Enter prima che
  // l'await sotto si risolva creava due task identiche (stesso bug reale
  // riscontrato sui widget nativi Android per lo stesso motivo).
  if (saving) return
  const title = titleInput.value.trim()
  if (!title) { setStatus('Scrivi cosa devi fare'); return }

  const destination = destinationSelect.value
  const ref = doc(db, 'users', 'flavio')

  saving = true
  setStatus('Salvataggio...')
  try {
    if (destination !== 'tasks') {
      // Idea di un'area della vita: niente scadenza/priorità/punti, stessa
      // forma di addLifeAreaIdea in store.jsx (web) — arrayUnion va bene
      // anche qui, è una vera aggiunta, non una modifica di un elemento
      // esistente.
      const newIdea = {
        id: `idea_${Date.now().toString(36)}`,
        areaId: destination,
        text: title,
        done: false,
        createdAt: todayLocal(),
      }
      await updateDoc(ref, { lifeAreaIdeas: arrayUnion(newIdea) })
    } else {
      // .checkValidity() non basta da solo (l'utente può scrivere una data
      // passata a mano nonostante il min sul campo) — controllata
      // esplicitamente qui sotto, stessa logica di addTask in store.jsx.
      const deadline = deadlineInput.value || todayLocal()
      const priority = priorityInput.value
      const reward = Math.max(0, parseInt(rewardInput.value) || 0)
      const penalty = Math.max(0, parseInt(penaltyInput.value) || 0)
      const today = todayLocal()
      const isPast = deadline < today
      const newTask = {
        id: `task_${Date.now().toString(36)}`,
        title,
        description: descriptionInput.value.trim(),
        deadline,
        reward,
        penalty,
        priority,
        status: isPast ? 'expired' : 'active',
        createdAt: new Date().toISOString(),
        completedAt: null,
        expiredAt: isPast ? new Date().toISOString() : null,
        rewardApplied: false,
        penaltyApplied: isPast,
      }
      // arrayUnion invece di get()+update(): niente lettura, niente race con
      // scritture concorrenti da web/telefono nella stessa finestra (stessa
      // classe di bug della perdita dati del 28/8/2026).
      await updateDoc(ref, { tasks: arrayUnion(newTask) })
    }
    setStatus('✅ Aggiunta!')
    titleInput.value = ''
    descriptionInput.value = ''
    deadlineInput.value = todayLocal()
    syncQuickDateActive()
    rewardInput.value = '0'
    penaltyInput.value = '0'
    destinationSelect.value = 'tasks'
    updateDestinationUI()
    setTimeout(() => window.close(), 700)
  } catch (e) {
    setStatus('Errore: ' + e.message)
  } finally {
    saving = false
  }
})
titleInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('saveBtn').click()
})
