import { useEffect, useRef, useState } from 'react'
import { useApp } from './lib/store'
import { parseEntry, getItemValueAtDate, isHabitVisible, toDateString } from './lib/habitLogic'
import { applyTheme, applyUserColors } from './lib/themes'
import { getLevel } from './lib/levels'
import { TIME_SLOT_OPTS } from './lib/timeSlots'

import Header from './components/Header'
import ProgressCircle from './components/ProgressCircle'
import ScoreBoard from './components/ScoreBoard'
import DateNav from './components/DateNav'
import SortableHabitList from './components/SortableHabitList'
import ReminderBanner from './components/ReminderBanner'
import LevelUpOverlay from './components/LevelUpOverlay'
import Accordion from './components/Accordion'
import PurchasedList from './components/PurchasedList'
import ShopList from './components/ShopList'
import Toast from './components/Toast'
import SplashScreen from './components/SplashScreen'
import LoginScreen from './components/LoginScreen'
import AnimatedNumber from './components/AnimatedNumber'
import TrendRow from './components/TrendRow'
import GoalSection from './components/GoalSection'
import HabitSearch from './components/HabitSearch'
import EnergyBanner from './components/EnergyBanner'

import AddModal from './modals/AddModal'
import EditModal from './modals/EditModal'
import SettingsModal from './modals/SettingsModal'
import ThemeModal from './modals/ThemeModal'
import TagModal from './modals/TagModal'
import AnalyticsModal from './modals/AnalyticsModal'
import StatsModal from './modals/StatsModal'
import SingleHabitView from './modals/SingleHabitView'
import SingleRewardView from './modals/SingleRewardView'
import StatsPage from './modals/StatsPage'
import PurchaseHistoryView from './modals/PurchaseHistoryView'
import WeeklyView from './modals/WeeklyView'
import PdfReportModal from './modals/PdfReportModal'
import UpdateBanner from './components/UpdateBanner'
import RewardCategoryModal from './modals/RewardCategoryModal'
import ActivityLogModal from './modals/ActivityLogModal'
import EveningReviewModal from './modals/EveningReviewModal'
import MoodModal from './modals/MoodModal'
import InsightModal from './modals/InsightModal'
import WeeklyRecapModal from './modals/WeeklyRecapModal'
import NotificationsModal from './modals/NotificationsModal'
import AchievementsModal from './modals/AchievementsModal'
import JournalModal from './modals/JournalModal'
import JournalViewModal from './modals/JournalViewModal'
import { AchievementQueue } from './components/AchievementOverlay'
import { trackThemeUsed } from './lib/achievementLogic'
import AvatarModal from './modals/AvatarModal'
import BackupModal from './modals/BackupModal'
import QuickExerciseModal from './modals/QuickExerciseModal'
import ExerciseStatsModal from './modals/ExerciseStatsModal'
import WeightModal from './modals/WeightModal'
import CoachPage from './modals/CoachPage'
import AppUsageModal from './modals/AppUsageModal'
import DailyInsightCard from './components/DailyInsightCard'
import { trackAppOpen } from './lib/trackAppOpen'
import TaskSection from './components/TaskSection'
import TaskModal from './modals/TaskModal'
import TaskHistoryModal from './modals/TaskHistoryModal'

// Focus mode: persists per-day in localStorage
function useFocusMode(viewDate) {
  const today = toDateString(new Date())
  const storageKey = `glp_focus_${today}`
  const [focusMode, setFocusMode] = useState(() =>
    viewDate === today && localStorage.getItem(storageKey) === 'true'
  )
  useEffect(() => { if (viewDate !== today) setFocusMode(false) }, [viewDate])
  function toggle() {
    setFocusMode(prev => {
      const next = !prev
      if (viewDate === today) localStorage.setItem(storageKey, String(next))
      return next
    })
  }
  return [focusMode && viewDate === today, toggle]
}

