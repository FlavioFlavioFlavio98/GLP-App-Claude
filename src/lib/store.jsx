import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { db, auth, storage, ALLOWED_EMAILS, EMAIL_TO_USER } from './firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  doc, onSnapshot, updateDoc, setDoc, getDoc, deleteDoc,
  arrayUnion, collection, getDocs, increment, runTransaction,
  addDoc, serverTimestamp, deleteField,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage'
import { toDateString, getItemValueAtDate, calcNumericPoints, parseEntry, calculateTotalScore } from './habitLogic'
import { updatePersistentNotification } from './fcm'
import { checkNewAchievements, computeCurrentStreak } from './achievementLogic'
import { touchWorkoutSession, startRestTimer, getEffortMultiplier, DEFAULT_EFFORT, getMobilityRate, getStudyRate } from './workoutStats'
import { getBarefootRate, getHangRate } from './bodyStats'
import { getWillpowerRate } from './willpowerStats'
import { getDayRecapRate } from './dayRecapStats'
import { SEED_FOODS } from './nutritionStats'
import { buildRecurringInstance, hasPendingInstance, addDays } from './recurringTasksLogic'
import { computeSocialPts } from './mindStats'

const AppContext = createContext(null)
const DispatchContext = createContext(null)

const USERS = ['flavio']

const MISSION_POOL = [
  { id: 'complete_5_habits', title: 'Completa 5 abitudini', pts: 5, target: 5, type: 'habits_count' },
  { id: 'complete_3_habits', title: 'Completa 3 abitudini', pts: 3, target: 3, type: 'habits_count' },
  { id: 'no_failures', title: 'Zero abitudini fallite', pts: 4, target: 0, type: 'no_failures' },
  { id: 'checkin_all', title: 'Completa tutti i check-in', pts: 4, target: 3, type: 'checkin_count' },
  { id: 'checkin_morning', title: 'Fai il check-in mattutino', pts: 2, target: 1, type: 'checkin_morning' },
  { id: 'add_numeric', title: 'Inserisci un valore numerico', pts: 2, target: 1, type: 'numeric_count' },
  { id: 'earn_10pts', title: 'Guadagna 10pt oggi', pts: 3, target: 10, type: 'daily_pts' },
  { id: 'complete_task', title: 'Completa una task', pts: 3, target: 1, type: 'task_done' },
]

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AUTH':
      if (!action.payload) {
        return { ...state, authStatus: 'unauthenticated', authUserId: null, currentUser: 'flavio', globalData: null, viewUserId: null }
      }
      return {
        ...state,
        authStatus: 'authenticated',
        authUserId: action.payload.userId,
        currentUser: action.payload.userId,
        viewUserId: action.payload.userId,
      }
    case 'SET_VIEW_USER':
      return {
        ...state,
        viewUserId: action.userId,
        // When switching view, globalData shows the viewed user's data
        globalData: state.allUsersData[action.userId] || null,
        currentUser: action.userId,
      }
    case 'RESTORE_OWN_USER':
      return {
        ...state,
        viewUserId: state.authUserId,
        currentUser: state.authUserId,
        globalData: state.allUsersData[state.authUserId] || null,
      }
    case 'SET_USER_DATA': {
      // score non è mai salvato staticamente: viene sempre ricalcolato al volo
      // qui, una sola volta per aggiornamento dati, così ogni componente che legge
      // globalData.score/allUsersData[x].score vede sempre il totale corretto senza
      // doverlo ricalcolare ad ogni render.
      const dataWithScore = { ...action.data, score: calculateTotalScore(action.data) }
      return {
        ...state,
        allUsersData: { ...state.allUsersData, [action.user]: dataWithScore },
        globalData: action.user === state.currentUser ? dataWithScore : state.globalData,
      }
    }
    case 'SET_VIEW_DATE':
      return { ...state, viewDate: action.date }
    case 'SET_TOAST':
      return { ...state, toast: action.payload }
    case 'SET_MODAL':
      return { ...state, modal: action.name, modalPayload: action.payload || null }
    case 'CLOSE_MODAL':
      return { ...state, modal: null, modalPayload: null }
    case 'SET_THEME': {
      const DARK_IDS = ['dark', 'forest', 'volcano', 'midnight', 'aurora']
      if (DARK_IDS.includes(action.theme)) {
        localStorage.setItem('glp_last_dark_theme', action.theme)
      }
      localStorage.setItem('glp_theme', action.theme)
      return { ...state, theme: action.theme, lastDarkTheme: DARK_IDS.includes(action.theme) ? action.theme : state.lastDarkTheme }
    }
    case 'SET_USER_COLOR':
      localStorage.setItem(`glp_color_${action.user}`, action.color)
      return { ...state, userColors: { ...state.userColors, [action.user]: action.color } }
    case 'SET_DENSITY':
      localStorage.setItem('glp_density', action.density)
      return { ...state, density: action.density }
    case 'SET_MINIMAL_MODE':
      localStorage.setItem('glp_minimal_mode', String(action.value))
      return { ...state, minimalMode: action.value }
    case 'SET_WAKE_LOCK':
      localStorage.setItem('glp_wake_lock', String(action.value))
      return { ...state, wakeLockEnabled: action.value }
    case 'PUSH_ACHIEVEMENTS':
      return { ...state, pendingAchievements: [...(state.pendingAchievements || []), ...action.defs] }
    case 'CLEAR_ACHIEVEMENT_QUEUE':
      return { ...state, pendingAchievements: [] }
    default:
      return state
  }
}

