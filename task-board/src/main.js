import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, browserLocalPersistence, setPersistence } from 'firebase/auth'
import { getFirestore, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { buildRecurringInstance, hasPendingInstance, addDays } from '../../src/lib/recurringTasksLogic'
import { toDateString } from '../../src/lib/habitLogic'

// Stessa config/account dedicato usato per estensione Chrome e app Wear OS
// (flavio.rossi95@gmail.com, autorizzato in firestore.rules, stessi dati
// users/flavio). Pagina statica pubblicata su GitHub Pages insieme alla web
// app, pensata per restare aperta come finestra "sempre in primo piano" sul
// laptop (Document Picture-in-Picture) invece che come semplice tab.
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
const userRef = doc(db, 'users', 'flavio')

const loginView = document.getElementById('loginView')
const boardView = document.getElementById('boardView')
const passwordInput = document.getElementById('password')
const loginBtn = document.getElementById('loginBtn')
const loginStatus = document.getElementById('loginStatus')
const listEl = document.getElementById('list')
const footerEl = document.getElementById('footer')
const clockEl = document.getElementById('clock')
const pipBtn = document.getElementById('pipBtn')

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
  return toDateString(new Date())
}

function updateClock() {
  const d = new Date()
  const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
  const months = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
  clockEl.textContent = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
updateClock()
setInterval(updateClock, 30_000)

let latestTasks = []
let latestRecurring = []

function getRecurringTemplate(task) {
  if (!task.recurringId) return null
  return latestRecurring.find(r => r.id === task.recurringId) || null
}

// Aggiunge, se applicabile, la prossima istanza della task ricorrente
// nello stesso array/scrittura del completamento — stessa logica di
// store.jsx _spawnNextRecurringInstance, per restare coerente con
// web/Android/estensione/watch.
function spawnNextRecurringInstance(task, tasksSoFar) {
  if (!task.recurringId) return tasksSoFar
  const template = latestRecurring.find(r => r.id === task.recurringId)
  if (!template || template.active === false) return tasksSoFar
  if (hasPendingInstance(tasksSoFar, template.id)) return tasksSoFar
  const next = buildRecurringInstance(template, todayStr())
  return [...tasksSoFar, next]
}

async function completeTask(task) {
  const template = getRecurringTemplate(task)
  const isLate = task.status === 'expired'
  const confirmMsg = isLate
    ? `Chiudere "${task.title}" (completamento tardivo, nessun punto)?`
    : template
      ? `Completare "${task.title}"? +${task.reward}pt\n\n🔁 Ricorrente: si ripresenterà tra ${template.intervalDays} giorn${template.intervalDays === 1 ? 'o' : 'i'}.`
      : `Completare "${task.title}"? +${task.reward}pt`
  if (!window.confirm(confirmMsg)) return

  const now = new Date().toISOString()
  let tasks = latestTasks.map(t =>
    t.id === task.id
      ? { ...t, status: 'completed', completedAt: now, rewardApplied: !isLate }
      : t
  )
  tasks = spawnNextRecurringInstance(task, tasks)
  await updateDoc(userRef, { tasks })
}

async function uncompleteTask(task) {
  if (!window.confirm(`Completata per errore? Ripristina "${task.title}" tra le task attive`)) return
  let tasks = latestTasks.map(t =>
    t.id === task.id
      ? { ...t, status: 'active', completedAt: null, rewardApplied: false, expiredAt: null, penaltyApplied: false }
      : t
  )
  if (task.recurringId) {
    tasks = tasks.filter(t => !(t.recurringId === task.recurringId && t.id !== task.id && t.status === 'active'))
  }
  await updateDoc(userRef, { tasks })
}

function render(tasks, recurring) {
  latestTasks = tasks
  latestRecurring = recurring
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
      row.className = 'row' + (t.status === 'completed' ? ' done' : '') + ' clickable'
      row.title = t.status === 'completed' ? 'Tocca per annullare il completamento' : 'Tocca per completare'
      row.addEventListener('click', () => {
        if (t.status === 'completed') uncompleteTask(t)
        else completeTask(t)
      })

      const check = document.createElement('div')
      check.className = 'check' + (t.status === 'completed' ? ' checked' : '')
      if (t.status === 'completed') {
        check.textContent = '✓'
      } else {
        check.style.borderColor = t.status === 'expired' ? '#EB5757' : (PRIORITY_COLOR[t.priority] || '#4A90D9')
      }
      row.appendChild(check)

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
        meta.innerHTML = `<span class="tag done">completata${t.rewardApplied ? ` · +${t.reward || 0}pt` : ''}</span>`
      } else {
        meta.innerHTML = `<span class="tag priority">${PRIORITY_LABEL[t.priority] || ''}</span>${t.reward ? `<span class="tag reward">+${t.reward}pt</span>` : ''}`
      }
      if (t.recurringId) meta.innerHTML += `<span class="tag recurring">🔁</span>`
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
    unsubscribe = onSnapshot(userRef, snap => {
      const data = snap.data() || {}
      render(data.tasks || [], data.recurringTasks || [])
    }, () => {
      listEl.innerHTML = '<div class="empty">Errore di connessione</div>'
    })
  } else {
    loginView.style.display = 'flex'
    boardView.style.display = 'none'
    passwordInput.focus()
  }
})

// ─── Sempre in primo piano (Document Picture-in-Picture) ──────────────────
// L'intera pagina resta nello stesso contesto JS: i listener Firestore
// continuano a girare invariati anche quando gli elementi DOM vengono
// spostati nella finestra PiP, quindi gli aggiornamenti dal telefono/watch
// arrivano lì in tempo reale esattamente come nella tab normale.
let pipWindow = null

async function copyStylesInto(targetDoc) {
  for (const styleSheet of document.styleSheets) {
    try {
      const css = [...styleSheet.cssRules].map(r => r.cssText).join('\n')
      const style = document.createElement('style')
      style.textContent = css
      targetDoc.head.appendChild(style)
    } catch {
      const link = targetDoc.createElement('link')
      link.rel = 'stylesheet'
      link.href = styleSheet.href
      targetDoc.head.appendChild(link)
    }
  }
}

async function togglePiP() {
  if (!('documentPictureInPicture' in window)) {
    alert('Questa versione di Chrome non supporta ancora la modalità "sempre in primo piano". Aggiorna Chrome e riprova.')
    return
  }
  if (pipWindow) { pipWindow.close(); return }

  pipWindow = await window.documentPictureInPicture.requestWindow({ width: 300, height: 480 })
  await copyStylesInto(pipWindow.document)
  pipWindow.document.title = 'Task di oggi'

  const pageEl = document.querySelector('.page')
  pipWindow.document.body.appendChild(pageEl)
  pipWindow.document.body.style.margin = '0'
  pipWindow.document.body.style.background = '#0d0d10'

  pipWindow.addEventListener('pagehide', () => {
    document.body.insertBefore(pageEl, document.body.firstChild)
    pipWindow = null
  })
}

pipBtn.addEventListener('click', togglePiP)
