import { useApp } from '../lib/store'
import { ACHIEVEMENT_DEFS, ACHIEVEMENT_CATS, getAchievementProgress, computeCurrentStreak } from '../lib/achievementLogic'

export default function AchievementsModal() {
  const { state, actions } = useApp()
  const { modal, globalData, currentUser } = state
  if (modal !== 'achievements') return null

  const unlockedMap = {}
  ;(globalData?.achievements || []).forEach(a => { if (a.unlockedAt) unlockedMap[a.id] = a })

  const extra = { currentStreak: computeCurrentStreak(globalData) }
  const total = ACHIEVEMENT_DEFS.length
  const unlockedCount = Object.keys(unlockedMap).length

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.15em', color: 'var(--theme-color)', flex: 1 }}>🏆 Trofei</h1>
        <div style={{ fontSize: '0.82em', color: '#666', background: 'rgba(255,255,255,0.06)', padding: '5px 12px', borderRadius: 20 }}>
          {unlockedCount}/{total}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 16px 16px', background: 'var(--card)' }}>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--theme-color)', width: `${Math.round(unlockedCount / total * 100)}%`, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ fontSize: '0.68em', color: '#555', marginTop: 4 }}>
          {Math.round(unlockedCount / total * 100)}% completato
        </div>
      </div>

      <div className="single-habit-body">
        {Object.keys(ACHIEVEMENT_CATS).map(catId => {
          const defs = ACHIEVEMENT_DEFS.filter(d => d.cat === catId)
          return (
            <div key={catId} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: '0.68em', color: '#555', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 12 }}>
                {ACHIEVEMENT_CATS[catId]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {defs.map(def => {
                  const unlocked = unlockedMap[def.id]
                  const prog = unlocked ? null : getAchievementProgress(def, globalData, extra)

                  return (
                    <div key={def.id} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      background: unlocked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${unlocked ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 14, padding: '12px 14px',
                      transition: 'all 0.2s',
                    }}>
                      <div style={{
                        fontSize: '2em', flexShrink: 0,
                        filter: unlocked ? 'none' : 'grayscale(1) opacity(0.3)',
                      }}>
                        {def.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: unlocked ? 'var(--text)' : '#555', fontSize: '0.92em' }}>
                          {def.name}
                        </div>
                        <div style={{ fontSize: '0.72em', color: '#555', marginTop: 1 }}>{def.desc}</div>

                        {/* Progress bar for locked achievements */}
                        {!unlocked && prog && (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 2 }}>
                              <div style={{
                                height: '100%', borderRadius: 2,
                                background: 'var(--theme-color)',
                                width: `${Math.min(100, Math.round(prog.current / prog.target * 100))}%`,
                              }} />
                            </div>
                            <div style={{ fontSize: '0.65em', color: '#444' }}>
                              {prog.current} / {prog.target}
                            </div>
                          </div>
                        )}

                        {/* Unlock date for unlocked */}
                        {unlocked && (
                          <div style={{ fontSize: '0.68em', color: 'var(--theme-color)', marginTop: 3 }}>
                            🗓 {new Date(unlocked.unlockedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>

                      {unlocked && (
                        <div style={{ color: 'var(--theme-color)', flexShrink: 0 }}>
                          <span className="material-icons-round" style={{ fontSize: 20 }}>verified</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
