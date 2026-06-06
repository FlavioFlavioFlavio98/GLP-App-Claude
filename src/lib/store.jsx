import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { db, auth, ALLOWED_EMAILS, EMAIL_TO_USER } from './firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  doc, onSnapshot, updateDoc, setDoc, getDoc, deleteDoc,
  arrayUnion, collection, getDocs, increment,
} from 'firebase/firestore'
import { toDateString, getItemValueAtDate, calcNumericPoints, parseEntry } from './habitLogic'
import { saveFcmToken, updatePersistentNotification } from './fcm'
import { checkNewAchievements, computeCurrentStreak } from './achievementLogic'

const AppContext = createContext(null)
const DispatchContext = createContext(null)

const USERS = ['flavio', 'simona']

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
    case 'SET_USER_DATA':
      return {
        ...state,
        allUsersData: { ...state.allUsersData, [action.user]: action.data },
        globalData: action.user === state.currentUser ? action.data : state.globalData,
      }
    case 'SET_VIEW_DATE':
      return { ...state, viewDate: action.date }
    case 'SET_TOAST':
      return { ...state, toast: action.payload }
    case 'SET_MODAL':
      return { ...state, modal: action.name, modalPayload: action.payload || null }
    case 'CLOSE_MODAL':
      return { ...state, modal: null, modalPayload: null }
    case 'SET_THEME':
      localStorage.setItem('glp_theme', action.theme)
      return { ...state, theme: action.theme }
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
  allUsersData: { flavio: null, simona: null },
  viewDate: toDateString(new Date()),
  toast: null,
  modal: null,
  modalPayload: null,
  theme: localStorage.getItem('glp_theme') || 'dark',
  userColors: {
    flavio: localStorage.getItem('glp_color_flavio') || '#ffca28',
    simona: localStorage.getItem('glp_color_simona') || '#d05ce3',
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

    // ── Backwards-compat: switch currentUser was used by ScoreBoard ──
    switchUser(u) {
      if (u === state.currentUser) return
      if (u === state.authUserId) {
        actions.restoreOwnUser()
      } else {
        actions.switchToViewUser(u)
      }
      actions.vibrate('light')
    },

    setTheme(themeId) { dispatch({ type: 'SET_THEME', theme: themeId }) },
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
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      let raw = dailyLogs[viewDate] || {}
      if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
      let entry = {
        habits: [...(raw.habits || [])],
        failedHabits: [...(raw.failedHabits || [])],
        habitLevels: { ...(raw.habitLevels || {}) },
        purchases: raw.purchases || [],
      }

      const habitsArr = [...(globalData.habits || [])]
      const habitIndex = habitsArr.findIndex(h => (h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')) === habitId)
      const habitObj = habitsArr[habitIndex]
      if (!habitObj) return

      const isMulti = getItemValueAtDate(habitObj, 'isMulti', viewDate)
      const rewardMax = getItemValueAtDate(habitObj, 'reward', viewDate)
      const rewardMin = getItemValueAtDate(habitObj, 'rewardMin', viewDate)
      const penalty = getItemValueAtDate(habitObj, 'penalty', viewDate)

      const wasDone = entry.habits.includes(habitId)
      const wasLevel = entry.habitLevels[habitId] || 'max'
      let score = globalData.score

      if (wasDone) {
        score -= isMulti && wasLevel === 'min' ? rewardMin : rewardMax
        entry.habits = entry.habits.filter(id => id !== habitId)
        delete entry.habitLevels[habitId]
      }
      if (entry.failedHabits.includes(habitId)) {
        score += penalty
        entry.failedHabits = entry.failedHabits.filter(id => id !== habitId)
      }

      let actionType = 'neutral'
      if (action === 'failed') {
        entry.failedHabits.push(habitId)
        score -= penalty
        actionType = 'failed'
      } else if (action === 'next') {
        if (!wasDone) {
          entry.habits.push(habitId)
          if (isMulti) {
            entry.habitLevels[habitId] = 'min'
            score += rewardMin
          } else {
            entry.habitLevels[habitId] = 'max'
            score += rewardMax
            actionType = 'done'
          }
        } else if (isMulti && wasLevel === 'min') {
          entry.habits.push(habitId)
          entry.habitLevels[habitId] = 'max'
          score += rewardMax
          actionType = 'done'
        }
        if (habitIndex >= 0 && entry.habits.includes(habitId)) {
          habitsArr[habitIndex] = { ...habitsArr[habitIndex], lastDone: viewDate }
        }
      }

      dailyLogs[viewDate] = entry
      await updateDoc(ref, { score, dailyLogs, habits: habitsArr })
      await actions._logHistory(authUserId, score)

      if (actionType === 'done') {
        import('canvas-confetti').then(m => m.default({ particleCount: 60, spread: 60, origin: { y: 0.7 }, colors: [authUserId === 'flavio' ? '#ffca28' : '#d05ce3'] }))
        actions.showToast('Completata!', '✅')
      } else if (actionType === 'failed') {
        actions.showToast('Segnata come fallita', '❌')
      }
      actions._triggerPersistentNotification(authUserId, score, dailyLogs[viewDate], globalData.habits)
      setTimeout(() => {
        const freshData = { ...globalData, score, dailyLogs, habits: habitsArr }
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
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      let raw = dailyLogs[viewDate] || {}
      if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
      const purchases = [...(raw.purchases || []), { name, cost, time: Date.now() }]
      dailyLogs[viewDate] = { habits: raw.habits || [], failedHabits: raw.failedHabits || [], habitLevels: raw.habitLevels || {}, purchases }
      const newScore = globalData.score - parseInt(cost)
      await updateDoc(ref, { score: newScore, dailyLogs })
      await actions._logHistory(authUserId, newScore)
      actions.vibrate('heavy')
      import('canvas-confetti').then(m => m.default({ shapes: ['circle'], colors: ['#4caf50'] }))
      actions.showToast('Acquisto effettuato!', '🛍️')
      setTimeout(() => {
        const freshData = { ...globalData, score: newScore, dailyLogs }
        actions._checkAchievements(freshData, authUserId)
      }, 500)
    },

    async refundPurchase(idx, cost) {
      if (isReadOnly()) return
      if (!window.confirm('Annullare acquisto e rimborsare punti?')) return
      const { authUserId, globalData, viewDate } = state
      const ref = doc(db, 'users', authUserId)
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      const raw = dailyLogs[viewDate]
      const purchases = [...(raw.purchases || [])]
      purchases.splice(idx, 1)
      dailyLogs[viewDate] = { ...raw, purchases }
      const newScore = globalData.score + parseInt(cost)
      await updateDoc(ref, { score: newScore, dailyLogs })
      await actions._logHistory(authUserId, newScore)
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

    async hardReset() {
      if (isReadOnly()) return
      const code = window.prompt('Scrivi RESET per confermare:')
      if (code !== 'RESET') return
      const { authUserId } = state
      await deleteDoc(doc(db, 'users', authUserId))
      window.location.reload()
    },

    // ─── FCM / Notifications ─────────────────────────────────────────────────
    async initFcmToken(userId) {
      try { await saveFcmToken(userId) } catch { /* non-critical */ }
    },
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
      let score = globalData.score
      const updated = { ...habit, goalConfig: { ...gc, currentValue: newValue } }
      if (newValue >= target && !gc.completedAt) {
        updated.goalConfig.completedAt = toDateString(new Date())
        score += (gc.rewardOnComplete || 0)
        import('canvas-confetti').then(m => m.default({ particleCount: 100, spread: 80, origin: { y: 0.6 } }))
        actions.showToast(`Obiettivo raggiunto! +${gc.rewardOnComplete || 0}pt 🎉`, '🎯')
      }
      habitsArr[idx] = updated
      await updateDoc(ref, { habits: habitsArr, score })
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

    async addExerciseSession(exerciseId, reps) {
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

      const today = toDateString(new Date())
      const ppr = _getPPR(ex, today)
      const numReps = parseInt(reps) || 0
      const pts = parseFloat((numReps * ppr).toFixed(2))

      console.log('[addExerciseSession]', { exerciseId, ex, reps: numReps, ppr, pts })

      if (!pts || pts <= 0) {
        actions.showToast('Errore nel calcolo punti — controlla ppr', '❌')
        console.error('[addExerciseSession] pts is 0 or negative', { ppr, numReps })
        return
      }

      const logEntry = {
        id: Date.now().toString(),
        exerciseId,
        reps: numReps,
        pts,
        time: new Date().toTimeString().slice(0, 8),
      }
      const ref = doc(db, 'users', 'flavio')
      await updateDoc(ref, {
        score: increment(pts),
        [`exerciseLog.${today}`]: arrayUnion(logEntry),
      })
      await actions._logHistory('flavio', (gd.score || 0) + pts)
      actions.vibrate('light')
      actions.showToast(`+${pts} pt 💪`, '💪')
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
        score: increment(-entry.pts),
        [`exerciseLog.${dateStr}`]: newLog,
      })
      await actions._logHistory('flavio', (gd.score || 0) - entry.pts)
      actions.showToast(`-${entry.pts} pt annullato`, '↩️')
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
      const { authUserId, globalData } = state
      const ref = doc(db, 'users', authUserId)
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      let raw = dailyLogs[dateStr] || {}
      if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
      const moodMap = { ...(raw.mood || {}), [authUserId]: mood }
      dailyLogs[dateStr] = { ...raw, mood: moodMap }
      await updateDoc(ref, { dailyLogs })
      actions.showToast('Mood salvato!', mood.emoji)
    },

    // ─── Numeric value ────────────────────────────────────────────────────────
    async setNumericValue(habitId, value) {
      if (isReadOnly()) return
      const { authUserId, globalData, viewDate } = state
      const ref = doc(db, 'users', authUserId)
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      let raw = dailyLogs[viewDate] || {}
      if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
      const entry = {
        habits: [...(raw.habits || [])],
        failedHabits: [...(raw.failedHabits || [])],
        habitLevels: { ...(raw.habitLevels || {}) },
        purchases: raw.purchases || [],
        habitNotes: raw.habitNotes || {},
        habitValues: { ...(raw.habitValues || {}) },
        mood: raw.mood || {},
        energy: raw.energy || {},
      }
      const habit = (globalData.habits || []).find(h => (h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')) === habitId)
      if (!habit || !habit.numericConfig) return
      const { calcNumericPoints: cnp } = await import('./habitLogic')
      const prevValue = entry.habitValues[habitId]
      const prevPts = prevValue !== undefined ? cnp(parseFloat(prevValue), habit.numericConfig) : 0
      entry.habitValues[habitId] = value
      const newPts = cnp(parseFloat(value), habit.numericConfig)
      if (!entry.habits.includes(habitId)) entry.habits.push(habitId)
      let score = Math.round((globalData.score - prevPts + newPts) * 10) / 10
      dailyLogs[viewDate] = entry
      await updateDoc(ref, { score, dailyLogs })
      await actions._logHistory(authUserId, score)
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
        const users = ['flavio', 'simona']
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

    async _logHistory(user, score) {
      try {
        const ref = doc(db, 'users', user)
        const snap = await getDoc(ref)
        if (!snap.exists()) return
        const hist = [...(snap.data().history || [])]
        hist.push({ date: new Date().toISOString(), score })
        if (hist.length > 500) hist.shift()
        await updateDoc(ref, { history: hist })
      } catch { /* non-critical */ }
    },

    // ─── Tasks ────────────────────────────────────────────────────────────────
    async addTask(taskData) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const newTask = {
        id: `task_${Date.now().toString(36)}`,
        title: taskData.title,
        description: taskData.description || '',
        deadline: taskData.deadline,
        reward: taskData.reward,
        penalty: taskData.penalty,
        priority: taskData.priority || 'medium',
        status: 'active',
        createdAt: new Date().toISOString(),
        completedAt: null,
        expiredAt: null,
        rewardApplied: false,
        penaltyApplied: false,
      }
      const tasks = [...(globalData.tasks || []), newTask]
      await updateDoc(doc(db, 'users', authUserId), { tasks })
      actions.showToast('Task creata!', '📋')
    },

    async editTask(taskData) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const tasks = (globalData.tasks || []).map(t =>
        t.id === taskData.id ? { ...t, ...taskData } : t
      )
      await updateDoc(doc(db, 'users', authUserId), { tasks })
      actions.showToast('Task aggiornata!', '✏️')
    },

    async confirmCompleteTask(task) {
      if (isReadOnly()) return
      if (!window.confirm(`Completare "${task.title}"? +${task.reward}pt`)) return
      const { authUserId, globalData } = state
      const rewardNum = parseInt(task.reward) || 0
      console.log('completing task, reward:', task.reward, '→ rewardNum:', rewardNum)
      const now = new Date().toISOString()
      const tasks = (globalData.tasks || []).map(t =>
        t.id === task.id
          ? { ...t, status: 'completed', completedAt: now, rewardApplied: true }
          : t
      )
      await updateDoc(doc(db, 'users', authUserId), { tasks, score: increment(rewardNum) })
      await actions._logHistory(authUserId, (globalData.score || 0) + task.reward)
      actions.vibrate('light')
      actions.showToast(`Task completata! +${task.reward}pt 🎉`, '✅')
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
      if (!window.confirm(`Annullare il completamento? -${task.reward}pt verranno sottratti`)) return
      const { authUserId, globalData } = state
      const rewardNum = parseInt(task.reward) || 0
      const tasks = (globalData.tasks || []).map(t =>
        t.id === task.id
          ? { ...t, status: 'active', completedAt: null, rewardApplied: false }
          : t
      )
      await updateDoc(doc(db, 'users', authUserId), { tasks, score: increment(-rewardNum) })
      await actions._logHistory(authUserId, (globalData.score || 0) - rewardNum)
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

    async registerTrackedReward(rewardId, quantity, dateStr) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const reward = (globalData.rewards || []).find(r => r.id === rewardId)
      if (!reward) return

      const { calcTrackedCost } = await import('./habitLogic')
      const newCost = calcTrackedCost(quantity, reward)

      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      let raw = dailyLogs[dateStr] || {}
      if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }

      const trackedRewards = { ...(raw.trackedRewards || {}) }
      const oldCost = trackedRewards[rewardId]?.cost || 0
      trackedRewards[rewardId] = { quantity: parseInt(quantity) || 0, cost: newCost, registeredAt: Date.now() }
      dailyLogs[dateStr] = { ...raw, trackedRewards }

      const diff = newCost - oldCost
      await updateDoc(doc(db, 'users', authUserId), { dailyLogs, score: increment(-diff) })
      await actions._logHistory(authUserId, (globalData.score || 0) - diff)
      if (diff > 0) actions.showToast(`Registrato: -${newCost}pt`, '📊')
      else if (diff < 0) actions.showToast(`Aggiornato: rimborso +${Math.abs(diff)}pt`, '📊')
      else actions.showToast('Registrato', '📊')
    },

    async reopenTask(task, newDeadline) {
      if (isReadOnly()) return
      const { authUserId, globalData } = state
      const tasks = (globalData.tasks || []).map(t => {
        if (t.id !== task.id) return t
        return { ...t, status: 'active', expiredAt: null, deadline: newDeadline, penaltyApplied: false }
      })
      const scoreUpdate = task.penaltyApplied && task.penalty > 0
        ? { score: increment(task.penalty) }
        : {}
      await updateDoc(doc(db, 'users', authUserId), { tasks, ...scoreUpdate })
      actions.showToast('Task riaperta!', '↩️')
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
