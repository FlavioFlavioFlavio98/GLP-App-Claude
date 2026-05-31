import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { db } from './firebase'
import {
  doc, onSnapshot, updateDoc, setDoc, getDoc, deleteDoc,
  arrayUnion, collection, getDocs,
} from 'firebase/firestore'
import { toDateString, getItemValueAtDate } from './habitLogic'

const AppContext = createContext(null)
const DispatchContext = createContext(null)

const USERS = ['flavio', 'simona']

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER_DATA':
      return {
        ...state,
        allUsersData: { ...state.allUsersData, [action.user]: action.data },
        globalData: action.user === state.currentUser ? action.data : state.globalData,
      }
    case 'SWITCH_USER':
      localStorage.setItem('glp_user', action.user)
      return {
        ...state,
        currentUser: action.user,
        globalData: state.allUsersData[action.user] || null,
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
    case 'SET_PIN':
      return { ...state, correctPin: action.pin }
    case 'SET_DENSITY':
      localStorage.setItem('glp_density', action.density)
      return { ...state, density: action.density }
    default:
      return state
  }
}

const initialState = {
  currentUser: localStorage.getItem('glp_user') || 'flavio',
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
  correctPin: null,
  density: localStorage.getItem('glp_density') || 'normal',
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const toastTimer = useRef(null)

  // Load PIN from Firestore on mount
  useEffect(() => {
    async function initPin() {
      const ref = doc(db, 'config', 'security')
      try {
        const snap = await getDoc(ref)
        if (snap.exists()) {
          dispatch({ type: 'SET_PIN', pin: snap.data().pin || '0811' })
        } else {
          await setDoc(ref, { pin: '0811' })
          dispatch({ type: 'SET_PIN', pin: '0811' })
        }
      } catch (e) {
        console.error('PIN load error:', e)
        dispatch({ type: 'SET_PIN', pin: '0811' })
      }
    }
    initPin()
  }, [])

  // Firebase listeners for both users
  useEffect(() => {
    const unsubs = USERS.map(u =>
      onSnapshot(doc(db, 'users', u), snap => {
        if (snap.exists()) {
          dispatch({ type: 'SET_USER_DATA', user: u, data: snap.data() })
        }
      })
    )
    // Ensure both user docs exist
    USERS.forEach(async u => {
      const ref = doc(db, 'users', u)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await setDoc(ref, { score: 0, habits: [], rewards: [], history: [], dailyLogs: {}, tags: [] })
      }
    })
    return () => unsubs.forEach(u => u())
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (state.toast) {
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 2600)
    }
  }, [state.toast])

  const actions = {
    showToast(msg, icon = 'ℹ️') {
      dispatch({ type: 'SET_TOAST', payload: { msg, icon } })
    },
    vibrate(type) {
      if (!navigator.vibrate) return
      if (type === 'light') navigator.vibrate(30)
      if (type === 'heavy') navigator.vibrate([50, 50])
    },
    switchUser(u) {
      if (u === state.currentUser) return
      dispatch({ type: 'SWITCH_USER', user: u })
      actions.vibrate('light')
    },
    setTheme(themeId) {
      dispatch({ type: 'SET_THEME', theme: themeId })
    },
    setUserColor(user, color) {
      dispatch({ type: 'SET_USER_COLOR', user, color })
    },
    setViewDate(dateStr) {
      dispatch({ type: 'SET_VIEW_DATE', date: dateStr })
    },
    openModal(name, payload) {
      dispatch({ type: 'SET_MODAL', name, payload })
    },
    closeModal() {
      dispatch({ type: 'CLOSE_MODAL' })
    },

    // --- DENSITY ---
    setDensity(d) { dispatch({ type: 'SET_DENSITY', density: d }) },

    // --- PIN ---
    async saveNewPin(newPin) {
      try {
        await setDoc(doc(db, 'config', 'security'), { pin: newPin })
        dispatch({ type: 'SET_PIN', pin: newPin })
        actions._addActivityLog('pin_changed', 'PIN aggiornato')
        actions.showToast('PIN aggiornato!', '🔒')
      } catch (e) {
        console.error('Save PIN error:', e)
        actions.showToast('Errore salvataggio PIN', '❌')
      }
    },

    // --- REORDER ---
    async reorderHabits(activeId, overId) {
      const { currentUser, globalData } = state
      const habits = [...(globalData.habits || [])]
      const oldIndex = habits.findIndex(h => h.id === activeId)
      const newIndex = habits.findIndex(h => h.id === overId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      // arrayMove inline
      const reordered = [...habits]
      const [removed] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, removed)
      await updateDoc(doc(db, 'users', currentUser), { habits: reordered })
    },

    // --- HABIT NOTES ---
    async saveHabitNote(habitId, note, dateStr) {
      const { currentUser, globalData } = state
      const ref = doc(db, 'users', currentUser)
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      let raw = dailyLogs[dateStr] || {}
      if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
      const habitNotes = { ...(raw.habitNotes || {}), [habitId]: note }
      dailyLogs[dateStr] = { ...raw, habitNotes }
      await updateDoc(ref, { dailyLogs })
    },

    // --- HABIT ACTIONS ---
    async setHabitStatus(habitId, action) {
      const { currentUser, globalData, viewDate } = state
      actions.vibrate('light')
      const ref = doc(db, 'users', currentUser)
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

      // Undo previous state
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
      await actions._logHistory(currentUser, score)

      if (actionType === 'done') {
        import('canvas-confetti').then(m => m.default({ particleCount: 60, spread: 60, origin: { y: 0.7 }, colors: [currentUser === 'flavio' ? '#ffca28' : '#d05ce3'] }))
        actions.showToast('Completata!', '✅')
      } else if (actionType === 'failed') {
        actions.showToast('Segnata come fallita', '❌')
      }
    },

    async buyReward(name, cost) {
      const { currentUser, globalData, viewDate } = state
      if (globalData.score < cost) {
        if (!window.confirm(`Saldo insufficiente (${globalData.score}). Andrai in negativo. Continuare?`)) return
      } else {
        if (!window.confirm(`Comprare ${name} per ${cost}?`)) return
      }
      const ref = doc(db, 'users', currentUser)
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      let raw = dailyLogs[viewDate] || {}
      if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
      const purchases = [...(raw.purchases || []), { name, cost, time: Date.now() }]
      dailyLogs[viewDate] = { habits: raw.habits || [], failedHabits: raw.failedHabits || [], habitLevels: raw.habitLevels || {}, purchases }
      const newScore = globalData.score - parseInt(cost)
      await updateDoc(ref, { score: newScore, dailyLogs })
      await actions._logHistory(currentUser, newScore)
      actions.vibrate('heavy')
      import('canvas-confetti').then(m => m.default({ shapes: ['circle'], colors: ['#4caf50'] }))
      actions.showToast('Acquisto effettuato!', '🛍️')
    },

    async refundPurchase(idx, cost) {
      if (!window.confirm('Annullare acquisto e rimborsare punti?')) return
      const { currentUser, globalData, viewDate } = state
      const ref = doc(db, 'users', currentUser)
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      const raw = dailyLogs[viewDate]
      const purchases = [...(raw.purchases || [])]
      purchases.splice(idx, 1)
      dailyLogs[viewDate] = { ...raw, purchases }
      const newScore = globalData.score + parseInt(cost)
      await updateDoc(ref, { score: newScore, dailyLogs })
      await actions._logHistory(currentUser, newScore)
      actions.vibrate('light')
      actions.showToast('Rimborsato!', '↩️')
    },

    async addItem(itemData, itemType) {
      const { currentUser } = state
      const ref = doc(db, 'users', currentUser)
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
      const { currentUser, globalData } = state
      const ref = doc(db, 'users', currentUser)
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
      const { currentUser, globalData } = state
      const ref = doc(db, 'users', currentUser)
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
      const { currentUser, globalData } = state
      const ref = doc(db, 'users', currentUser)
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
      const { currentUser, globalData } = state
      const prevTags = globalData.tags || []
      await updateDoc(doc(db, 'users', currentUser), { tags })
      // Detect what changed
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

    async saveRewardCategories(categories) {
      const { currentUser, globalData } = state
      const prev = globalData.rewardCategories || []
      await updateDoc(doc(db, 'users', currentUser), { rewardCategories: categories })
      categories.forEach(c => {
        if (!prev.find(p => p.id === c.id)) actions._addActivityLog('category_created', `Categoria creata: "${c.name}"`)
      })
      prev.forEach(p => {
        if (!categories.find(c => c.id === p.id)) actions._addActivityLog('category_deleted', `Categoria eliminata: "${p.name}"`)
      })
      actions.showToast('Categorie salvate', '🏷️')
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
      const code = window.prompt('Scrivi RESET per confermare:')
      if (code !== 'RESET') return
      const { currentUser } = state
      await deleteDoc(doc(db, 'users', currentUser))
      window.location.reload()
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
      } catch (e) { /* non-critical */ }
    },

    async _addActivityLog(type, description, details = {}) {
      const { currentUser } = state
      try {
        const ref = doc(db, 'users', currentUser)
        const snap = await getDoc(ref)
        if (!snap.exists()) return
        const log = [...(snap.data().activityLog || [])]
        log.unshift({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          timestamp: Date.now(),
          user: currentUser,
          type,
          description,
          details,
        })
        if (log.length > 500) log.pop()
        await updateDoc(ref, { activityLog: log })
      } catch (e) { /* non-critical */ }
    },

    async clearActivityLog(user) {
      try {
        await updateDoc(doc(db, 'users', user), { activityLog: [] })
      } catch (e) { /* non-critical */ }
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

export function useApp() {
  return useContext(AppContext)
}