export default function App() {
  const { state, actions } = useApp()
  const { authStatus, authUserId, viewUserId, currentUser, globalData, allUsersData, viewDate, theme, userColors, density, pendingAchievements } = state
  const isReadOnly = viewUserId !== authUserId

  const [focusMode, toggleFocusMode] = useFocusMode(viewDate)
  const [levelUpInfo, setLevelUpInfo] = useState(null)
  const [timeSlotFilter, setTimeSlotFilter] = useState(() => localStorage.getItem('glp_timeslot_filter') || 'all')
  const [habitSortMode, setHabitSortMode] = useState(false)
  const fcmInitialized = useRef(false)

  // Sort mode si chiude automaticamente al cambio data
  useEffect(() => { setHabitSortMode(false) }, [viewDate])

  // Apply theme CSS vars + track for Versatile achievement
  useEffect(() => { applyTheme(theme); trackThemeUsed(theme) }, [theme])
  useEffect(() => { applyUserColors(userColors.flavio, userColors.simona) }, [userColors])

  // Level-up detection
  useEffect(() => {
    if (!globalData || !authUserId) return
    const { level, name } = getLevel(globalData.score)
    const storageKey = `glp_celebrated_level_${authUserId}`
    const celebrated = parseInt(localStorage.getItem(storageKey) || '0')
    if (level > celebrated) {
      localStorage.setItem(storageKey, String(level))
      if (celebrated > 0) setLevelUpInfo({ level, name })
    }
  }, [globalData?.score, authUserId])

  // Online/offline detection
  useEffect(() => {
    function setOnline() { document.body.classList.remove('offline') }
    function setOffline() { document.body.classList.add('offline') }
    window.addEventListener('online', setOnline)
    window.addEventListener('offline', setOffline)
    return () => { window.removeEventListener('online', setOnline); window.removeEventListener('offline', setOffline) }
  }, [])

  // FCM: init after auth
  useEffect(() => {
    if (authStatus !== 'authenticated' || !authUserId || fcmInitialized.current) return
    fcmInitialized.current = true
    setTimeout(() => { actions.initFcmToken(authUserId) }, 3000)
  }, [authStatus, authUserId])

  // Ensure default exercise for Flavio when data loads
  useEffect(() => {
    if (authUserId === 'flavio' && globalData && !(globalData.quickExercises?.length > 0)) {
      actions.ensureDefaultExercise()
    }
  }, [authUserId, globalData?.quickExercises?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Traccia apertura app — solo Flavio, solo quando autenticato e dati caricati
  useEffect(() => {
    if (authUserId === 'flavio' && authStatus === 'authenticated') {
      trackAppOpen('flavio')
    }
  }, [authUserId, authStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth state routing ──
  if (authStatus === 'loading') {
    return (
      <SplashScreen
        correctPinLoaded={false}
        dataLoaded={false}
        forceHide={false}
        onHidden={() => {}}
      />
    )
  }

  if (authStatus === 'unauthenticated') {
    return <LoginScreen />
  }

  // Authenticated but data still loading
  if (!globalData) {
    return (
      <SplashScreen
        correctPinLoaded={true}
        dataLoaded={false}
        forceHide={false}
        onHidden={() => {}}
      />
    )
  }

  // ── Compute daily values ──
  const today = toDateString(new Date())
  const isToday = viewDate === today
  const entry = parseEntry(globalData.dailyLogs?.[viewDate])
  const tagsMap = {}
  ;(globalData.tags || []).forEach(t => { tagsMap[t.id] = t })

  const regular = [], bonus = []
  let dailyTotalPot = 0, dailyEarned = 0, dailySpent = 0

  ;(globalData.habits || []).forEach(h => {
    if (h.type === 'goal') return
    if (!isHabitVisible(h, viewDate, entry.habits, entry.failedHabits)) return
    const stableId = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    const reward = getItemValueAtDate(h, 'reward', viewDate)
    const rewardMin = getItemValueAtDate(h, 'rewardMin', viewDate)
    const penalty = getItemValueAtDate(h, 'penalty', viewDate)
    const isMulti = getItemValueAtDate(h, 'isMulti', viewDate)
    const isDone = entry.habits.includes(stableId)
    const isFailed = entry.failedHabits.includes(stableId)
    const level = entry.habitLevels[stableId] || 'max'

    if (h.type === 'if') { bonus.push(h) }
    else { regular.push(h); dailyTotalPot += reward }

    if (isDone) dailyEarned += isMulti && level === 'min' ? rewardMin : reward
    if (isFailed) dailySpent += penalty
  })

  const purchaseCost = entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)
  dailySpent += purchaseCost

  // Punti extra: esercizi rapidi del giorno corrente
  const extraPts = Math.round(
    ((globalData.exerciseLog || {})[viewDate] || [])
      .reduce((sum, s) => sum + (parseFloat(s.pts) || 0), 0) * 10
  ) / 10

  // Punti task completate nel viewDate (solo Flavio)
  const taskPts = authUserId === 'flavio'
    ? (globalData.tasks || [])
        .filter(t => t.status === 'completed' && t.completedAt?.startsWith(viewDate))
        .reduce((sum, t) => sum + (parseInt(t.reward) || 0), 0)
    : 0

  const net = dailyEarned + taskPts + extraPts - dailySpent

  function isFullyComplete(h) {
    const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    const isDone = entry.habits.includes(sid)
    if (!isDone) return false
    const isMulti = getItemValueAtDate(h, 'isMulti', viewDate)
    if (isMulti) return (entry.habitLevels[sid] || 'max') === 'max'
    return true
  }

  const IMPORTANCE_ORDER = { high: 0, medium: 1, low: 2 }
  const sortedRegular = [...regular].sort((a, b) =>
    (IMPORTANCE_ORDER[a.importance || 'medium'] - IMPORTANCE_ORDER[b.importance || 'medium'])
  )
  const sortedBonus = [...bonus].sort((a, b) =>
    (IMPORTANCE_ORDER[a.importance || 'medium'] - IMPORTANCE_ORDER[b.importance || 'medium'])
  )

  function matchesTimeSlot(h) {
    if (timeSlotFilter === 'all') return true
    if (!h.timeSlot) return true // habits without slot appear in all filters
    return h.timeSlot === timeSlotFilter
  }

  const filteredRegular = (focusMode ? sortedRegular.filter(h => !isFullyComplete(h)) : sortedRegular).filter(matchesTimeSlot)
  const filteredBonus   = (focusMode ? sortedBonus.filter(h => !isFullyComplete(h))   : sortedBonus).filter(matchesTimeSlot)

  const pendingCount = isToday
    ? regular.filter(h => {
        const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
        return !entry.habits.includes(sid) && !entry.failedHabits.includes(sid)
      }).length
    : 0

  const itemProps = {
    viewDate,
    doneHabits: entry.habits,
    failedHabits: entry.failedHabits,
    habitLevels: entry.habitLevels,
    habitNotes: entry.habitNotes,
    habitValues: entry.habitValues,
    tagsMap, isToday, globalData,
    isReadOnly,
  }

  const allRegularDone = regular.length > 0 && filteredRegular.length === 0

  return (
    <>
      {/* Read-only banner */}
      {isReadOnly && (
        <div style={{
          background: 'rgba(239,159,39,0.15)', border: '1px solid rgba(239,159,39,0.4)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span>👁</span>
          <span style={{ flex: 1, fontSize: '0.82em', color: '#EF9F27' }}>
            Stai visualizzando i dati di <strong>{currentUser === 'flavio' ? 'Flavio' : 'Simona'}</strong> — sola lettura
          </span>
          <button
            onClick={() => actions.restoreOwnUser()}
            style={{ background: '#EF9F27', color: '#000', border: 'none', borderRadius: 8, padding: '5px 12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.78em' }}
          >
            Torna ai miei dati
          </button>
        </div>
      )}

      <WeeklyRecapCheck globalData={isReadOnly ? null : globalData} actions={actions} authUserId={authUserId} />

      <Header isReadOnly={isReadOnly} />

      <div className="dashboard-top">
        <ProgressCircle earned={dailyEarned} total={dailyTotalPot} />
        <ScoreBoard />
      </div>

      <DateNav />

      {authUserId === 'flavio' ? (
        <div>
          <div className="daily-summary">
            <div className="sum-item">
              <div className="sum-label">Abitudini</div>
              <AnimatedNumber value={dailyEarned} className="sum-val sum-earn" prefix="+" />
            </div>
            <div className="sum-item">
              <div className="sum-label">Task 📋</div>
              <AnimatedNumber value={taskPts} className="sum-val sum-earn" prefix="+" />
            </div>
            <div className="sum-item">
              <div className="sum-label">Extra 💪</div>
              <AnimatedNumber value={extraPts} className="sum-val sum-earn" prefix="+" />
            </div>
            <div className="sum-item">
              <div className="sum-label">Spesi/Pen</div>
              <AnimatedNumber value={dailySpent} className="sum-val sum-spent" prefix="-" />
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 6, marginBottom: 4, fontSize: '0.82em', color: '#666', fontWeight: 600 }}>
            NETTO&nbsp;
            <span className={net < 0 ? 'net-neg' : net < 10 ? 'net-warn' : 'net-pos'} style={{ fontWeight: 800, fontSize: '1.05em' }}>
              {net > 0 ? '+' : ''}{net}pt
            </span>
          </div>
        </div>
      ) : (
        <div className="daily-summary">
          <div className="sum-item">
            <div className="sum-label">Abitudini</div>
            <AnimatedNumber value={dailyEarned} className="sum-val sum-earn" prefix="+" />
          </div>
          {extraPts > 0 && (
            <div className="sum-item">
              <div className="sum-label">Extra 💪</div>
              <AnimatedNumber value={extraPts} className="sum-val sum-earn" prefix="+" />
            </div>
          )}
          <div className="sum-item">
            <div className="sum-label">Spesi/Pen</div>
            <AnimatedNumber value={dailySpent} className="sum-val sum-spent" prefix="-" />
          </div>
          <div className="sum-item">
            <div className="sum-label">Netto</div>
            <AnimatedNumber
              value={net}
              className={`sum-val ${net < 0 ? 'net-neg' : net < 10 ? 'net-warn' : 'net-pos'}`}
              prefix={net > 0 ? '+' : ''}
            />
          </div>
        </div>
      )}

      <TrendRow userData={globalData} />

      {/* Daily Insight Card — solo Flavio */}
      {authUserId === 'flavio' && !isReadOnly && (
        <DailyInsightCard
          userData={globalData}
          dailyLogs={globalData.dailyLogs || {}}
          tags={globalData.tags || []}
          onOpenCoach={(insightText) => actions.openModal('coach', { prefill: insightText })}
        />
      )}

      {/* Mood + Journal + Insight (today only, not read-only) */}
      {isToday && !isReadOnly && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <MoodButton globalData={globalData} currentUser={authUserId} onOpen={() => actions.openModal('mood')} />
          <JournalButton globalData={globalData} onOpen={() => actions.openModal('journal')} />
          <button
            onClick={() => actions.openModal('insights')}
            style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontSize: '0.75em', color: '#666' }}
          >
            💡
          </button>
        </div>
      )}

      {/* Energy banner (only today, own data) */}
      {isToday && !isReadOnly && <EnergyBanner />}

      <GoalSection habits={globalData.habits} />

      {/* Search */}
      <SearchSection />

      {/* Section header */}
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="section-title" style={{ margin: 0 }}>Abitudini del Giorno</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!isReadOnly && (
            <button
              className={`focus-toggle${habitSortMode ? ' active' : ''}`}
              onClick={() => setHabitSortMode(v => !v)}
              title={habitSortMode ? 'Esci dalla modalità ordinamento' : 'Ordina abitudini'}
            >
              <span className="material-icons-round">swap_vert</span>
              {habitSortMode ? 'Fine' : 'Ordina'}
            </button>
          )}
          {isToday && !isReadOnly && !habitSortMode && (
            <button className="review-btn" onClick={() => actions.openModal('eveningReview')} title="Revisione Serale">
              <span className="material-icons-round">nightlight</span>
              Revisione
            </button>
          )}
          {isToday && !habitSortMode && (
            <button
              className={`focus-toggle${focusMode ? ' active' : ''}`}
              onClick={toggleFocusMode}
              title={focusMode ? 'Disattiva Focus Mode' : 'Attiva Focus Mode'}
            >
              <span className="material-icons-round">{focusMode ? 'visibility_off' : 'visibility'}</span>
              Focus
            </button>
          )}
        </div>
      </div>

      {/* Sort mode banner */}
      {habitSortMode && (
        <div style={{
          background: 'rgba(255,202,40,0.08)', border: '1px solid rgba(255,202,40,0.2)',
          borderRadius: 10, padding: '8px 14px', marginBottom: 10,
          fontSize: '0.78em', color: '#EF9F27', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span className="material-icons-round" style={{ fontSize: 16 }}>swap_vert</span>
          Modalità ordinamento attiva — trascina per riordinare
        </div>
      )}

      {isToday && !isReadOnly && !habitSortMode && <ReminderBanner pendingCount={pendingCount} />}

      {/* Time slot filter chips — nascosto in sort mode */}
      {!habitSortMode && <TimeSlotFilter value={timeSlotFilter} onChange={v => { setTimeSlotFilter(v); localStorage.setItem('glp_timeslot_filter', v) }} />}

      <div className={`habit-density-${density}`}>
        {allRegularDone && !habitSortMode ? (
          <div className="focus-complete">Tutto completato oggi! 🎉</div>
        ) : filteredRegular.length === 0 && regular.length === 0 ? (
          <div className="empty-state">Nessuna attività attiva oggi 🎉</div>
        ) : (
          <SortableHabitList habits={habitSortMode ? regular : filteredRegular} itemProps={{ ...itemProps, sortMode: habitSortMode }} sortMode={habitSortMode} />
        )}

        {!habitSortMode && (
          <Accordion label="🤷‍♂️ Abitudini Se/If (Bonus)">
            {filteredBonus.length === 0
              ? <div className="empty-state">{focusMode && bonus.length > 0 ? 'Tutti i bonus completati! 🎉' : 'Nessun bonus oggi'}</div>
              : <SortableHabitList habits={filteredBonus} itemProps={itemProps} sortMode={false} />
            }
          </Accordion>
        )}
      </div>

      {/* Task section — solo Flavio, non read-only */}
      {authUserId === 'flavio' && !isReadOnly && <TaskSection />}

      <div className="section-title" style={{ marginTop: 30 }}>Acquisti del Giorno</div>
      <PurchasedList />

      <Accordion label={<><span className="material-icons-round" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>redeem</span>Negozio Premi</>} defaultOpen={false}>
        <ShopList />
      </Accordion>

      {!isReadOnly && (
        <button className="fab" onClick={() => actions.openModal('add')}>
          <span className="material-icons-round">add</span>
        </button>
      )}

      {/* FAB secondario esercizi — solo Flavio, solo non-readOnly */}
      {authUserId === 'flavio' && !isReadOnly && (
        <ExerciseFab actions={actions} />
      )}

      {/* FAB terziario task — solo Flavio, solo non-readOnly */}
      {authUserId === 'flavio' && !isReadOnly && (
        <TaskFab actions={actions} />
      )}

      <Toast />

      {/* Modals */}
      <AddModal />
      <EditModal />
      <SettingsModal />
      <TagModal />
      <AnalyticsModal />
      <StatsModal />
      <SingleHabitView />
      <SingleRewardView />
      <StatsPage />
      <ThemeModal />
      <PurchaseHistoryView />
      <WeeklyView />
      <PdfReportModal />
      <RewardCategoryModal />
      <ActivityLogModal />
      <EveningReviewModal />
      <MoodModal />
      <InsightModal />
      <WeeklyRecapModal />
      <NotificationsModal />
      <AchievementsModal />
      {!isReadOnly && <JournalModal />}
      {!isReadOnly && <JournalViewModal />}
      <AvatarModal />
      <BackupModal />
      <QuickExerciseModal />
      <ExerciseStatsModal />
      {authUserId === 'flavio' && <WeightModal />}
      {authUserId === 'flavio' && <CoachPage />}
      {authUserId === 'flavio' && <AppUsageModal />}
      {authUserId === 'flavio' && <TaskModal />}
      {authUserId === 'flavio' && <TaskHistoryModal />}
      <UpdateBanner />

      <AchievementQueue
        queue={pendingAchievements || []}
        onClear={() => actions.clearAchievementQueue()}
      />

      {levelUpInfo && (
        <LevelUpOverlay
          levelInfo={levelUpInfo}
          onClose={() => setLevelUpInfo(null)}
        />
      )}
    </>
  )
}

// ── Helper subcomponents ──────────────────────────────────────────────────────

function SearchSection() {
  const [showSearch, setShowSearch] = useState(false)
  return showSearch ? <HabitSearch onClose={() => setShowSearch(false)} /> : (
    <button className="btn-icon" onClick={() => setShowSearch(true)} style={{ marginBottom: 4 }} title="Cerca abitudine">
      <span className="material-icons-round" style={{ fontSize: 18 }}>search</span>
    </button>
  )
}

function WeeklyRecapCheck({ globalData, actions, authUserId }) {
  useEffect(() => {
    if (!globalData || !authUserId) return
    const now = new Date()
    if (now.getDay() !== 0) return
    const yr = now.getFullYear()
    const d = new Date(Date.UTC(yr, now.getMonth(), now.getDate()))
    const dayN = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dayN)
    const wk = Math.ceil(((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7)
    const key = `glp_weekly_recap_${yr}-W${wk}`
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1')
      setTimeout(() => actions.openModal('weeklyRecap'), 1200)
    }
  }, [globalData])
  return null
}

function JournalButton({ globalData, onOpen }) {
  const today = toDateString(new Date())
  const existing = globalData?.journalEntries?.[today]
  const hasAnswer = Boolean(existing?.answer)
  return (
    <button onClick={onOpen} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 5, background: hasAnswer ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${hasAnswer ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontSize: '0.75em', color: hasAnswer ? 'var(--theme-color)' : '#666' }}>
      {hasAnswer ? '📔 ✓' : '📔 Diario'}
    </button>
  )
}