const initialState = {
  // Auth
  authStatus: 'loading', // 'loading' | 'authenticated' | 'unauthenticated'
  authUserId: null,       // the actual logged-in user
  viewUserId: null,       // the user whose data is currently displayed (can differ in read-only mode)

  currentUser: 'flavio',  // kept for backwards compat with all actions (= viewUserId)
  pendingAchievements: [],
  globalData: null,
  allUsersData: { flavio: null },
  viewDate: toDateString(new Date()),
  toast: null,
  modal: null,
  modalPayload: null,
  theme: localStorage.getItem('glp_theme') || 'dark',
  lastDarkTheme: localStorage.getItem('glp_last_dark_theme') || 'dark',
  userColors: {
    flavio: localStorage.getItem('glp_color_flavio') || '#ffca28',
  },
  density: localStorage.getItem('glp_density') || 'normal',
  minimalMode: localStorage.getItem('glp_minimal_mode') === 'true',
  wakeLockEnabled: localStorage.getItem('glp_wake_lock') === 'true',
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const toastTimer = useRef(null)
  const firestoreUnsubsRef = useRef([])

  // ── Auth state listener ──
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      // Stop previous Firestore listeners
      firestoreUnsubsRef.current.forEach(u => u())
      firestoreUnsubsRef.current = []

      if (user && ALLOWED_EMAILS.includes(user.email)) {
        const userId = EMAIL_TO_USER[user.email]
        dispatch({ type: 'SET_AUTH', payload: { user, userId } })

        // Start Firestore listeners for both users
        const unsubs = USERS.map(u =>
          onSnapshot(doc(db, 'users', u), snap => {
            if (snap.exists()) dispatch({ type: 'SET_USER_DATA', user: u, data: snap.data() })
          })
        )
        firestoreUnsubsRef.current = unsubs

        // Ensure user docs exist
        USERS.forEach(async u => {
          const ref = doc(db, 'users', u)
          const snap = await getDoc(ref)
          if (!snap.exists()) {
            await setDoc(ref, { score: 0, habits: [], rewards: [], history: [], dailyLogs: {}, tags: [] })
          }
        })
      } else {
        // Not authenticated or not allowed
        dispatch({ type: 'SET_AUTH', payload: null })
      }
    })

    return () => {
      unsubAuth()
      firestoreUnsubsRef.current.forEach(u => u())
    }
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (state.toast) {
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 2600)
    }
  }, [state.toast])

  // ── Helper: guard write actions in read-only mode ──
  function isReadOnly() {
    return state.viewUserId !== state.authUserId
  }

  const actions = {
    showToast(msg, icon = 'ℹ️') {
      dispatch({ type: 'SET_TOAST', payload: { msg, icon } })
    },
    vibrate(type) {
      if (!navigator.vibrate) return
      if (type === 'light') navigator.vibrate(30)
      if (type === 'heavy') navigator.vibrate([50, 50])
    },

    // ── Auth ──
    async logout() {
      if (!window.confirm('Sei sicuro di voler uscire?')) return
      try {
        await signOut(auth)
      } catch (e) { console.error(e) }
    },

    // ── View mode (read-only switcher) ──
    switchToViewUser(userId) {
      dispatch({ type: 'SET_VIEW_USER', userId })
    },
    restoreOwnUser() {
      dispatch({ type: 'RESTORE_OWN_USER' })
    },

    setTheme(themeId) { dispatch({ type: 'SET_THEME', theme: themeId }) },
    // Scorciatoia chiaro/scuro accessibile da ogni pagina (icona in header) —
    // ricorda l'ultimo tema scuro scelto (dark/forest/volcano/midnight/aurora)
    // così tornando da "Chiaro" si ripristina quello, non sempre "dark".
    toggleTheme() {
      const { theme, lastDarkTheme } = state
      dispatch({ type: 'SET_THEME', theme: theme === 'light' ? (lastDarkTheme || 'dark') : 'light' })
    },
    setUserColor(user, color) { dispatch({ type: 'SET_USER_COLOR', user, color }) },
    setViewDate(dateStr) { dispatch({ type: 'SET_VIEW_DATE', date: dateStr }) },
    openModal(name, payload) { dispatch({ type: 'SET_MODAL', name, payload }) },
    closeModal() { dispatch({ type: 'CLOSE_MODAL' }) },
    setDensity(d) { dispatch({ type: 'SET_DENSITY', density: d }) },
    setMinimalMode(v) { dispatch({ type: 'SET_MINIMAL_MODE', value: v }) },
    setWakeLockEnabled(v) { dispatch({ type: 'SET_WAKE_LOCK', value: v }) },
    clearAchievementQueue() { dispatch({ type: 'CLEAR_ACHIEVEMENT_QUEUE' }) },

    // ─── REWARD CATEGORIES ───────────────────────────────────────────────────
    async saveRewardCategories(categories) {
      if (isReadOnly()) return
      const { authUserId } = state
      const prev = state.globalData.rewardCategories || []
      await updateDoc(doc(db, 'users', authUserId), { rewardCategories: categories })
      categories.forEach(c => {
        if (!prev.find(p => p.id === c.id)) actions._addActivityLog('category_created', `Categoria creata: "${c.name}"`)
      })
      prev.forEach(p => {
        if (!categories.find(c => c.id === p.id)) actions._addActivityLog('category_deleted', `Categoria eliminata: "${p.name}"`)
      })
      actions.showToast('Categorie salvate', '🏷️')
    },

    // ─── AVATAR ───────────────────────────────────────────────────────────────
    async saveAvatar(emoji) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const profile = { ...(globalData.profile || {}), avatar: emoji }
      await updateDoc(doc(db, 'users', authUserId), { profile })
    },

    // ─── REORDER ──────────────────────────────────────────────────────────────
    async reorderHabits(activeId, overId) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const habits = [...(globalData.habits || [])]
      const oldIndex = habits.findIndex(h => h.id === activeId)
      const newIndex = habits.findIndex(h => h.id === overId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      const reordered = [...habits]
      const [removed] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, removed)
      await updateDoc(doc(db, 'users', authUserId), { habits: reordered })
    },

    async reorderRewards(activeId, overId) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const rewards = [...(globalData.rewards || [])]
      const oldIdx = rewards.findIndex(r => r.id === activeId)
      const newIdx = rewards.findIndex(r => r.id === overId)
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return
      const reordered = [...rewards]
      const [removed] = reordered.splice(oldIdx, 1)
      reordered.splice(newIdx, 0, removed)
      await updateDoc(doc(db, 'users', authUserId), { rewards: reordered })
    },

    // ─── HABIT NOTES ─────────────────────────────────────────────────────────
    async saveHabitNote(habitId, note, dateStr) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const ref = doc(db, 'users', authUserId)
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      let raw = dailyLogs[dateStr] || {}
      if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
      const habitNotes = { ...(raw.habitNotes || {}), [habitId]: note }
      dailyLogs[dateStr] = { ...raw, habitNotes }
      await updateDoc(ref, { dailyLogs })
    },

    // ─── HABIT STATUS ────────────────────────────────────────────────────────
    async setHabitStatus(habitId, action) {
      if (isReadOnly()) { actions.showToast('Sola lettura', 'ℹ️'); return }
      const { authUserId, globalData, viewDate } = state
      actions.vibrate('light')
      const ref = doc(db, 'users', authUserId)

      // Determine habit metadata from globalData (habits list is not race-condition sensitive)
      const habitsArrBase = [...(globalData.habits || [])]
      const habitIndex = habitsArrBase.findIndex(h => (h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')) === habitId)
      const habitObj = habitsArrBase[habitIndex]
      if (!habitObj) return

      const isMulti = getItemValueAtDate(habitObj, 'isMulti', viewDate)

      let finalEntry, finalHabitsArr, actionType = 'neutral'

      try {
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(ref)
          const freshData = snap.data()

          const habitsArr = [...(freshData.habits || [])]
          const freshHabitIndex = habitsArr.findIndex(h => (h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')) === habitId)

          let raw = freshData.dailyLogs?.[viewDate] || {}
          if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
          let entry = {
            habits: [...(raw.habits || [])],
            failedHabits: [...(raw.failedHabits || [])],
            habitLevels: { ...(raw.habitLevels || {}) },
            purchases: raw.purchases || [],
          }

          const wasDone = entry.habits.includes(habitId)
          const wasLevel = entry.habitLevels[habitId] || 'max'

          if (wasDone) {
            entry.habits = entry.habits.filter(id => id !== habitId)
            delete entry.habitLevels[habitId]
          }
          if (entry.failedHabits.includes(habitId)) {
            entry.failedHabits = entry.failedHabits.filter(id => id !== habitId)
          }

          actionType = 'neutral'
          if (action === 'failed') {
            entry.failedHabits.push(habitId)
            actionType = 'failed'
          } else if (action === 'next') {
            if (!wasDone) {
              entry.habits.push(habitId)
              if (isMulti) {
                entry.habitLevels[habitId] = 'min'
              } else {
                entry.habitLevels[habitId] = 'max'
                actionType = 'done'
              }
            } else if (isMulti && wasLevel === 'min') {
              entry.habits.push(habitId)
              entry.habitLevels[habitId] = 'max'
              actionType = 'done'
            }
            if (freshHabitIndex >= 0 && entry.habits.includes(habitId)) {
              habitsArr[freshHabitIndex] = { ...habitsArr[freshHabitIndex], lastDone: viewDate }
            }
          }

          finalEntry = entry
          finalHabitsArr = habitsArr

          transaction.update(ref, {
            [`dailyLogs.${viewDate}.habits`]: entry.habits,
            [`dailyLogs.${viewDate}.failedHabits`]: entry.failedHabits,
            [`dailyLogs.${viewDate}.habitLevels`]: entry.habitLevels,
            habits: habitsArr,
          })
        })
      } catch (err) {
        console.error('setHabitStatus transaction failed:', err)
        actions.showToast('Errore nel salvataggio', '❌')
        return
      }

      if (actionType === 'done') {
        import('canvas-confetti').then(m => m.default({ particleCount: 60, spread: 60, origin: { y: 0.7 }, colors: [authUserId === 'flavio' ? '#ffca28' : '#d05ce3'] }))
        actions.showToast('Completata!', '✅')
      } else if (actionType === 'failed') {
        actions.showToast('Segnata come fallita', '❌')
      }
      const updatedData = { ...globalData, dailyLogs: { ...globalData.dailyLogs, [viewDate]: finalEntry }, habits: finalHabitsArr }
      const score = calculateTotalScore(updatedData)
      const freshData = { ...updatedData, score }
      actions._triggerPersistentNotification(authUserId, score, finalEntry, finalHabitsArr)
      setTimeout(() => {
        actions._checkAchievements(freshData, authUserId)
      }, 500)
    },

    async buyReward(name, cost) {
      if (isReadOnly()) { actions.showToast('Sola lettura', 'ℹ️'); return }
      const { authUserId, globalData, viewDate } = state
      if (globalData.score < cost) {
        if (!window.confirm(`Saldo insufficiente (${globalData.score}). Andrai in negativo. Continuare?`)) return
      } else {
        if (!window.confirm(`Comprare ${name} per ${cost}?`)) return
      }
      const ref = doc(db, 'users', authUserId)

      try {
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(ref)
          const freshData = snap.data()

          let raw = freshData.dailyLogs?.[viewDate] || {}
          if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
          const purchases = [...(raw.purchases || []), { name, cost, time: Date.now() }]

          transaction.update(ref, {
            [`dailyLogs.${viewDate}.purchases`]: purchases,
          })
        })
      } catch (err) {
        console.error('buyReward transaction failed:', err)
        actions.showToast('Errore nel salvataggio', '❌')
        return
      }

      actions.vibrate('heavy')
      import('canvas-confetti').then(m => m.default({ shapes: ['circle'], colors: ['#4caf50'] }))
      actions.showToast('Acquisto effettuato!', '🛍️')
      setTimeout(() => {
        actions._checkAchievements(globalData, authUserId)
      }, 500)
    },

    async refundPurchase(idx, cost) {
      if (isReadOnly()) return
      if (!window.confirm('Annullare acquisto e rimborsare punti?')) return
      const { authUserId, viewDate } = state
      const ref = doc(db, 'users', authUserId)

      try {
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(ref)
          const freshData = snap.data()

          let raw = freshData.dailyLogs?.[viewDate] || {}
          if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
          const purchases = [...(raw.purchases || [])]
          purchases.splice(idx, 1)

          transaction.update(ref, {
            [`dailyLogs.${viewDate}.purchases`]: purchases,
          })
        })
      } catch (err) {
        console.error('refundPurchase transaction failed:', err)
        actions.showToast('Errore nel salvataggio', '❌')
        return
      }

      actions.vibrate('light')
      actions.showToast('Rimborsato!', '↩️')
    },

    async addItem(itemData, itemType) {
      if (isReadOnly()) return
      const { authUserId } = state
      const ref = doc(db, 'users', authUserId)
      if (itemType === 'habit') {
        await updateDoc(ref, { habits: arrayUnion(itemData) })
        actions._addActivityLog('habit_created', `Abitudine creata: "${itemData.name}"`, { punti: itemData.reward })
      } else {
        await updateDoc(ref, { rewards: arrayUnion(itemData) })
        actions._addActivityLog('reward_created', `Premio creato: "${itemData.name}"`, { costo: itemData.reward })
      }
      actions.vibrate('light')
      actions.showToast('Salvato!', '💾')
    },

    async saveEdit(updatedItem, itemType) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const ref = doc(db, 'users', authUserId)
      if (itemType === 'habit') {
        const prev = globalData.habits.find(h => h.id === updatedItem.id)
        const habits = globalData.habits.map(h => h.id === updatedItem.id ? updatedItem : h)
        await updateDoc(ref, { habits })
        const details = {}
        if (prev && prev.name !== updatedItem.name) details['nome'] = `${prev.name} → ${updatedItem.name}`
        if (prev && prev.reward !== updatedItem.reward) details['punti'] = `${prev.reward} → ${updatedItem.reward}`
        actions._addActivityLog('habit_modified', `Abitudine modificata: "${updatedItem.name}"`, details)
      } else {
        const prev = globalData.rewards.find(r => r.id === updatedItem.id)
        const rewards = globalData.rewards.map(r => r.id === updatedItem.id ? updatedItem : r)
        await updateDoc(ref, { rewards })
        const details = {}
        if (prev && prev.name !== updatedItem.name) details['nome'] = `${prev.name} → ${updatedItem.name}`
        if (prev && prev.reward !== updatedItem.reward) details['costo'] = `${prev.reward} → ${updatedItem.reward}`
        actions._addActivityLog('reward_modified', `Premio modificato: "${updatedItem.name}"`, details)
      }
      actions.showToast('Salvato!', '✏️')
    },

    async deleteItem(id, itemType) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const ref = doc(db, 'users', authUserId)
      if (itemType === 'habit') {
        const item = globalData.habits.find(h => h.id === id)
        const habits = globalData.habits.filter(h => h.id !== id)
        await updateDoc(ref, { habits })
        if (item) actions._addActivityLog('habit_deleted', `Abitudine eliminata: "${item.name}"`)
      } else {
        const item = globalData.rewards.find(r => r.id === id)
        const rewards = globalData.rewards.filter(r => r.id !== id)
        await updateDoc(ref, { rewards })
        if (item) actions._addActivityLog('reward_deleted', `Premio eliminato: "${item.name}"`)
      }
      actions.showToast('Eliminato', '🗑️')
    },

    async archiveItem(id, itemType, dateStr) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const ref = doc(db, 'users', authUserId)
      const listKey = itemType === 'habit' ? 'habits' : 'rewards'
      const item = globalData[listKey].find(i => i.id === id)
      const list = globalData[listKey].map(i => i.id === id ? { ...i, archivedAt: dateStr } : i)
      await updateDoc(ref, { [listKey]: list })
      if (item) {
        const logType = itemType === 'habit' ? 'habit_archived' : 'reward_deleted'
        actions._addActivityLog(logType, `${itemType === 'habit' ? 'Abitudine' : 'Premio'} archiviato: "${item.name}"`, { data: dateStr })
      }
      actions.showToast('Archiviato', '📦')
    },

    async saveTags(tags) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const prevTags = globalData.tags || []
      await updateDoc(doc(db, 'users', authUserId), { tags })
      tags.forEach(t => {
        const prev = prevTags.find(p => p.id === t.id)
        if (!prev) actions._addActivityLog('tag_created', `Tag creato: "${t.name}"`)
        else if (prev.name !== t.name || prev.color !== t.color) actions._addActivityLog('tag_modified', `Tag modificato: "${t.name}"`)
      })
      prevTags.forEach(p => {
        if (!tags.find(t => t.id === p.id)) actions._addActivityLog('tag_deleted', `Tag eliminato: "${p.name}"`)
      })
      actions.showToast('Tag salvato', '🏷️')
    },

    async exportData() {
      actions.showToast('Backup...', '⏳')
      try {
        const snap = await getDocs(collection(db, 'users'))
        const backup = {}
        snap.forEach(d => { backup[d.id] = d.data() })
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `GLP_Backup_${toDateString(new Date())}.json`
        a.click()
        URL.revokeObjectURL(url)
        actions._addActivityLog('backup_done', 'Backup JSON eseguito')
        actions.showToast('Backup completato!', '✅')
      } catch (e) {
        console.error(e)
        actions.showToast('Errore backup', '❌')
      }
    },

    async importData(file) {
      if (isReadOnly()) return
      try {
        const text = await file.text()
        const backup = JSON.parse(text)
        if (!window.confirm('Sovrascrivere tutti i dati?')) return
        actions.showToast('Ripristino...', '⏳')
        for (const userId in backup) {
          if (Object.prototype.hasOwnProperty.call(backup, userId)) {
            await setDoc(doc(db, 'users', userId), backup[userId])
          }
        }
        actions._addActivityLog('restore_done', 'Ripristino da backup JSON eseguito')
        actions.showToast('Fatto!', '✅')
        setTimeout(() => window.location.reload(), 1500)
      } catch (e) {
        console.error(e)
        actions.showToast('File non valido', '❌')
      }
    },

    // Cancella TUTTI i dati dell'utente (documento principale, sotto-collezioni,
    // file PDF in Storage) e riporta l'account allo stato di un account nuovo.
    // L'autenticazione non viene toccata. Non blocca al primo errore: prosegue
    // con gli altri step e restituisce l'elenco di eventuali fallimenti.
    async resetAllUserData() {
      if (isReadOnly()) return { success: false, errors: ['Operazione non consentita in sola lettura'] }
      const { authUserId } = state
      if (!authUserId) return { success: false, errors: ['Utente non autenticato'] }
      const errors = []

      // 1) Storage: elenca ed elimina fisicamente tutti i PDF dell'utente
      const realUid = auth.currentUser?.uid
      if (realUid) {
        try {
          const list = await listAll(storageRef(storage, `pdfs/${realUid}`))
          const results = await Promise.allSettled(list.items.map(item => deleteObject(item)))
          results.forEach((r, i) => {
            if (r.status === 'rejected') errors.push(`File PDF "${list.items[i].name}": ${r.reason?.message || r.reason}`)
          })
        } catch (e) {
          errors.push(`Storage PDF: ${e.message || e}`)
        }
      }

      // 2) Sotto-collezioni semplici (Firestore non le cancella insieme al documento padre)
      for (const sub of ['fcmTokens', 'settings', 'private']) {
        try {
          const snap = await getDocs(collection(db, 'users', authUserId, sub))
          const results = await Promise.allSettled(snap.docs.map(d => deleteDoc(d.ref)))
          results.forEach((r, i) => {
            if (r.status === 'rejected') errors.push(`${sub}/${snap.docs[i].id}: ${r.reason?.message || r.reason}`)
          })
        } catch (e) {
          errors.push(`Sotto-collezione ${sub}: ${e.message || e}`)
        }
      }

      // 3) Letture (readings) + le loro sotto-collezioni logs
      try {
        const readingsSnap = await getDocs(collection(db, 'users', authUserId, 'readings'))
        for (const readingDoc of readingsSnap.docs) {
          try {
            const logsSnap = await getDocs(collection(db, 'users', authUserId, 'readings', readingDoc.id, 'logs'))
            const logResults = await Promise.allSettled(logsSnap.docs.map(d => deleteDoc(d.ref)))
            logResults.forEach((r, i) => {
              if (r.status === 'rejected') errors.push(`readings/${readingDoc.id}/logs/${logsSnap.docs[i].id}: ${r.reason?.message || r.reason}`)
            })
          } catch (e) {
            errors.push(`Log letture di ${readingDoc.id}: ${e.message || e}`)
          }
          try {
            await deleteDoc(readingDoc.ref)
          } catch (e) {
            errors.push(`Lettura ${readingDoc.id}: ${e.message || e}`)
          }
        }
      } catch (e) {
        errors.push(`Letture: ${e.message || e}`)
      }

      // 4) Documento principale (habits, rewards, dailyLogs, tags, tasks, quickExercises,
      // journalEntries, activityLog, notificationSettings, psychStats, score, ecc.)
      try {
        await deleteDoc(doc(db, 'users', authUserId))
      } catch (e) {
        errors.push(`Documento utente: ${e.message || e}`)
      }

      // 5) Ricrea un documento vuoto identico a quello di un account nuovo,
      // così l'app non resta bloccata in attesa di dati inesistenti
      try {
        await setDoc(doc(db, 'users', authUserId), {
          score: 0, habits: [], rewards: [], history: [], dailyLogs: {}, tags: [],
        })
      } catch (e) {
        errors.push(`Ricreazione documento: ${e.message || e}`)
      }

      // 6) Preferenze locali (tema, tab attiva, filtri, wake lock, ecc.)
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('glp_'))
          .forEach(k => localStorage.removeItem(k))
      } catch (e) {
        errors.push(`Preferenze locali: ${e.message || e}`)
      }

      return { success: errors.length === 0, errors }
    },

    // ─── Notifications ───────────────────────────────────────────────────────
    async loadNotificationSettings(userId) {
      try {
        const snap = await getDoc(doc(db, 'users', userId, 'settings', 'notifications'))
        return snap.exists() ? snap.data() : null
      } catch { return null }
    },
    async saveNotificationSettings(userId, settings) {
      if (isReadOnly()) return
      try {
        await setDoc(doc(db, 'users', userId, 'settings', 'notifications'), settings, { merge: true })
        if (settings.persistentEnabled !== undefined) {
          localStorage.setItem('glp_persistent_notification', String(settings.persistentEnabled))
        }
      } catch (e) { console.error(e) }
    },
    async loadEmailSettings(userId) {
      try {
        const snap = await getDoc(doc(db, 'users', userId, 'settings', 'email'))
        return snap.exists() ? snap.data() : null
      } catch { return null }
    },
    async saveEmailSettings(userId, settings) {
      if (isReadOnly()) return
      try {
        await setDoc(doc(db, 'users', userId, 'settings', 'email'), settings, { merge: true })
      } catch (e) { console.error(e) }
    },
    async sendBackupNow(userId, email) {
      const functions = getFunctions(app, 'europe-west1')
      const fn = httpsCallable(functions, 'sendBackupNow')
      const result = await fn({ userId, email })
      return result.data
    },

    // ─── Voice Notes ──────────────────────────────────────────────────────────
    async saveVoiceNote(itemId, itemType, date, rawText) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      actions.showToast('Trascrizione in corso...', '🎤')
      const functions = getFunctions(app, 'europe-west1')
      const cleanupTranscriptionFn = httpsCallable(functions, 'cleanupTranscription', { timeout: 30000 })
      const result = await cleanupTranscriptionFn({ rawText })
      const { text, costEUR } = result.data

      const userRef = doc(db, 'users', authUserId)
      const note = {
        id: `note_${Date.now()}`,
        date,
        text,
        costEUR,
        createdAt: new Date().toISOString()
      }

      const arrayField = itemType === 'habit' ? 'habits' : 'rewards'
      const items = globalData?.[arrayField] || []
      const idx = items.findIndex(h => (h.id || h.name?.replace(/[^a-zA-Z0-9]/g, '')) === itemId)
      if (idx === -1) throw new Error('Item non trovato')

      const updatedItems = items.map((item, i) => {
        if (i !== idx) return item
        return { ...item, voiceNotes: [...(item.voiceNotes || []), note] }
      })

      await updateDoc(userRef, { [arrayField]: updatedItems })
      actions.showToast(`Nota salvata! Costo: €${costEUR.toFixed(4)}`, '✅')
      return { text, costEUR }
    },

    async deleteVoiceNote(itemId, itemType, noteId) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const userRef = doc(db, 'users', authUserId)
      const arrayField = itemType === 'habit' ? 'habits' : 'rewards'
      const items = globalData?.[arrayField] || []
      const updatedItems = items.map(item => {
        const stableId = item.id || item.name?.replace(/[^a-zA-Z0-9]/g, '')
        if (stableId !== itemId) return item
        return { ...item, voiceNotes: (item.voiceNotes || []).filter(n => n.id !== noteId) }
      })
      await updateDoc(userRef, { [arrayField]: updatedItems })
      actions.showToast('Nota eliminata', '🗑️')
    },

    // ─── Goals ───────────────────────────────────────────────────────────────
    async updateGoalValue(habitId, newValue) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const ref = doc(db, 'users', authUserId)
      const habitsArr = [...(globalData.habits || [])]
      const idx = habitsArr.findIndex(h => h.id === habitId)
      if (idx === -1) return
      const habit = habitsArr[idx]
      const gc = habit.goalConfig || {}
      const target = gc.targetValue || 1
      const updated = { ...habit, goalConfig: { ...gc, currentValue: newValue } }
      if (newValue >= target && !gc.completedAt) {
        updated.goalConfig.completedAt = toDateString(new Date())
        import('canvas-confetti').then(m => m.default({ particleCount: 100, spread: 80, origin: { y: 0.6 } }))
        actions.showToast(`Obiettivo raggiunto! +${gc.rewardOnComplete || 0}pt 🎉`, '🎯')
      }
      habitsArr[idx] = updated
      await updateDoc(ref, { habits: habitsArr })
      if (gc.completedAt || newValue < target) actions.vibrate('light')
    },

    // ─── Weight ──────────────────────────────────────────────────────────────
    // weightLog and weightGoal live in users/flavio (main doc) — already in allUsersData
    getWeightData() {
      const d = state.allUsersData?.flavio
      return { log: d?.weightLog || {}, goal: d?.weightGoal ?? null }
    },
    async saveWeight(dateStr, value) {
      if (state.authUserId !== 'flavio') return
      const ref = doc(db, 'users', 'flavio')
      const num = parseFloat(value)
      console.log('[saveWeight]', dateStr, value, '->', num)
      if (!dateStr || isNaN(num) || num < 10 || num > 500) {
        actions.showToast('Valore non valido', '⚠️'); return
      }
      try {
        await updateDoc(ref, { [`weightLog.${dateStr}`]: Math.round(num * 10) / 10 })
        actions.showToast('Peso salvato!', '⚖️')
      } catch (e) { console.error('[saveWeight error]', e); actions.showToast('Errore salvataggio', '❌') }
    },

    // ─── Foto Progressi ─────────────────────────────────────────────────────────
    // Check fisico periodico (foto multiple per sessione) — stessa struttura a
    // sottocollezione + Storage già usata per le readings (PDF).
    async uploadBodyPhotos(files, note, dateStr) {
      const { authUserId } = state
      if (authUserId !== 'flavio') return
      const realUid = auth.currentUser?.uid
      if (!realUid) { actions.showToast('Utente non autenticato', '❌'); return }
      const ts = Date.now()
      const photos = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `body-photos/${realUid}/${ts}_${i}_${safeName}`
        const sRef = storageRef(storage, path)
        await uploadBytes(sRef, file)
        const url = await getDownloadURL(sRef)
        photos.push({ url, storagePath: path })
      }
      await addDoc(collection(db, 'users', 'flavio', 'bodyPhotos'), {
        dateStr: dateStr || toDateString(new Date()),
        note: (note || '').trim().slice(0, 200),
        photos,
        createdAt: serverTimestamp(),
      })
      actions.showToast('Check fisico salvato! 📸', '📸')
    },

    async deleteBodyPhotoEntry(entry) {
      if (state.authUserId !== 'flavio') return
      for (const p of (entry.photos || [])) {
        try { await deleteObject(storageRef(storage, p.storagePath)) } catch { /* già eliminato */ }
      }
      await deleteDoc(doc(db, 'users', 'flavio', 'bodyPhotos', entry.id))
      actions.showToast('Check fisico eliminato', '🗑️')
    },
    async deleteWeight(dateStr) {
      if (state.authUserId !== 'flavio') return
      try {
        const { deleteField } = await import('firebase/firestore')
        await updateDoc(doc(db, 'users', 'flavio'), { [`weightLog.${dateStr}`]: deleteField() })
        actions.showToast('Misurazione eliminata', '🗑️')
      } catch (e) { console.error(e) }
    },
    async saveWeightGoal(goal) {
      if (state.authUserId !== 'flavio') return
      const parsed = (goal !== null && goal !== '' && !isNaN(parseFloat(goal)))
        ? Math.round(parseFloat(goal) * 10) / 10
        : null
      try {
        await updateDoc(doc(db, 'users', 'flavio'), { weightGoal: parsed })
        actions.showToast('Obiettivo aggiornato!', '🎯')
      } catch (e) { console.error(e); actions.showToast('Errore', '❌') }
    },

    // ─── Exercises ───────────────────────────────────────────────────────────
    async ensureDefaultExercise() {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      if ((gd.quickExercises || []).length > 0) return
      const def = [{
        id: 'flex_001',
        name: 'Flessioni',
        emoji: '💪',
        pointsPerRep: 0.1,   // always number, never string
        active: true,
        changes: [{ date: '2026-01-01', pointsPerRep: 0.1 }],
      }]
      console.log('[ensureDefaultExercise] creating default exercise')
      try {
        await updateDoc(doc(db, 'users', 'flavio'), { quickExercises: def })
      } catch (e) { console.error('[ensureDefaultExercise]', e) }
    },

    async addExerciseSession(exerciseId, reps, dateStr, effort, load) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) { console.error('[addExerciseSession] no gd'); return }

      // Re-read from Firestore in case snapshot is stale
      let ex = (gd.quickExercises || []).find(e => e.id === exerciseId)
      if (!ex) {
        // Fallback: read directly from Firestore
        console.warn('[addExerciseSession] exercise not in store, reading from Firestore')
        try {
          const snap = await getDoc(doc(db, 'users', 'flavio'))
          ex = (snap.data()?.quickExercises || []).find(e => e.id === exerciseId)
        } catch (e) { console.error(e) }
      }
      if (!ex) { actions.showToast('Esercizio non trovato', '❌'); return }

      const logDate = dateStr || toDateString(new Date())
      const ppr = _getPPR(ex, logDate)
      const numReps = parseInt(reps) || 0
      const effortLevel = [1, 2, 3].includes(effort) ? effort : DEFAULT_EFFORT
      const pts = parseFloat((numReps * ppr * getEffortMultiplier(effortLevel)).toFixed(2))

      console.log('[addExerciseSession]', { exerciseId, ex, reps: numReps, ppr, effortLevel, pts, logDate })

      if (!pts || pts <= 0) {
        actions.showToast('Errore nel calcolo punti — controlla ppr', '❌')
        console.error('[addExerciseSession] pts is 0 or negative', { ppr, numReps })
        return
      }

      const numLoad = parseFloat(load)
      const logEntry = {
        id: Date.now().toString(),
        exerciseId,
        reps: numReps,
        pts,
        effort: effortLevel,
        load: !isNaN(numLoad) && numLoad >= 0 ? numLoad : 0,
        time: new Date().toTimeString().slice(0, 8),
      }
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, {
        [`exerciseLog.${logDate}`]: arrayUnion(logEntry),
      })
      actions.vibrate('light')
      actions.showToast(`+${pts} pt 💪`, '💪')

      // La sessione di allenamento e il timer di recupero (finestre temporali locali)
      // si aprono/estendono solo per serie loggate OGGI — una serie retrodatata dal
      // date-picker non è "live".
      const isToday = logDate === toDateString(new Date())
      const session = isToday ? touchWorkoutSession() : null
      if (isToday) startRestTimer()

      return { logEntry, session }
    },

    async deleteExerciseSession(dateStr, logId) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const dayLog = (gd.exerciseLog?.[dateStr] || [])
      const entry = dayLog.find(e => e.id === logId)
      if (!entry) return
      const newLog = dayLog.filter(e => e.id !== logId)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, {
        [`exerciseLog.${dateStr}`]: newLog,
      })
      actions.showToast(`-${entry.pts} pt annullato`, '↩️')
    },

    async editExerciseSession(dateStr, logId, newReps) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const dayLog = (gd.exerciseLog?.[dateStr] || [])
      const entry = dayLog.find(e => e.id === logId)
      if (!entry) return
      const ex = (gd.quickExercises || []).find(e => e.id === entry.exerciseId)
      if (!ex) return
      const numReps = parseInt(newReps) || 0
      if (numReps <= 0) { actions.showToast('Ripetizioni non valide', '⚠️'); return }
      // ppr valido alla data del log, non quello odierno — coerente con addExerciseSession.
      // Preserva il moltiplicatore di sforzo originale della serie (non richiesto di nuovo).
      const ppr = _getPPR(ex, dateStr)
      const pts = parseFloat((numReps * ppr * getEffortMultiplier(entry.effort)).toFixed(2))
      const newLog = dayLog.map(e => e.id === logId ? { ...e, reps: numReps, pts } : e)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`exerciseLog.${dateStr}`]: newLog })
      actions.showToast('Serie modificata ✏️', '✏️')
    },

    // ─── Mobility ── tracciata separatamente da exerciseLog: solo durata, nessun
    // esercizio/reps. Stesso pattern add/edit/delete delle serie di allenamento.
    async addMobilitySession(durationMin, dateStr) {
      if (state.authUserId !== 'flavio') return
      const numDuration = parseFloat(durationMin) || 0
      if (numDuration <= 0) { actions.showToast('Durata non valida', '⚠️'); return }
      const pts = parseFloat((numDuration * getMobilityRate()).toFixed(2))
      const logDate = dateStr || toDateString(new Date())
      const logEntry = {
        id: Date.now().toString(),
        duration: numDuration,
        pts,
        time: new Date().toTimeString().slice(0, 8),
      }
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`mobilityLog.${logDate}`]: arrayUnion(logEntry) })
      actions.vibrate('light')
      actions.showToast(`+${pts} pt 🧘`, '🧘')
    },

    async deleteMobilitySession(dateStr, logId) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const dayLog = (gd.mobilityLog?.[dateStr] || [])
      const entry = dayLog.find(e => e.id === logId)
      if (!entry) return
      const newLog = dayLog.filter(e => e.id !== logId)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`mobilityLog.${dateStr}`]: newLog })
      actions.showToast(`-${entry.pts} pt annullato`, '↩️')
    },

    async editMobilitySession(dateStr, logId, newDuration) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const dayLog = (gd.mobilityLog?.[dateStr] || [])
      const entry = dayLog.find(e => e.id === logId)
      if (!entry) return
      const numDuration = parseFloat(newDuration) || 0
      if (numDuration <= 0) { actions.showToast('Durata non valida', '⚠️'); return }
      const pts = parseFloat((numDuration * getMobilityRate()).toFixed(2))
      const newLog = dayLog.map(e => e.id === logId ? { ...e, duration: numDuration, pts } : e)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`mobilityLog.${dateStr}`]: newLog })
      actions.showToast('Sessione modificata ✏️', '✏️')
    },

    // ─── Studio workout ── stesso pattern di Mobility, con nota libera opzionale
    // al posto del legame a un gruppo muscolare specifico.
    async addStudySession(durationMin, note, dateStr) {
      if (state.authUserId !== 'flavio') return
      const numDuration = parseFloat(durationMin) || 0
      if (numDuration <= 0) { actions.showToast('Durata non valida', '⚠️'); return }
      const pts = parseFloat((numDuration * getStudyRate()).toFixed(2))
      const logDate = dateStr || toDateString(new Date())
      const logEntry = {
        id: Date.now().toString(),
        duration: numDuration,
        note: (note || '').trim().slice(0, 200),
        pts,
        time: new Date().toTimeString().slice(0, 8),
      }
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`studyLog.${logDate}`]: arrayUnion(logEntry) })
      actions.vibrate('light')
      actions.showToast(`+${pts} pt 📚`, '📚')
    },

    async deleteStudySession(dateStr, logId) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const dayLog = (gd.studyLog?.[dateStr] || [])
      const entry = dayLog.find(e => e.id === logId)
      if (!entry) return
      const newLog = dayLog.filter(e => e.id !== logId)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`studyLog.${dateStr}`]: newLog })
      actions.showToast(`-${entry.pts} pt annullato`, '↩️')
    },

    async editStudySession(dateStr, logId, newDuration, newNote) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const dayLog = (gd.studyLog?.[dateStr] || [])
      const entry = dayLog.find(e => e.id === logId)
      if (!entry) return
      const numDuration = parseFloat(newDuration) || 0
      if (numDuration <= 0) { actions.showToast('Durata non valida', '⚠️'); return }
      const pts = parseFloat((numDuration * getStudyRate()).toFixed(2))
      const newLog = dayLog.map(e => e.id === logId ? { ...e, duration: numDuration, note: (newNote || '').trim().slice(0, 200), pts } : e)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`studyLog.${dateStr}`]: newLog })
      actions.showToast('Sessione modificata ✏️', '✏️')
    },

    // ─── Willpower ── log rapido +/- , non una sessione con durata: si registra
    // subito se si è fatta o no la cosa a cui si resisteva.
    async addWillpowerEntry(text, succeeded, dateStr, points) {
      if (state.authUserId !== 'flavio') return
      const trimmed = (text || '').trim().slice(0, 100)
      if (!trimmed) { actions.showToast('Descrivi cosa hai fatto/non fatto', '⚠️'); return }
      const rate = parseFloat(points) > 0 ? parseFloat(points) : getWillpowerRate()
      const pts = succeeded ? rate : -rate
      const logDate = dateStr || toDateString(new Date())
      const logEntry = {
        id: Date.now().toString(),
        text: trimmed,
        succeeded: !!succeeded,
        pts,
        time: new Date().toTimeString().slice(0, 8),
      }
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`willpowerLog.${logDate}`]: arrayUnion(logEntry) })
      actions.vibrate(succeeded ? 'light' : 'heavy')
      actions.showToast(succeeded ? `+${rate} pt 💪` : `-${rate} pt 😔`, succeeded ? '💪' : '😔')
    },

    async deleteWillpowerEntry(dateStr, logId) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const dayLog = (gd.willpowerLog?.[dateStr] || [])
      const entry = dayLog.find(e => e.id === logId)
      if (!entry) return
      const newLog = dayLog.filter(e => e.id !== logId)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`willpowerLog.${dateStr}`]: newLog })
      actions.showToast('Voce eliminata', '↩️')
    },

    // ─── Riepilogo Giornata ── trascrizione vocale incollata → riepilogo AI a
    // categorie fisse (vedi generateDayRecap in Cloud Functions). I punti si
    // guadagnano solo alla prima generazione del giorno, non rigenerando.
    async generateDayRecap(transcript, dateStr) {
      if (state.authUserId !== 'flavio') return
      const trimmed = (transcript || '').trim()
      if (trimmed.length < 10) { actions.showToast('Incolla un testo più lungo', '⚠️'); return }

      const logDate = dateStr || toDateString(new Date())
      const gd = state.allUsersData?.flavio
      const alreadyGenerated = !!gd?.dayRecapLog?.[logDate]

      const functions = getFunctions(app, 'europe-west1')
      const fn = httpsCallable(functions, 'generateDayRecap', { timeout: 60000 })
      const result = await fn({ transcript: trimmed.slice(0, 8000) })
      const categories = result.data?.categories || []

      const rate = getDayRecapRate()
      const pts = alreadyGenerated ? 0 : rate

      const entry = {
        categories,
        transcript: trimmed.slice(0, 8000),
        pts,
        createdAt: new Date().toISOString(),
      }
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`dayRecapLog.${logDate}`]: entry })

      if (pts > 0) { actions.vibrate('light'); actions.showToast(`+${pts} pt 📝`, '📝') }
      else { actions.showToast('Riepilogo aggiornato', '📝') }

      return entry
    },

    async deleteDayRecap(dateStr) {
      if (state.authUserId !== 'flavio') return
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`dayRecapLog.${dateStr}`]: deleteField() })
      actions.showToast('Riepilogo eliminato', '🗑️')
    },

    // Modifica manuale del riepilogo già generato (categorie/voci) — l'AI a
    // volte non è perfetta, l'utente deve poter correggere senza rigenerare
    // tutto da capo perdendo le modifiche precedenti.
    async updateDayRecap(dateStr, categories) {
      if (state.authUserId !== 'flavio') return
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`dayRecapLog.${dateStr}.categories`]: categories })
      actions.showToast('Riepilogo modificato ✏️', '✏️')
    },

    // ─── Nutrizione/Proteine ── database alimenti (proteinFoods) con proteine
    // per 100g stimate via AI la prima volta, log giornaliero (proteinLog)
    // separato — non tocca lo score, è solo tracciamento nutrizionale.
    getProteinData() {
      const gd = state.allUsersData?.flavio
      return {
        foods: gd?.proteinFoods || [],
        log: gd?.proteinLog || {},
        weightLog: gd?.weightLog || {},
      }
    },

    // Chiamata una sola volta, al primo utilizzo della tab: se il database
    // alimenti è ancora vuoto, lo popola con i 9 alimenti di partenza stimando
    // le proteine per 100g via AI in una singola chiamata.
    async ensureDefaultProteinFoods() {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (gd?.proteinFoods?.length > 0) return

      const functions = getFunctions(app, 'europe-west1')
      const fn = httpsCallable(functions, 'estimateFoodProtein', { timeout: 60000 })
      const result = await fn({ foods: SEED_FOODS.map(f => f.name) })
      const estimates = result.data?.results || []

      const foods = SEED_FOODS.map((seed, i) => ({
        id: `food_${Date.now().toString(36)}_${i}`,
        name: seed.name,
        emoji: seed.emoji,
        proteinPer100g: estimates[i]?.proteinPer100g || 0,
      }))

      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { proteinFoods: foods })
    },

    // Aggiunge un alimento nuovo stimando le proteine per 100g via AI —
    // usato sia dal picker (quando cerchi un alimento non ancora presente) sia
    // dalla gestione manuale degli alimenti.
    async addProteinFoodAI(name) {
      if (state.authUserId !== 'flavio') return null
      const trimmed = (name || '').trim().slice(0, 60)
      if (!trimmed) { actions.showToast('Nome alimento mancante', '⚠️'); return null }

      const functions = getFunctions(app, 'europe-west1')
      const fn = httpsCallable(functions, 'estimateFoodProtein', { timeout: 30000 })
      const result = await fn({ foods: [trimmed] })
      const proteinPer100g = result.data?.results?.[0]?.proteinPer100g || 0

      const food = {
        id: `food_${Date.now().toString(36)}`,
        name: trimmed,
        emoji: '🍽️',
        proteinPer100g,
      }
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { proteinFoods: arrayUnion(food) })
      actions.showToast(`${trimmed}: ${proteinPer100g}g proteine/100g`, '🤖')
      return food
    },

    // Modifica manuale (nome/emoji/proteine per 100g) — serve a correggere
    // stime AI imprecise, richiesto esplicitamente dall'utente.
    async updateProteinFood(foodId, updates) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      const foods = gd?.proteinFoods || []
      const newFoods = foods.map(f => f.id === foodId ? { ...f, ...updates } : f)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { proteinFoods: newFoods })
      actions.showToast('Alimento modificato ✏️', '✏️')
    },

    async deleteProteinFood(foodId) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      const foods = (gd?.proteinFoods || []).filter(f => f.id !== foodId)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { proteinFoods: foods })
      actions.showToast('Alimento eliminato', '🗑️')
    },

    async addProteinEntry(food, grams, dateStr) {
      if (state.authUserId !== 'flavio') return
      const numGrams = parseFloat(grams) || 0
      if (numGrams <= 0) { actions.showToast('Grammi non validi', '⚠️'); return }
      const proteinGrams = Math.round(numGrams * (food.proteinPer100g / 100) * 10) / 10
      const logDate = dateStr || toDateString(new Date())
      const logEntry = {
        id: Date.now().toString(),
        foodId: food.id,
        name: food.name,
        emoji: food.emoji,
        grams: numGrams,
        proteinGrams,
        time: new Date().toTimeString().slice(0, 8),
      }
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`proteinLog.${logDate}`]: arrayUnion(logEntry) })
      actions.vibrate('light')
      actions.showToast(`+${proteinGrams}g proteine`, food.emoji || '🍽️')
    },

    async deleteProteinEntry(dateStr, entryId) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const dayLog = (gd.proteinLog?.[dateStr] || [])
      const newLog = dayLog.filter(e => e.id !== entryId)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`proteinLog.${dateStr}`]: newLog })
      actions.showToast('Voce eliminata', '↩️')
    },

    // ─── Barefoot ── stesso pattern di Mobility, tab Body invece che Workout.
    async addBarefootSession(durationMin, dateStr) {
      if (state.authUserId !== 'flavio') return
      const numDuration = parseFloat(durationMin) || 0
      if (numDuration <= 0) { actions.showToast('Durata non valida', '⚠️'); return }
      const pts = parseFloat((numDuration * getBarefootRate()).toFixed(2))
      const logDate = dateStr || toDateString(new Date())
      const logEntry = {
        id: Date.now().toString(),
        duration: numDuration,
        pts,
        time: new Date().toTimeString().slice(0, 8),
      }
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`barefootLog.${logDate}`]: arrayUnion(logEntry) })
      actions.vibrate('light')
      actions.showToast(`+${pts} pt 🦶`, '🦶')
    },

    async deleteBarefootSession(dateStr, logId) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const dayLog = (gd.barefootLog?.[dateStr] || [])
      const entry = dayLog.find(e => e.id === logId)
      if (!entry) return
      const newLog = dayLog.filter(e => e.id !== logId)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`barefootLog.${dateStr}`]: newLog })
      actions.showToast(`-${entry.pts} pt annullato`, '↩️')
    },

    async editBarefootSession(dateStr, logId, newDuration) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const dayLog = (gd.barefootLog?.[dateStr] || [])
      const entry = dayLog.find(e => e.id === logId)
      if (!entry) return
      const numDuration = parseFloat(newDuration) || 0
      if (numDuration <= 0) { actions.showToast('Durata non valida', '⚠️'); return }
      const pts = parseFloat((numDuration * getBarefootRate()).toFixed(2))
      const newLog = dayLog.map(e => e.id === logId ? { ...e, duration: numDuration, pts } : e)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`barefootLog.${dateStr}`]: newLog })
      actions.showToast('Sessione modificata ✏️', '✏️')
    },

    // ─── Hang ── stesso pattern di Barefoot/Mobility, tasso di default più alto.
    async addHangSession(durationMin, dateStr) {
      if (state.authUserId !== 'flavio') return
      const numDuration = parseFloat(durationMin) || 0
      if (numDuration <= 0) { actions.showToast('Durata non valida', '⚠️'); return }
      const pts = parseFloat((numDuration * getHangRate()).toFixed(2))
      const logDate = dateStr || toDateString(new Date())
      const logEntry = {
        id: Date.now().toString(),
        duration: numDuration,
        pts,
        time: new Date().toTimeString().slice(0, 8),
      }
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`hangLog.${logDate}`]: arrayUnion(logEntry) })
      actions.vibrate('light')
      actions.showToast(`+${pts} pt 🧗`, '🧗')
    },

    async deleteHangSession(dateStr, logId) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const dayLog = (gd.hangLog?.[dateStr] || [])
      const entry = dayLog.find(e => e.id === logId)
      if (!entry) return
      const newLog = dayLog.filter(e => e.id !== logId)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`hangLog.${dateStr}`]: newLog })
      actions.showToast(`-${entry.pts} pt annullato`, '↩️')
    },

    async editHangSession(dateStr, logId, newDuration) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const dayLog = (gd.hangLog?.[dateStr] || [])
      const entry = dayLog.find(e => e.id === logId)
      if (!entry) return
      const numDuration = parseFloat(newDuration) || 0
      if (numDuration <= 0) { actions.showToast('Durata non valida', '⚠️'); return }
      const pts = parseFloat((numDuration * getHangRate()).toFixed(2))
      const newLog = dayLog.map(e => e.id === logId ? { ...e, duration: numDuration, pts } : e)
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`hangLog.${dateStr}`]: newLog })
      actions.showToast('Sessione modificata ✏️', '✏️')
    },

    // ─── Mind: YouTube & Social ── una voce al giorno (non sessioni), inserita
    // la sera: si sovrascrive. Punti calcolati qui (mai fidarsi di un valore
    // calcolato lato client e passato com'è, per coerenza col tasso corrente).
    async setMindSocialEntry(dateStr, afterNoon, minutes) {
      if (state.authUserId !== 'flavio') return
      const pts = computeSocialPts(afterNoon, minutes)
      const entry = { afterNoon: !!afterNoon, minutes: parseFloat(minutes) || 0, pts }
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`mindSocialLog.${dateStr}`]: entry })
      actions.showToast(pts > 0 ? `+${pts} pt 🧠` : 'Salvato', '🧠')
    },

    // ─── Sun Exposure ── un valore per giorno (mattina/sera), nessuna lista di
    // sessioni: si sovrascrive, non si "aggiunge". Nessun punteggio per ora.
    async setSunExposure(dateStr, timeOfDay, level) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const current = gd.sunExposureLog?.[dateStr] || { morning: null, evening: null }
      const updated = { ...current, [timeOfDay]: level }
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, { [`sunExposureLog.${dateStr}`]: updated })
    },

    async saveExercise(exercise) {
      // Add or update an exercise definition
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const existing = (gd.quickExercises || [])
      const today = toDateString(new Date())
      let updated
      const idx = existing.findIndex(e => e.id === exercise.id)
      if (idx === -1) {
        // New exercise
        const newEx = {
          id: Date.now().toString(36),
          name: exercise.name, emoji: exercise.emoji || '💪',
          pointsPerRep: parseFloat(exercise.pointsPerRep) || 0.1,
          active: true,
          changes: [{ date: today, pointsPerRep: parseFloat(exercise.pointsPerRep) || 0.1 }],
        }
        updated = [...existing, newEx]
      } else {
        // Edit — append change only if ppr changed
        const prev = existing[idx]
        const newPPR = parseFloat(exercise.pointsPerRep) || prev.pointsPerRep
        const changes = prev.changes ? [...prev.changes] : [{ date: '2020-01-01', pointsPerRep: prev.pointsPerRep }]
        if (newPPR !== prev.pointsPerRep) changes.push({ date: today, pointsPerRep: newPPR })
        updated = existing.map((e, i) => i === idx ? { ...e, name: exercise.name, emoji: exercise.emoji || e.emoji, pointsPerRep: newPPR, changes } : e)
      }
      await updateDoc(doc(db, 'users', 'flavio'), { quickExercises: updated })
      actions.showToast('Esercizio salvato', '💪')
    },

    // Unisce più esercizi-varianti (es. "Squat libero" + "Squat + kettlebell 16 kg")
    // in un unico esercizio con carico selezionabile per serie. `variants` è un
    // array di { exerciseId, load } — ogni serie storica di quell'esercizio viene
    // riassegnata al nuovo esercizio unificato con quel carico. Operazione singola
    // e atomica (un solo updateDoc) per non lasciare mai i dati a metà.
    async updateExerciseMuscles(exerciseId, muscles) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const updated = (gd.quickExercises || []).map(e =>
        e.id === exerciseId ? { ...e, muscles } : e
      )
      await updateDoc(doc(db, 'users', 'flavio'), { quickExercises: updated })
      actions.showToast('Mappatura muscoli salvata', '🫀')
    },

    async archiveExercise(exerciseId) {
      if (state.authUserId !== 'flavio') return
      const gd = state.allUsersData?.flavio
      if (!gd) return
      const updated = (gd.quickExercises || []).map(e => e.id === exerciseId ? { ...e, active: false } : e)
      await updateDoc(doc(db, 'users', 'flavio'), { quickExercises: updated })
      actions.showToast('Esercizio archiviato', '📦')
    },

    // ─── Journal ──────────────────────────────────────────────────────────────
    async saveJournalEntry(dateStr, entry) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const ref = doc(db, 'users', authUserId)
      const journalEntries = { ...(globalData.journalEntries || {}), [dateStr]: { ...entry, createdAt: Date.now() } }
      await updateDoc(ref, { journalEntries })
    },

    // ─── Energy ───────────────────────────────────────────────────────────────
    async saveEnergy(session, value) {
      if (isReadOnly()) return
      const { authUserId, globalData, viewDate } = state
      const ref = doc(db, 'users', authUserId)
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      let raw = dailyLogs[viewDate] || {}
      if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
      const energy = { ...(raw.energy || {}), [authUserId]: { ...(raw.energy?.[authUserId] || {}), [session]: value, [`${session}Time`]: Date.now() } }
      dailyLogs[viewDate] = { ...raw, energy }
      await updateDoc(ref, { dailyLogs })
      if (value) actions.showToast('Energia registrata!', value === 3 ? '⚡⚡' : value === 2 ? '🔋' : '⚡')
    },

    // ─── Mood ─────────────────────────────────────────────────────────────────
    async saveMood(dateStr, mood) {
      if (isReadOnly()) return
      const { authUserId } = state
      const ref = doc(db, 'users', authUserId)
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref)
        const freshData = snap.data()
        let raw = freshData.dailyLogs?.[dateStr] || {}
        if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
        const alreadyGiven = raw.moodPtsGiven === true
        const moodMap = { ...(raw.mood || {}), [authUserId]: mood }
        const update = {
          [`dailyLogs.${dateStr}.mood`]: moodMap,
        }
        if (!alreadyGiven) {
          update[`dailyLogs.${dateStr}.moodPtsGiven`] = true
        }
        transaction.update(ref, update)
      })
      actions.showToast('Mood salvato!', mood.emoji)
    },

    // ─── Numeric value ────────────────────────────────────────────────────────
    async setNumericValue(habitId, value) {
      if (isReadOnly()) return
      const { authUserId, globalData, viewDate } = state
      const ref = doc(db, 'users', authUserId)

      const habit = (globalData.habits || []).find(h => (h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')) === habitId)
      if (!habit || !habit.numericConfig) return
      const { calcNumericPoints: cnp } = await import('./habitLogic')
      const newPts = cnp(parseFloat(value), habit.numericConfig)

      try {
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(ref)
          const freshData = snap.data()

          let raw = freshData.dailyLogs?.[viewDate] || {}
          if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
          const entry = {
            habits: [...(raw.habits || [])],
            failedHabits: [...(raw.failedHabits || [])],
            habitLevels: { ...(raw.habitLevels || {}) },
            purchases: raw.purchases || [],
            habitNotes: raw.habitNotes || {},
            habitValues: { ...(raw.habitValues || {}), [habitId]: value },
            mood: raw.mood || {},
            energy: raw.energy || {},
          }
          if (!entry.habits.includes(habitId)) entry.habits.push(habitId)

          transaction.update(ref, {
            [`dailyLogs.${viewDate}.habitValues`]: entry.habitValues,
            [`dailyLogs.${viewDate}.habits`]: entry.habits,
          })
        })
      } catch (err) {
        console.error('setNumericValue transaction failed:', err)
        actions.showToast('Errore nel salvataggio', '❌')
        return
      }

      actions.vibrate('light')
      actions.showToast(`${newPts >= 0 ? '+' : ''}${newPts} pt`, newPts >= 0 ? '✅' : '❌')
    },

    // ─── CSV Export ───────────────────────────────────────────────────────────
    async exportCsv(userData, allUsersData, dateRange = 'all') {
      actions.showToast('Generazione CSV...', '⏳')
      try {
        console.log('[exportCsv] start, dateRange:', dateRange)
        const JSZipModule = await import('jszip')
        const JSZip = JSZipModule.default || JSZipModule
        const zip = new JSZip()
        const users = ['flavio']
        const today = toDateString(new Date())

        function inRange(dateStr) {
          if (dateRange === 'all') return true
          const d = new Date(dateStr); const now = new Date()
          if (dateRange === 'year') return d >= new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
          if (dateRange === '6months') return d >= new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
          return true
        }

        // Build tags map for all users
        const tagsAll = {}
        users.forEach(u => { (allUsersData?.[u]?.tags || []).forEach(t => { if (t?.id) tagsAll[t.id] = t.name || '' }) })

        // CSV 1: daily summary
        let ds = 'data,utente,punti_guadagnati,punti_spesi,penalita,punti_netti,mood,nota_mood,abitudini_completate,abitudini_fallite,acquisti_totali\n'
        users.forEach(u => {
          const ud = allUsersData?.[u]
          if (!ud) return
          Object.keys(ud.dailyLogs || {}).filter(d => inRange(d)).sort().forEach(dateStr => {
            try {
              const entry = parseEntry(ud.dailyLogs[dateStr])
              let earned = 0, spent = 0, penalty = 0
              ;(entry.habits || []).forEach(hId => {
                const h = (ud.habits || []).find(x => (x?.id || x?.name?.replace(/[^a-zA-Z0-9]/g, '')) === hId)
                if (h) earned += getItemValueAtDate(h, 'reward', dateStr) || 0
              })
              ;(entry.failedHabits || []).forEach(hId => {
                const h = (ud.habits || []).find(x => (x?.id || x?.name?.replace(/[^a-zA-Z0-9]/g, '')) === hId)
                if (h) { const p = getItemValueAtDate(h, 'penalty', dateStr) || 0; penalty += p; spent += p }
              })
              spent += (entry.purchases || []).reduce((a, p) => a + (parseInt(p?.cost) || 0), 0)
              const mood = entry.mood?.[u]
              const moodVal = mood?.value ?? ''
              const moodNote = (mood?.note || '').replace(/,/g, ';').replace(/\n/g, ' ')
              ds += `${dateStr},${u},${earned},${spent},${penalty},${earned - spent},${moodVal},${moodNote},${(entry.habits || []).length},${(entry.failedHabits || []).length},${(entry.purchases || []).length}\n`
            } catch (rowErr) {
              console.warn('[exportCsv] skipping row', dateStr, u, rowErr)
            }
          })
        })
        zip.file('daily_summary.csv', ds)

        // CSV 2: habits config
        let hc = 'abitudine_id,utente,nome,tipo,tag,reward,penalty,importanza,why,data_creazione\n'
        users.forEach(u => {
          const ud = allUsersData?.[u]
          if (!ud) return
          ;(ud.habits || []).forEach(h => {
            if (!h) return
            const created = h.changes?.[0]?.date || ''
            const name = (h.name || '').replace(/,/g, ';').replace(/\n/g, ' ')
            const why = (h.why || '').replace(/,/g, ';').replace(/\n/g, ' ')
            hc += `${h.id || ''},${u},${name},${h.type || ''},${tagsAll[h.tagId] || ''},${h.reward || 0},${h.penalty || 0},${h.importance || 'medium'},${why},${created}\n`
          })
        })
        zip.file('habits_config.csv', hc)

        // CSV 3: achievements
        let ac = 'utente,achievement_id,data_sblocco\n'
        users.forEach(u => {
          const ud = allUsersData?.[u]
          ;(ud?.achievements || []).filter(a => a?.unlockedAt).forEach(a => {
            try {
              const _d = new Date(a.unlockedAt)
              const _ds = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`
              ac += `${u},${a.id || ''},${_ds}\n`
            } catch { /* skip malformed */ }
          })
        })
        zip.file('achievements.csv', ac)

        console.log('[exportCsv] generating zip...')
        const blob = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `GLP_Export_${today}.zip`; a.click()
        URL.revokeObjectURL(url)
        actions.showToast('Export completato!', '✅')
      } catch (e) {
        console.error('[exportCsv] ERRORE:', e)
        actions.showToast(`Errore CSV: ${e.message || e}`, '❌')
      }
    },

    async clearActivityLog(user) {
      try { await updateDoc(doc(db, 'users', user), { activityLog: [] }) } catch { /* non-critical */ }
    },

    // ─── Internal helpers ─────────────────────────────────────────────────────
    async _checkAchievements(userData, userId) {
      try {
        const achievements = userData.achievements || []
        const unlockedIds = achievements.filter(a => a.unlockedAt).map(a => a.id)
        const currentStreak = computeCurrentStreak(userData)
        const newly = checkNewAchievements(userData, unlockedIds, { currentStreak })
        if (newly.length === 0) return
        const now = Date.now()
        const updated = [...achievements]
        newly.forEach(def => {
          const existing = updated.find(a => a.id === def.id)
          if (existing) existing.unlockedAt = now
          else updated.push({ id: def.id, unlockedAt: now, notified: true })
        })
        await updateDoc(doc(db, 'users', userId), { achievements: updated })
        dispatch({ type: 'PUSH_ACHIEVEMENTS', defs: newly })
      } catch { /* non-critical */ }
    },

    _triggerPersistentNotification(userId, score, dayLog, habits) {
      if (localStorage.getItem('glp_persistent_notification') !== 'true') return
      try {
        const entry = dayLog || {}
        const done = Array.isArray(entry) ? entry : (entry.habits || [])
        const active = (habits || []).filter(h => !h.archivedAt && h.type !== 'goal').length
        const pending = Math.max(0, active - done.length)
        updatePersistentNotification({ net: Math.round(score), pending, streak: 1 })
      } catch { /* non-critical */ }
    },

    async _addActivityLog(type, description, details = {}) {
      if (isReadOnly()) return
      const { authUserId } = state
      try {
        const ref = doc(db, 'users', authUserId)
        const snap = await getDoc(ref)
        if (!snap.exists()) return
        const log = [...(snap.data().activityLog || [])]
        log.unshift({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          timestamp: Date.now(),
          user: authUserId,
          type, description, details,
        })
        if (log.length > 500) log.pop()
        await updateDoc(ref, { activityLog: log })
      } catch { /* non-critical */ }
    },

    // ─── Tasks ────────────────────────────────────────────────────────────────
    // Se si crea una task con scadenza già passata, la si segna scaduta subito
    // invece di lasciarla "active" fino al prossimo giro notturno di
    // expireTasks — altrimenti resterebbe con lo stato sbagliato (e senza lo
    // stile "scaduta" nel widget) per ore, finché non scatta la mezzanotte.
    async addTask(taskData) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const todayStr = toDateString(new Date())
      const isPast = taskData.deadline < todayStr
      const newTask = {
        id: `task_${Date.now().toString(36)}`,
        title: taskData.title,
        description: taskData.description || '',
        deadline: taskData.deadline,
        reward: taskData.reward,
        penalty: taskData.penalty,
        priority: taskData.priority || 'medium',
        status: isPast ? 'expired' : 'active',
        createdAt: new Date().toISOString(),
        completedAt: null,
        expiredAt: isPast ? new Date().toISOString() : null,
        rewardApplied: false,
        penaltyApplied: isPast,
      }
      const tasks = [...(globalData.tasks || []), newTask]
      await updateDoc(doc(db, 'users', authUserId), { tasks })
      actions.showToast(isPast ? 'Task creata già scaduta ⚠️' : 'Task creata!', '📋')
    },

    async addCompletedTask({ title, description, completedDate, reward, priority }) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const rewardNum = parseInt(reward) || 0
      const newTask = {
        id: `task_${Date.now().toString(36)}`,
        title,
        description: description || '',
        deadline: completedDate,
        reward: rewardNum,
        penalty: 0,
        priority: priority || 'medium',
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: completedDate + 'T23:59:59.000Z',
        expiredAt: null,
        rewardApplied: true,
        penaltyApplied: false,
      }
      const tasks = [...(globalData.tasks || []), newTask]
      await updateDoc(doc(db, 'users', authUserId), { tasks })
      actions.vibrate('light')
      actions.showToast(`Task già fatta registrata! +${rewardNum}pt`, '✅')
    },

    async saveNotificationSettings(settings) {
      if (isReadOnly()) return
      const { authUserId } = state
      await updateDoc(doc(db, 'users', authUserId), { notificationSettings: settings })
    },

    async editTask(taskData) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const todayStr = toDateString(new Date())
      const tasks = (globalData.tasks || []).map(t => {
        if (t.id !== taskData.id) return t
        const merged = { ...t, ...taskData }
        // Se la modifica sposta la scadenza nel passato su una task ancora
        // attiva, la marca scaduta subito (stesso motivo di addTask sopra).
        if (merged.status === 'active' && merged.deadline < todayStr) {
          return { ...merged, status: 'expired', expiredAt: new Date().toISOString(), penaltyApplied: true }
        }
        // Il contrario: se una task scaduta viene rimandata a oggi o dopo,
        // torna attiva e la penalità già applicata viene annullata — expiredAt
        // + penaltyApplied sono ciò che il calcolo del punteggio usa davvero
        // per sottrarre i punti, quindi vanno azzerati insieme allo status,
        // altrimenti la penalità resterebbe applicata in modo invisibile.
        if (merged.status === 'expired' && merged.deadline >= todayStr) {
          return { ...merged, status: 'active', expiredAt: null, penaltyApplied: false }
        }
        return merged
      })
      await updateDoc(doc(db, 'users', authUserId), { tasks })
      actions.showToast('Task aggiornata!', '✏️')
    },

    // Nome del template ricorrente collegato a una task, o null se non lo è —
    // usato per mostrare "ogni N giorni" prima di completare e il messaggio
    // giusto dopo.
    _getRecurringTemplate(task) {
      if (!task.recurringId) return null
      const { globalData } = state
      return (globalData.recurringTasks || []).find(r => r.id === task.recurringId) || null
    },

    async confirmCompleteTask(task) {
      if (isReadOnly()) return
      const template = actions._getRecurringTemplate(task)
      const confirmMsg = template
        ? `Completare "${task.title}"? +${task.reward}pt\n\n🔁 Ricorrente: si ripresenterà tra ${template.intervalDays} giorn${template.intervalDays === 1 ? 'o' : 'i'}.`
        : `Completare "${task.title}"? +${task.reward}pt`
      if (!window.confirm(confirmMsg)) return
      const { authUserId, globalData } = state
      const rewardNum = parseInt(task.reward) || 0
      console.log('completing task, reward:', task.reward, '→ rewardNum:', rewardNum)
      const now = new Date().toISOString()
      let tasks = (globalData.tasks || []).map(t =>
        t.id === task.id
          ? { ...t, status: 'completed', completedAt: now, rewardApplied: true }
          : t
      )
      tasks = actions._spawnNextRecurringInstance(task, tasks)
      await updateDoc(doc(db, 'users', authUserId), { tasks })
      actions.vibrate('light')
      if (template && template.active !== false) {
        const nextDate = addDays(toDateString(new Date()), template.intervalDays)
        const [, m, d] = nextDate.split('-')
        actions.showToast(`🔁 Ricorrente completata! Ricreata per il ${parseInt(d)}/${parseInt(m)}`, '🔁')
      } else {
        actions.showToast(`Task completata! +${task.reward}pt 🎉`, '✅')
      }
      if (task.reward >= 10) {
        import('canvas-confetti').then(m => m.default({
          particleCount: 80, spread: 70, origin: { y: 0.7 },
          colors: ['#ffca28', '#4caf50'],
        }))
      }
      setTimeout(() => {
        const freshData = { ...globalData, tasks }
        actions._checkAchievements(freshData, authUserId)
      }, 500)
    },

    async uncompleteTask(task) {
      if (isReadOnly()) return
      if (!window.confirm(`Completata per errore? Ripristina "${task.title}" tra le task attive`)) return
      const { authUserId, globalData } = state
      let tasks = (globalData.tasks || []).map(t =>
        t.id === task.id
          ? { ...t, status: 'active', completedAt: null, rewardApplied: false, expiredAt: null, penaltyApplied: false }
          : t
      )
      // Se era una task ricorrente, rimuove la prossima istanza generata al
      // completamento — altrimenti riattivandola ne resterebbero due pendenti
      // per la stessa regola.
      if (task.recurringId) {
        tasks = tasks.filter(t => !(t.recurringId === task.recurringId && t.id !== task.id && t.status === 'active'))
      }
      await updateDoc(doc(db, 'users', authUserId), { tasks })
      actions.showToast('Completamento annullato', '↩️')
    },

    async deleteExpiredTask(taskId) {
      if (isReadOnly()) return
      if (!window.confirm('Eliminare definitivamente questa task?')) return
      const { authUserId, globalData } = state
      const tasks = (globalData.tasks || []).filter(t => t.id !== taskId)
      await updateDoc(doc(db, 'users', authUserId), { tasks })
      actions.showToast('Task eliminata', '🗑️')
    },

    async deleteTask(taskId) {
      if (isReadOnly()) return
      if (!window.confirm('Eliminare questa task attiva?')) return
      const { authUserId, globalData } = state
      const tasks = (globalData.tasks || []).filter(t => t.id !== taskId)
      await updateDoc(doc(db, 'users', authUserId), { tasks })
      actions.showToast('Task eliminata', '🗑️')
    },

    async deleteCompletedTask(taskId) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const task = (globalData.tasks || []).find(t => t.id === taskId)
      if (!task) return
      const rewardNum = parseInt(task.reward) || 0
      const confirmMsg = task.status === 'completed' && rewardNum > 0
        ? `Eliminare questa task? I ${rewardNum}pt guadagnati verranno rimossi dal punteggio.`
        : 'Eliminare definitivamente questa task?'
      if (!window.confirm(confirmMsg)) return
      const tasks = (globalData.tasks || []).filter(t => t.id !== taskId)
      await updateDoc(doc(db, 'users', authUserId), { tasks })
      actions.showToast('Task eliminata', '🗑️')
    },

    openTaskEdit(task) {
      actions.openModal('taskEdit', { task })
    },

    // ─── Quotes ──────────────────────────────────────────────────────────────
    async likeQuote(id) {
      if (isReadOnly()) return
      const { authUserId } = state
      await updateDoc(doc(db, 'users', authUserId), { 'quotes.liked': arrayUnion(id) })
    },

    async dislikeQuote(id) {
      if (isReadOnly()) return
      const { authUserId } = state
      await updateDoc(doc(db, 'users', authUserId), {
        'quotes.disliked': arrayUnion(id),
        'quotes.lastShown': id,
      })
    },

    async unlikeQuote(id) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const liked = (globalData.quotes?.liked || []).filter(x => x !== id)
      await updateDoc(doc(db, 'users', authUserId), { 'quotes.liked': liked })
    },

    async undislikeQuote(id) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const disliked = (globalData.quotes?.disliked || []).filter(x => x !== id)
      await updateDoc(doc(db, 'users', authUserId), { 'quotes.disliked': disliked })
    },

    async clearAllDisliked() {
      if (isReadOnly()) return
      const { authUserId } = state
      await updateDoc(doc(db, 'users', authUserId), { 'quotes.disliked': [] })
      actions.showToast('Aforismi ripristinati', '✅')
    },

    async registerTrackedReward(rewardId, quantity, dateStr) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const reward = (globalData.rewards || []).find(r => r.id === rewardId)
      if (!reward) return

      const { calcTrackedCost } = await import('./habitLogic')
      const newCost = calcTrackedCost(quantity, reward)
      const ref = doc(db, 'users', authUserId)

      let diff

      try {
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(ref)
          const freshData = snap.data()

          let raw = freshData.dailyLogs?.[dateStr] || {}
          if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }

          const trackedRewards = { ...(raw.trackedRewards || {}) }
          const oldCost = trackedRewards[rewardId]?.cost || 0
          diff = newCost - oldCost
          trackedRewards[rewardId] = { quantity: parseInt(quantity) || 0, cost: newCost, registeredAt: Date.now() }

          transaction.update(ref, {
            [`dailyLogs.${dateStr}.trackedRewards`]: trackedRewards,
          })
        })
      } catch (err) {
        console.error('registerTrackedReward transaction failed:', err)
        actions.showToast('Errore nel salvataggio', '❌')
        return
      }

      if (diff > 0) actions.showToast(`Registrato: -${newCost}pt`, '📊')
      else if (diff < 0) actions.showToast(`Aggiornato: rimborso +${Math.abs(diff)}pt`, '📊')
      else actions.showToast('Registrato', '📊')
    },

    // Manual patch for retroactive correction of missing trackedRewards entries
    async patchTrackedRewardManual(rewardId, dateStr, quantity) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const reward = (globalData.rewards || []).find(r => r.id === rewardId)
      if (!reward) { alert('Premio non trovato: ' + rewardId); return }

      const { calcTrackedCost } = await import('./habitLogic')
      const newCost = calcTrackedCost(quantity, reward)
      const ref = doc(db, 'users', authUserId)

      try {
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(ref)
          const freshData = snap.data()

          let raw = freshData.dailyLogs?.[dateStr] || {}
          if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }

          const trackedRewards = { ...(raw.trackedRewards || {}), [rewardId]: { quantity: parseInt(quantity) || 0, cost: newCost, registeredAt: Date.now() } }

          transaction.update(ref, {
            [`dailyLogs.${dateStr}.trackedRewards`]: trackedRewards,
          })
        })
      } catch (err) {
        console.error('patchTrackedRewardManual transaction failed:', err)
        actions.showToast('Errore nel salvataggio', '❌')
        return
      }

      actions.showToast(`Corretto ${dateStr}: ${quantity}x ${reward.name} (-${newCost}pt)`, '✅')
    },

    // Il punteggio è sempre calcolato al volo (calculateTotalScore) e non è più
    // salvato su Firestore — questo pulsante serve solo a confermare all'utente
    // che il valore mostrato è corretto, senza scrivere nulla.
    forceRecalculateScore() {
      const { globalData } = state
      actions.showToast(`Punteggio verificato: ${globalData?.score ?? 0}pt`, '✅')
    },

    // Completa una task scaduta: nessun reward, nessuna modifica allo score.
    // La penalità è già stata applicata dalla Cloud Function — questa action serve solo
    // per "chiudere" la task e rimuoverla dalla vista attiva.
    async dismissExpiredTask(task) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const template = actions._getRecurringTemplate(task)
      const now = new Date().toISOString()
      let tasks = (globalData.tasks || []).map(t =>
        t.id === task.id
          ? { ...t, status: 'completed', completedAt: now, rewardApplied: false }
          : t
      )
      tasks = actions._spawnNextRecurringInstance(task, tasks)
      await updateDoc(doc(db, 'users', authUserId), { tasks })
      actions.vibrate('light')
      if (template && template.active !== false) {
        const nextDate = addDays(toDateString(new Date()), template.intervalDays)
        const [, m, d] = nextDate.split('-')
        actions.showToast(`🔁 Ricorrente completata! Ricreata per il ${parseInt(d)}/${parseInt(m)}`, '🔁')
      } else {
        actions.showToast('Task chiusa (completamento tardivo)', '✅')
      }
    },

    // ─── Task ricorrenti ──────────────────────────────────────────────────────
    // Helper interno (non chiamato direttamente dalla UI): se la task appena
    // completata proviene da una regola ricorrente attiva, aggiunge la
    // prossima istanza all'array già in costruzione, scadenza = oggi + N
    // giorni. Ritorna l'array (eventualmente) esteso, da usare nello stesso
    // updateDoc del completamento — un solo giro di rete, atomico quanto
    // basta per questo caso d'uso.
    _spawnNextRecurringInstance(task, tasksSoFar) {
      if (!task.recurringId) return tasksSoFar
      const { globalData } = state
      const template = (globalData.recurringTasks || []).find(r => r.id === task.recurringId)
      if (!template || template.active === false) return tasksSoFar
      if (hasPendingInstance(tasksSoFar, template.id)) return tasksSoFar
      const todayStr = toDateString(new Date())
      const next = buildRecurringInstance(template, todayStr)
      return [...tasksSoFar, next]
    },

    async addRecurringTask({ title, priority, reward, penalty, intervalDays, startDate }) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const todayStr = toDateString(new Date())
      const template = {
        id: `rec_${Date.now().toString(36)}`,
        title: title.trim(),
        priority: priority || 'medium',
        reward: parseInt(reward) || 0,
        penalty: parseInt(penalty) || 0,
        intervalDays: Math.max(1, parseInt(intervalDays) || 1),
        active: true,
        createdAt: new Date().toISOString(),
      }
      const firstInstance = {
        id: `task_${Date.now().toString(36)}`,
        title: template.title,
        description: '',
        deadline: startDate || todayStr,
        reward: template.reward,
        penalty: template.penalty,
        priority: template.priority,
        status: 'active',
        createdAt: new Date().toISOString(),
        completedAt: null,
        expiredAt: null,
        rewardApplied: false,
        penaltyApplied: false,
        recurringId: template.id,
      }
      const recurringTasks = [...(globalData.recurringTasks || []), template]
      const tasks = [...(globalData.tasks || []), firstInstance]
      await updateDoc(doc(db, 'users', authUserId), { recurringTasks, tasks })
      actions.showToast('Task ricorrente creata!', '🔁')
    },

    async updateRecurringTask(id, updates) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const recurringTasks = (globalData.recurringTasks || []).map(r =>
        r.id === id ? { ...r, ...updates } : r
      )
      await updateDoc(doc(db, 'users', authUserId), { recurringTasks })
      actions.showToast('Ricorrenza aggiornata', '✏️')
    },

    async toggleRecurringTaskActive(id, active) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const recurringTasks = (globalData.recurringTasks || []).map(r =>
        r.id === id ? { ...r, active } : r
      )
      await updateDoc(doc(db, 'users', authUserId), { recurringTasks })
      actions.showToast(active ? 'Ricorrenza riattivata' : 'Ricorrenza in pausa', active ? '▶️' : '⏸️')
    },

    async deleteRecurringTask(id) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const recurringTasks = (globalData.recurringTasks || []).filter(r => r.id !== id)
      await updateDoc(doc(db, 'users', authUserId), { recurringTasks })
      actions.showToast('Ricorrenza eliminata', '🗑️')
    },

    async reopenTask(task, newDeadline) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const tasks = (globalData.tasks || []).map(t => {
        if (t.id !== task.id) return t
        return { ...t, status: 'active', expiredAt: null, deadline: newDeadline, penaltyApplied: false }
      })
      await updateDoc(doc(db, 'users', authUserId), { tasks })
      actions.showToast('Task riaperta!', '↩️')
    },

    // ─── Check-in ─────────────────────────────────────────────────────────────
    async completeCheckIn(slot, answer) {
      if (isReadOnly()) return
      const { authUserId } = state
      const date = toDateString(new Date())
      const userRef = doc(db, 'users', authUserId)
      await updateDoc(userRef, {
        [`dailyLogs.${date}.checkIns.${slot}`]: { done: true, pts: 1, answer, answeredAt: new Date().toISOString() },
      })
      actions.showToast('Check-in completato! +1pt', '✅')
    },

    // ─── Missions ─────────────────────────────────────────────────────────────
    async generateDailyMissions() {
      if (isReadOnly()) return
      const { authUserId } = state
      if (authUserId !== 'flavio') return
      const date = toDateString(new Date())
      const shuffled = [...MISSION_POOL].sort(() => Math.random() - 0.5)
      const list = shuffled.slice(0, 3).map(m => ({ ...m, progress: 0, done: false, rewardGiven: false }))
      const userRef = doc(db, 'users', 'flavio')
      await updateDoc(userRef, { missions: { date, list } })
    },

    async checkAndUpdateMissions() {
      const { globalData, authUserId } = state
      if (!globalData?.missions || authUserId !== 'flavio') return
      const date = toDateString(new Date())

      if (globalData.missions.date !== date) {
        await actions.generateDailyMissions()
        return
      }

      const todayLog = globalData.dailyLogs?.[date] || {}
      const habits = todayLog.habits || []
      const failed = todayLog.failedHabits || []
      const checkIns = todayLog.checkIns || {}
      const habitValues = todayLog.habitValues || {}

      const dailyPts = (globalData.habits || [])
        .filter(h => habits.includes(h.id || h.name?.replace(/[^a-zA-Z0-9]/g, '')))
        .reduce((s, h) => s + (h.reward || 0), 0)

      const completedCheckIns = ['morning', 'midday', 'evening'].filter(s => checkIns[s]?.done).length
      const tasksCompletedToday = (globalData.tasks || []).filter(t => t.status === 'completed' && typeof t.completedAt === 'string' && t.completedAt.startsWith(date)).length

      const updatedList = [...(globalData.missions.list || [])]
      let changed = false
      let pointsToAdd = 0

      for (let i = 0; i < updatedList.length; i++) {
        const m = updatedList[i]
        if (m.rewardGiven) continue

        let progress = 0
        if (m.type === 'habits_count') progress = habits.length
        else if (m.type === 'no_failures') progress = failed.length === 0 ? 1 : 0
        else if (m.type === 'checkin_count') progress = completedCheckIns
        else if (m.type === 'checkin_morning') progress = checkIns.morning?.done ? 1 : 0
        else if (m.type === 'numeric_count') progress = Object.keys(habitValues).length
        else if (m.type === 'daily_pts') progress = dailyPts
        else if (m.type === 'task_done') progress = tasksCompletedToday

        const done = m.type === 'no_failures' ? (failed.length === 0 && habits.length > 0) : progress >= m.target

        if (progress !== m.progress || (done && !m.done)) {
          updatedList[i] = { ...m, progress, done }
          changed = true
        }

        if (done && !m.rewardGiven) {
          updatedList[i] = { ...updatedList[i], rewardGiven: true }
          pointsToAdd += m.pts
          changed = true
          actions.showToast(`Missione completata! +${m.pts}pt`, '🎯')
        }
      }

      if (!changed) return

      const userRef = doc(db, 'users', 'flavio')
      if (pointsToAdd > 0) {
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(userRef)
          const freshData = snap.data()
          transaction.update(userRef, {
            'missions.list': updatedList,
            score: (freshData.score || 0) + pointsToAdd,
          })
        })
      } else {
        await updateDoc(userRef, { 'missions.list': updatedList })
      }
    },

    async markExpiredAsCompleted(task) {
      if (isReadOnly()) return
      const rewardNum = parseInt(task.reward) || 0
      const penaltyNum = task.penaltyApplied ? (parseInt(task.penalty) || 0) : 0
      const scoreDelta = penaltyNum + rewardNum
      const confirmMsg = penaltyNum > 0
        ? `Segna come completata? Verrà restituita la penalità di ${penaltyNum}pt e accreditato il reward di ${rewardNum}pt (+${scoreDelta}pt totali)`
        : `Segna come completata? Verranno accreditati ${rewardNum}pt`
      if (!window.confirm(confirmMsg)) return

      const { authUserId } = state
      const userRef = doc(db, 'users', authUserId)

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef)
        const freshData = snap.data()

        const updatedTasks = (freshData.tasks || []).map(t => {
          if (t.id !== task.id) return t
          return {
            ...t,
            status: 'completed',
            completedAt: (t.deadline || new Date().toISOString().slice(0, 10)) + 'T23:59:59.000Z',
            penaltyApplied: false,
          }
        })

        transaction.update(userRef, { tasks: updatedTasks })
      })

      actions.showToast(`Task completata! +${rewardNum}pt`, '✅')
    },

    // ── Readings ──────────────────────────────────────────────────────────────

    async uploadReading(file, title, rewardPoints = 5) {
      const { authUserId } = state
      if (!authUserId) return
      const realUid = auth.currentUser?.uid
      if (!realUid) { actions.showToast('Utente non autenticato', '❌'); return }
      const ts = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `pdfs/${realUid}/${ts}_${safeName}`
      const sRef = storageRef(storage, path)
      await uploadBytes(sRef, file)
      const fileUrl = await getDownloadURL(sRef)
      await addDoc(collection(db, 'users', authUserId, 'readings'), {
        title: title || file.name.replace(/\.pdf$/i, ''),
        fileName: file.name,
        fileUrl,
        storagePath: path,
        uploadedAt: serverTimestamp(),
        rewardPoints,
        lastReadAt: null,
        totalReadCount: 0,
      })
      actions.showToast('PDF caricato!', '📚')
    },

    async completeReading(reading) {
      const { authUserId } = state
      if (!authUserId) return
      const pts = reading.rewardPoints || 0
      const now = new Date()
      const dateStr = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
      const readingRef = doc(db, 'users', authUserId, 'readings', reading.id)
      // Log entry nella sotto-collezione
      await addDoc(collection(db, 'users', authUserId, 'readings', reading.id, 'logs'), {
        completedAt: serverTimestamp(),
        pointsAwarded: pts,
      })
      // Aggiorna documento padre
      await updateDoc(readingRef, {
        lastReadAt: serverTimestamp(),
        totalReadCount: increment(1),
      })
      // Aggiorna i guadagni del giorno (il punteggio totale è sempre ricalcolato al volo)
      if (pts > 0) {
        await updateDoc(doc(db, 'users', authUserId), {
          [`dailyLogs.${dateStr}.readingEarned`]: increment(pts),
        })
      }
      actions.vibrate('light')
      actions.showToast(`Lettura completata! +${pts}pt`, '📖')
    },

    async deleteReading(reading) {
      const { authUserId } = state
      if (!authUserId) return
      // Elimina da Storage
      if (reading.storagePath) {
        try {
          await deleteObject(storageRef(storage, reading.storagePath))
        } catch (e) {
          // Ignora se già eliminato
        }
      }
      // Elimina documento Firestore (le sotto-collezioni vanno eliminate lato console/Cloud Functions, accettabile)
      await deleteDoc(doc(db, 'users', authUserId, 'readings', reading.id))
      actions.showToast('PDF eliminato', '🗑️')
    },

    async updateReadingReward(readingId, newReward) {
      const { authUserId } = state
      if (!authUserId) return
      await updateDoc(doc(db, 'users', authUserId, 'readings', readingId), {
        rewardPoints: newReward,
      })
    },
  }

  return (
    <AppContext.Provider value={{ state, actions }}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </AppContext.Provider>
  )
}

// ─── Exercise helper (module-level, no store access needed) ─────────────────
export function _getPPR(exercise, dateStr) {
  // Returns the pointsPerRep valid on a given date using changes[] history
  const changes = exercise?.changes
  if (!changes || changes.length === 0) return exercise?.pointsPerRep ?? 0.1
  const sorted = [...changes].sort((a, b) => a.date.localeCompare(b.date))
  let valid = sorted[0]
  for (const ch of sorted) {
    if (ch.date <= dateStr) valid = ch
    else break
  }
  return valid?.pointsPerRep ?? exercise.pointsPerRep ?? 0.1
}

export function useApp() {
  return useContext(AppContext)
}
