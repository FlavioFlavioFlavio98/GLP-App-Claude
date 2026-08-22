import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useApp } from './lib/store'
import { parseEntry, getItemValueAtDate, isHabitVisible, toDateString, computeDayNet } from './lib/habitLogic'
import { applyTheme, applyUserColors } from './lib/themes'
import { getLevel } from './lib/levels'

import Header from './components/Header'
import ProgressCircle from './components/ProgressCircle'
import DateNav from './components/DateNav'
import LevelUpOverlay from './components/LevelUpOverlay'
import Toast from './components/Toast'
import SplashScreen from './components/SplashScreen'
import LoginScreen from './components/LoginScreen'
import UpdateBanner from './components/UpdateBanner'
import { AchievementQueue } from './components/AchievementOverlay'
import { trackThemeUsed } from './lib/achievementLogic'
import DailySummaryPanel from './components/DailySummaryPanel'
import { trackAppOpen } from './lib/trackAppOpen'
import BottomNav from './components/BottomNav'

// ── Tab principali: caricate on-demand, solo la tab attiva scarica il suo codice ──
const OggiTab = lazy(() => import('./tabs/OggiTab'))
const AbitudiniTab = lazy(() => import('./tabs/AbitudiniTab'))
const TaskTab = lazy(() => import('./tabs/TaskTab'))
const WorkoutTab = lazy(() => import('./components/WorkoutTab'))
const BodyTab = lazy(() => import('./components/BodyTab'))
const MenteTab = lazy(() => import('./components/MenteTab'))
const StatsTabContent = lazy(() => import('./components/StatsTabContent'))

// ── Gruppi di modali: caricati on-demand al primo accesso, raggruppati per contesto d'uso ──
const HabitCoreModals = lazy(() => import('./modalGroups/HabitCoreModals'))
const SettingsModals = lazy(() => import('./modalGroups/SettingsModals'))
const StatsModals = lazy(() => import('./modalGroups/StatsModals'))
const JournalMoodModals = lazy(() => import('./modalGroups/JournalMoodModals'))
const FitnessModals = lazy(() => import('./modalGroups/FitnessModals'))
const BodyModals = lazy(() => import('./modalGroups/BodyModals'))
const MenteModals = lazy(() => import('./modalGroups/MenteModals'))
const TaskModals = lazy(() => import('./modalGroups/TaskModals'))

// Pagine fullscreen indipendenti (già gated da stato booleano proprio, lazy dirette)
const ReadingsPage = lazy(() => import('./modals/ReadingsPage'))
const PsychSessionsPage = lazy(() => import('./modals/PsychSessionsPage'))
const HabitDiaryPage = lazy(() => import('./modals/HabitDiaryPage'))

// Liste di appartenenza ai gruppi modali (duplicate qui, non importate dai file dei
// gruppi, per non forzare Rollup a includere staticamente i loro import pesanti)
const HABIT_CORE_MODALS = ['add', 'edit', 'tags', 'rewardCategories', 'singleHabit', 'singleReward']
const SETTINGS_MODALS = ['settings', 'themeModal', 'notifications', 'achievements', 'avatar', 'backup', 'appUsage', 'quotesModal']
const STATS_MODALS = ['analytics', 'stats', 'statsPage', 'purchaseHistory', 'weeklyView', 'pdfReport', 'activityLog']
const JOURNAL_MOOD_MODALS = ['eveningReview', 'mood', 'insights', 'weeklyRecap', 'journal', 'journalView']
const FITNESS_MODALS = ['quickExercise', 'exerciseStats', 'exerciseSingle', 'weight', 'coach', 'mobility', 'study']
const BODY_MODALS = ['barefoot', 'hang']
const MENTE_MODALS = ['willpowerEntry', 'willpowerStats']
const TASK_MODALS = ['taskAdd', 'taskEdit', 'taskHistory']

function TabLoadingFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', opacity: 0.5 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.15)', borderTopColor: 'var(--theme-color)',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  )
}

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
  const { authStatus, authUserId, viewUserId, currentUser, globalData, allUsersData, viewDate, theme, userColors, density, pendingAchievements, minimalMode, wakeLockEnabled, modal } = state
  const isReadOnly = viewUserId !== authUserId
  const isNative = window.Capacitor?.isNativePlatform?.() || false

  const [focusMode, toggleFocusMode] = useFocusMode(viewDate)
  const [levelUpInfo, setLevelUpInfo] = useState(null)
  const [showPsychPage, setShowPsychPage] = useState(false)
  const [showReadings, setShowReadings] = useState(false)
  const [timeSlotFilter, setTimeSlotFilter] = useState(() => localStorage.getItem('glp_timeslot_filter') || 'all')
  const [habitSortMode, setHabitSortMode] = useState(false)
  const [habitsExpanded, setHabitsExpanded] = useState(() => localStorage.getItem('glp_habits_expanded') === 'true')
  const [bonusExpanded, setBonusExpanded] = useState(() => localStorage.getItem('glp_bonus_expanded') === 'true')
  const [voiceNoteHabit, setVoiceNoteHabit] = useState(null)
  const [currentTab, setCurrentTab] = useState(() => localStorage.getItem('glp_tab') || 'oggi')

  function changeTab(tab) {
    setCurrentTab(tab)
    localStorage.setItem('glp_tab', tab)
  }
  const wakeLockRef = useRef(null)

  // Sort mode si chiude automaticamente al cambio data
  useEffect(() => { setHabitSortMode(false) }, [viewDate])

  // Wake Lock
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    async function enable() {
      try { wakeLockRef.current = await navigator.wakeLock.request('screen') } catch (e) { /* ignore */ }
    }
    async function disable() {
      if (wakeLockRef.current) { try { await wakeLockRef.current.release() } catch(e){} wakeLockRef.current = null }
    }
    if (wakeLockEnabled) enable(); else disable()
    async function onVisibility() {
      if (wakeLockEnabled && document.visibilityState === 'visible') await enable()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility); disable() }
  }, [wakeLockEnabled])

  // Beep di recupero — polling qui (livello App, sempre montato) invece che dentro
  // WorkoutRestTimer, così i beep continuano anche navigando su un'altra tab
  // durante l'allenamento, non solo restando sulla tab Workout.
  const restBeepRef = useRef({ startedAt: null, lastMark: 0 })
  useEffect(() => {
    if (authUserId !== 'flavio') return
    let cancelled = false
    let mod = null
    import('./lib/workoutStats').then(m => { if (!cancelled) mod = m })
    const id = setInterval(() => {
      if (!mod) return
      const timer = mod.getActiveRestTimer()
      if (!timer) { restBeepRef.current = { startedAt: null, lastMark: 0 }; return }
      if (restBeepRef.current.startedAt !== timer.startedAt) {
        restBeepRef.current = { startedAt: timer.startedAt, lastMark: 0 }
      }
      if (timer.marksPassed > restBeepRef.current.lastMark) {
        restBeepRef.current.lastMark = timer.marksPassed
        mod.playRestBeep(timer.marksPassed)
      }
    }, 500)
    return () => { cancelled = true; clearInterval(id) }
  }, [authUserId])

  // Apply theme CSS vars + track for Versatile achievement
  useEffect(() => { applyTheme(theme); trackThemeUsed(theme) }, [theme])
  useEffect(() => { applyUserColors(userColors.flavio) }, [userColors])

  // Deep link da notifiche Android
  useEffect(() => {
    function handleOpenTab(e) {
      const tab = e.detail
      if (tab === 'readings') setShowReadings(true)
      // habits e tasks sono già visibili nella schermata principale
    }
    window.addEventListener('glp_open_tab', handleOpenTab)
    return () => window.removeEventListener('glp_open_tab', handleOpenTab)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
  let dailyTotalPot = 0

  ;(globalData.habits || []).forEach(h => {
    if (h.type === 'goal') return
    if (!isHabitVisible(h, viewDate, entry.habits, entry.failedHabits)) return
    const reward = getItemValueAtDate(h, 'reward', viewDate)
    if (h.type === 'if') { bonus.push(h) }
    else { regular.push(h); dailyTotalPot += reward }
  })

  // Netto Oggi: fonte unica di verità (usata anche per lo storico e il punteggio totale)
  const {
    totalHabitPoints, taskPts, extraPts, checkInPts, readingPts,
    purchaseCost, penaltyCost, dailySpent, expiredTaskCost, net,
  } = computeDayNet(globalData, viewDate)

  const trackedItems = Object.entries(entry.trackedRewards || {}).map(([id, tr]) => {
    const rw = (globalData.rewards || []).find(r => r.id === id)
    return { id, name: rw?.name || id, cost: parseInt(tr.cost) || 0 }
  })

  function isFullyComplete(h) {
    const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    const isDone = entry.habits.includes(sid)
    if (!isDone) return false
    const isMulti = getItemValueAtDate(h, 'isMulti', viewDate)
    if (isMulti) return (entry.habitLevels[sid] || 'max') === 'max'
    return true
  }

  const sortedRegular = regular
  const sortedBonus = bonus

  const doneRegularCount = regular.filter(h => {
    const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    return entry.habits.includes(sid)
  }).length

  function matchesTimeSlot(h) {
    if (timeSlotFilter === 'all') return true
    if (!h.timeSlot) return true // habits without slot appear in all filters
    return h.timeSlot === timeSlotFilter
  }

  const filteredRegular = ((focusMode || minimalMode) ? sortedRegular.filter(h => !isFullyComplete(h)) : sortedRegular).filter(matchesTimeSlot)
  const filteredBonus   = (focusMode ? sortedBonus.filter(h => !isFullyComplete(h)) : sortedBonus).filter(matchesTimeSlot)

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
    onOpenVoiceNote: setVoiceNoteHabit,
  }

  const allRegularDone = regular.length > 0 && filteredRegular.length === 0

  // ── Props condivise dal componente HabitsSection (lazy, riusato in oggi + abitudini) ──
  const habitsSectionProps = {
    doneRegularCount, regular, bonus,
    habitsExpanded,
    onToggleHabitsExpanded: () => { const next = !habitsExpanded; setHabitsExpanded(next); localStorage.setItem('glp_habits_expanded', String(next)) },
    habitSortMode,
    onToggleHabitSortMode: () => setHabitSortMode(v => !v),
    isReadOnly, isToday,
    focusMode, onToggleFocusMode: toggleFocusMode,
    actions,
    filteredRegular, filteredBonus, allRegularDone,
    timeSlotFilter,
    onChangeTimeSlot: v => { setTimeSlotFilter(v); localStorage.setItem('glp_timeslot_filter', v) },
    density, itemProps,
    minimalMode,
    bonusExpanded,
    onToggleBonusExpanded: () => { const next = !bonusExpanded; setBonusExpanded(next); localStorage.setItem('glp_bonus_expanded', String(next)) },
    pendingCount,
  }

  return (
    <>
      <WeeklyRecapCheck globalData={isReadOnly ? null : globalData} actions={actions} authUserId={authUserId} />

      {/* ── HEADER FISSO (sempre visibile su tutte le tab) ── */}
      <Header isReadOnly={isReadOnly} />

      {minimalMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 12px', background: 'rgba(255,202,40,0.08)', border: '1px solid rgba(255,202,40,0.2)', borderRadius: 10, fontSize: '0.75em', color: '#EF9F27' }}>
          <span className="material-icons-round" style={{ fontSize: 14 }}>filter_list</span>
          <span style={{ flex: 1 }}>Modalità minimalista attiva</span>
          <button onClick={() => actions.setMinimalMode(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF9F27', fontWeight: 700, fontSize: '0.9em', padding: 0 }}>Mostra tutto</button>
        </div>
      )}

      <DateNav />

      {/* ── CARD GUADAGNI/COSTI/NETTO (comprimibile) — non in Workout: l'economia
          generale di task/abitudini non è rilevante lì, dove banner e obiettivo
          mostrano già i punti guadagnati con l'allenamento di oggi ── */}
      {currentTab !== 'workout' && (
        <DailySummaryPanel
          authUserId={authUserId}
          globalData={globalData}
          totalHabitPoints={totalHabitPoints}
          taskPts={taskPts}
          extraPts={extraPts}
          checkInPts={checkInPts}
          readingPts={readingPts}
          purchaseCost={purchaseCost}
          penaltyCost={penaltyCost}
          expiredTaskCost={expiredTaskCost}
          trackedItems={trackedItems}
          dailySpent={dailySpent}
          net={net}
          buildInfo={<BuildInfo />}
        />
      )}

      {/* ── CONTENUTO TAB (scrollabile, con padding per bottom nav) ── */}
      <div style={{ paddingBottom: 68 }}>

        {/* ───────── TAB: OGGI ───────── */}
        {currentTab === 'oggi' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <OggiTab
              authUserId={authUserId}
              isReadOnly={isReadOnly}
              minimalMode={minimalMode}
              habitsSectionProps={habitsSectionProps}
            />
          </Suspense>
        )}

        {/* ───────── TAB: ABITUDINI ───────── */}
        {currentTab === 'abitudini' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <AbitudiniTab
              globalData={globalData}
              minimalMode={minimalMode}
              isReadOnly={isReadOnly}
              actions={actions}
              habitsSectionProps={habitsSectionProps}
            />
          </Suspense>
        )}

        {/* ───────── TAB: TASK ───────── */}
        {currentTab === 'task' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <TaskTab authUserId={authUserId} isReadOnly={isReadOnly} actions={actions} />
          </Suspense>
        )}

        {/* ───────── TAB: WORKOUT & PESO ───────── */}
        {currentTab === 'workout' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <WorkoutTab actions={actions} authUserId={authUserId} isReadOnly={isReadOnly} globalData={globalData} />
          </Suspense>
        )}

        {/* ───────── TAB: BODY ───────── */}
        {currentTab === 'body' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <BodyTab actions={actions} authUserId={authUserId} isReadOnly={isReadOnly} globalData={globalData} />
          </Suspense>
        )}

        {/* ───────── TAB: MENTE ───────── */}
        {currentTab === 'mente' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <MenteTab actions={actions} authUserId={authUserId} isReadOnly={isReadOnly} globalData={globalData} />
          </Suspense>
        )}

        {/* ───────── TAB: STATISTICHE ───────── */}
        {currentTab === 'stats' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <StatsTabContent actions={actions} globalData={globalData} authUserId={authUserId} isNative={isNative} isReadOnly={isReadOnly} />
          </Suspense>
        )}

      </div>

      {/* ── BOTTOM NAV ── */}
      <BottomNav currentTab={currentTab} onTabChange={changeTab} />

      <Toast />

      {/* ── TUTTE LE MODAL (invariate) ── */}
      {HABIT_CORE_MODALS.includes(modal) && (
        <Suspense fallback={null}><HabitCoreModals /></Suspense>
      )}
      {SETTINGS_MODALS.includes(modal) && (
        <Suspense fallback={null}>
          <SettingsModals
            authUserId={authUserId}
            onOpenPsych={authUserId === 'flavio' && !isReadOnly ? () => setShowPsychPage(true) : undefined}
            onOpenReadings={!isReadOnly ? () => setShowReadings(true) : undefined}
          />
        </Suspense>
      )}
      {STATS_MODALS.includes(modal) && (
        <Suspense fallback={null}><StatsModals /></Suspense>
      )}
      {JOURNAL_MOOD_MODALS.includes(modal) && (
        <Suspense fallback={null}><JournalMoodModals isReadOnly={isReadOnly} /></Suspense>
      )}
      {FITNESS_MODALS.includes(modal) && (
        <Suspense fallback={null}><FitnessModals authUserId={authUserId} /></Suspense>
      )}
      {BODY_MODALS.includes(modal) && (
        <Suspense fallback={null}><BodyModals authUserId={authUserId} /></Suspense>
      )}
      {MENTE_MODALS.includes(modal) && (
        <Suspense fallback={null}><MenteModals authUserId={authUserId} /></Suspense>
      )}
      {TASK_MODALS.includes(modal) && (
        <Suspense fallback={null}><TaskModals authUserId={authUserId} /></Suspense>
      )}
      {authUserId === 'flavio' && !isReadOnly && showPsychPage && (
        <Suspense fallback={null}>
          <PsychSessionsPage onClose={() => setShowPsychPage(false)} />
        </Suspense>
      )}
      {!isReadOnly && showReadings && (
        <Suspense fallback={null}>
          <ReadingsPage onClose={() => setShowReadings(false)} />
        </Suspense>
      )}
      {voiceNoteHabit && (
        <Suspense fallback={null}>
          <HabitDiaryPage habit={voiceNoteHabit} onClose={() => setVoiceNoteHabit(null)} viewDate={viewDate} authUserId={authUserId} />
        </Suspense>
      )}
      <UpdateBanner />
      <AchievementQueue queue={pendingAchievements || []} onClear={() => actions.clearAchievementQueue()} />
      {levelUpInfo && <LevelUpOverlay levelInfo={levelUpInfo} onClose={() => setLevelUpInfo(null)} />}
    </>
  )
}

// ── Helper subcomponents ──────────────────────────────────────────────────────

const MONTHS_IT = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']

function formatBuildTime(raw) {
  if (!raw) return null
  // Expected: "2026-07-15 14:32 UTC"
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (!m) return raw
  return `${parseInt(m[3])} ${MONTHS_IT[parseInt(m[2]) - 1]} ${m[1]}, ${m[4]}:${m[5]}`
}

function BuildInfo() {
  const webTime = formatBuildTime(typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null)
  const androidTime = formatBuildTime(typeof window !== 'undefined' ? window.__ANDROID_BUILD_TIME__ : null)
  const isNative = !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.())

  if (!webTime) return null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 1,
      padding: '3px 8px 4px', marginBottom: 6,
      opacity: 0.55, userSelect: 'text',
    }}>
      <span style={{ fontSize: '0.62em', color: 'var(--text-sec)', fontFamily: 'monospace' }}>
        🌐 web {webTime}
      </span>
      {isNative && androidTime && (
        <span style={{ fontSize: '0.62em', color: 'var(--text-sec)', fontFamily: 'monospace' }}>
          📱 apk {androidTime}
        </span>
      )}
    </div>
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