// TIME_SLOT_OPTS imported from lib/timeSlots — no longer defined here

// ── Exercise FAB (secondary, Flavio only) ─────────────────────────────────────
function ExerciseFab({ actions }) {
  const longPressTimer = useRef(null)
  const didLongPress = useRef(false)

  function onPointerDown() {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      actions.openModal('exerciseStats')
      navigator.vibrate?.([30, 20, 30])
    }, 500)
  }

  function onPointerUp() {
    clearTimeout(longPressTimer.current)
    if (!didLongPress.current) actions.openModal('quickExercise')
  }

  function onPointerLeave() {
    clearTimeout(longPressTimer.current)
  }

  return (
    <button
      className="fab fab-secondary"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      title="Tap: inserisci esercizio · Tieni premuto: statistiche"
    >
      <span style={{ fontSize: '1.4em', lineHeight: 1 }}>💪</span>
    </button>
  )
}

function TaskFab({ actions }) {
  const longPressTimer = useRef(null)
  const didLongPress = useRef(false)

  function onPointerDown() {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      actions.showToast('Nuova Task', '📋')
      navigator.vibrate?.([30])
    }, 500)
  }
  function onPointerUp() {
    clearTimeout(longPressTimer.current)
    if (!didLongPress.current) actions.openModal('taskAdd')
  }
  function onPointerLeave() { clearTimeout(longPressTimer.current) }

  return (
    <button
      className="fab fab-tertiary"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      title="Nuova Task"
    >
      <span style={{ fontSize: '1.3em', lineHeight: 1 }}>📋</span>
    </button>
  )
}

