import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, browserLocalPersistence, setPersistence } from 'firebase/auth'
import { getFirestore, doc, onSnapshot } from 'firebase/firestore'

// Stessa config/account dedicato usato per estensione Chrome e app Wear OS
// (flavio.rossi95@gmail.com, autorizzato in firestore.rules, stessi dati
// users/flavio). Pagina statica pubblicata su GitHub Pages insieme alla web
// app, pensata per restare aperta come tab fissata su Chrome sul laptop.
const firebaseConfig = {
  apiKey: 'AIzaSyA001klzJou17djB76Q-t2eRTKbU9NZoQs',
  authDomain: 'gamification-life-project.firebaseapp.com',
  projectId: 'gamification-life-project',
  storageBucket: 'gamification-life-project.firebasestorage.app',
  messagingSenderId: '925252547674',
  appId: '1:925252547674:web:1316a5d96cb54c0a515463',
}
const FIXED_EMAIL = 'flavio.rossi95@gmail.com'

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

const loginView = document.getElementById('loginView')
const boardView = document.getElementById('boardView')
const passwordInput = document.getElementById('password')
const loginBtn = document.getElementById('loginBtn')
const loginStatus = document.getElementById('loginStatus')
const listEl = document.getElementById('list')
const footerEl = document.getElementById('footer')
const clockEl = document.getElementById('clock')

loginBtn.addEventListener('click', doLogin)
passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })

async function doLogin() {
  const password = passwordInput.value
  if (!password) return
  loginStatus.textContent = 'Accesso...'
  try {
    await setPersistence(auth, browserLocalPersistence)
    await signInWithEmailAndPassword(auth, FIXED_EMAIL, password)
    loginStatus.textContent = ''
  } catch (e) {
    loginStatus.textContent = 'Password errata'
  }
}

const PRIORITY_COLOR = { high: '#EB5757', medium: '#F2994A', low: '#4A90D9' }
const PRIORITY_LABEL = { high: 'Alta', medium: 'Media', low: 'Bassa' }

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function updateClock() {
  const d = new Date()
  const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
  const months = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
  clockEl.textContent = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
updateClock()
setInterval(updateClock, 30_000)

function render(tasks) {
  const today = todayStr()

  // Stessa logica di TaskSection.jsx per "oggi": attive con scadenza entro
  // oggi, tutte le scadute (per non perderle), completate oggi.
  const dayTasks = (tasks || []).filter(t =>
    (t.status === 'active' && t.deadline <= today) ||
    t.status === 'expired' ||
    (t.status === 'completed' && typeof t.completedAt === 'string' && t.completedAt.startsWith(today))
  )

  const rank = t => t.status === 'expired' ? 0 : t.status === 'active' ? 1 : 2
  dayTasks.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    return (a.deadline || '').localeCompare(b.deadline || '')
  })

  listEl.innerHTML = ''
  if (dayTasks.length === 0) {
    listEl.innerHTML = '<div class="empty">Nessuna task per oggi 🎉</div>'
  } else {
    for (const t of dayTasks) {
      const row = document.createElement('div')
      row.className = 'row' + (t.status === 'completed' ? ' done' : '')

      const dot = document.createElement('div')
      dot.className = 'dot'
      dot.style.background = t.status === 'expired' ? '#EB5757' : (PRIORITY_COLOR[t.priority] || '#4A90D9')
      row.appendChild(dot)

      const main = document.createElement('div')
      main.className = 'main'

      const title = document.createElement('div')
      title.className = 'title'
      title.textContent = t.title || '(senza titolo)'
      main.appendChild(title)

      if (t.description) {
        const desc = document.createElement('div')
        desc.className = 'desc'
        desc.textContent = t.description
        main.appendChild(desc)
      }

      const meta = document.createElement('div')
      meta.className = 'meta'
      if (t.status === 'expired') {
        meta.innerHTML = `<span class="tag expired">SCADUTA · -${t.penalty || 0}pt</span>`
      } else if (t.status === 'completed') {
        meta.innerHTML = `<span class="tag done">✓ completata · +${t.reward || 0}pt</span>`
      } else {
        meta.innerHTML = `<span class="tag priority">${PRIORITY_LABEL[t.priority] || ''}</span>${t.reward ? `<span class="tag reward">+${t.reward}pt</span>` : ''}`
      }
      main.appendChild(meta)

      row.appendChild(main)
      listEl.appendChild(row)
    }
  }

  const pending = dayTasks.filter(t => t.status !== 'completed').length
  footerEl.textContent = pending > 0 ? `${pending} da fare` : 'Tutto fatto per oggi ✓'
}

let unsubscribe = null

onAuthStateChanged(auth, user => {
  if (unsubscribe) { unsubscribe(); unsubscribe = null }

  if (user) {
    loginView.style.display = 'none'
    boardView.style.display = 'flex'
    const ref = doc(db, 'users', 'flavio')
    unsubscribe = onSnapshot(ref, snap => render(snap.data()?.tasks || []), () => {
      listEl.innerHTML = '<div class="empty">Errore di connessione</div>'
    })
  } else {
    loginView.style.display = 'flex'
    boardView.style.display = 'none'
    passwordInput.focus()
  }
})
