import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, browserLocalPersistence, setPersistence } from 'firebase/auth'
import { getFirestore, doc, onSnapshot, runTransaction } from 'firebase/firestore'
import { buildRecurringInstance, hasPendingInstance } from '../../src/lib/recurringTasksLogic'
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

// Niente window.confirm(): nella finestra flottante (Document
// Picture-in-Picture) le dialog native del browser sono bloccate dallo
// spec — il tap sembrava non fare nulla. Tocco istantaneo, come il widget
// Android; l'undo (ritocca la spunta) resta la rete di sicurezza per i tap
// accidentali.
// Transazione invece di leggere dall'ultimo snapshot in cache e riscrivere
// l'intero array: quella cache poteva essere di una frazione di secondo
// stantia rispetto a una scrittura concorrente da telefono/web nella stessa
// finestra, con quella scrittura persa silenziosamente (stessa classe di bug
// della perdita dati del 28/8/2026). La transazione rilegge sempre lo stato
// vero al momento dello scrivere, con retry automatico.
async function completeTask(task) {
  const isLate = task.status === 'expired'
  const now = new Date().toISOString()
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef)
    const data = snap.data() || {}
    const tasks = data.tasks || []
    let updated = tasks.map(t =>
      t.id === task.id
        ? { ...t, status: 'completed', completedAt: now, rewardApplied: !isLate }
        : t
    )
    if (task.recurringId) {
      const template = (data.recurringTasks || []).find(r => r.id === task.recurringId)
      if (template && template.active !== false && !hasPendingInstance(updated, template.id)) {
        updated = [...updated, buildRecurringInstance(template, todayStr())]
      }
    }
    transaction.update(userRef, { tasks: updated })
  })
}

async function uncompleteTask(task) {
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef)
    const data = snap.data() || {}
    const tasks = data.tasks || []
    let updated = tasks.map(t =>
      t.id === task.id
        ? { ...t, status: 'active', completedAt: null, rewardApplied: false, expiredAt: null, penaltyApplied: false }
        : t
    )
    if (task.recurringId) {
      updated = updated.filter(t => !(t.recurringId === task.recurringId && t.id !== task.id && t.status === 'active'))
    }
    transaction.update(userRef, { tasks: updated })
  })
}

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

      // Solo il cerchietto completa/annulla — cliccare sul titolo non deve
      // fare nulla, altrimenti un tap per leggere il testo completa per
      // sbaglio la task.
      const check = document.createElement('div')
      check.className = 'check clickable' + (t.status === 'completed' ? ' checked' : '')
      check.title = t.status === 'completed' ? 'Tocca per annullare il completamento' : 'Tocca per completare'
      check.addEventListener('click', () => {
        if (t.status === 'completed') uncompleteTask(t)
        else completeTask(t)
      })
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
      render(data.tasks || [])
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