function TimeSlotFilter({ value, onChange }) {
  const slots = [
    { v: 'all', icon: null, label: 'Tutte' },
    ...TIME_SLOT_OPTS.filter(o => o.v !== null),
  ]
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
      {slots.map(s => (
        <button
          key={s.v}
          onClick={() => onChange(s.v)}
          style={{
            padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: '0.72em', cursor: 'pointer',
            background: value === s.v ? 'var(--theme-glow)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${value === s.v ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`,
            color: value === s.v ? 'var(--theme-color)' : '#666',
            fontWeight: value === s.v ? 700 : 400,
          }}
        >
          {s.icon && <span className="material-icons-round" style={{ fontSize: 13, verticalAlign: 'middle', marginRight: 3, color: value === s.v ? 'var(--theme-color)' : s.color }}>{s.icon}</span>}
          {s.label}
        </button>
      ))}
    </div>
  )
}

function MoodButton({ globalData, currentUser, onOpen }) {
  const today = toDateString(new Date())
  const existing = globalData?.dailyLogs?.[today]?.mood?.[currentUser]
  return (
    <button onClick={onOpen} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: existing ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${existing ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontSize: '0.75em', color: existing ? 'var(--text)' : '#666' }}>
      {existing
        ? <><span style={{ fontSize: '1.1em' }}>{existing.emoji}</span> {['', 'Pessima', 'Difficile', 'Norma', 'Buona', 'Fantastica'][existing.value]}</>
        : <>😶 Come è andata?</>}
    </button>
  )
}
