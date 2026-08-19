// ─── Muscle groups definition ────────────────────────────────────────────────

export const MUSCLE_GROUPS = {
  // FRONT — ogni emoji richiama il gruppo muscolare specifico, non un'icona
  // generica ripetuta: petto=scudo, spalle ant.=triangolo, avambracci=pugno...
  pettorali:    { label: 'Pettorali',     side: 'front', emoji: '🛡️' },
  addominali:   { label: 'Addominali',    side: 'front', emoji: '🔥' },
  spalle_ant:   { label: 'Spalle ant.',   side: 'front', emoji: '🔺' },
  bicipiti:     { label: 'Bicipiti',      side: 'front', emoji: '💪' },
  avambracci:   { label: 'Avambracci',    side: 'front', emoji: '✊' },
  quadricipiti: { label: 'Quadricipiti',  side: 'front', emoji: '🦵' },
  polpacci_ant: { label: 'Polpacci',      side: 'front', emoji: '🦶' },
  // BACK
  dorsali:      { label: 'Dorsali',       side: 'back',  emoji: '🦅' },
  trapezio:     { label: 'Trapezio',      side: 'back',  emoji: '⛰️' },
  spalle_post:  { label: 'Spalle post.',  side: 'back',  emoji: '🔶' },
  tricipiti:    { label: 'Tricipiti',     side: 'back',  emoji: '🦾' },
  glutei:       { label: 'Glutei',        side: 'back',  emoji: '🍑' },
  femorali:     { label: 'Femorali',      side: 'back',  emoji: '🍖' },
  polpacci_post:{ label: 'Polpacci post', side: 'back',  emoji: '🐾' },
  lombari:      { label: 'Lombari',       side: 'back',  emoji: '🌀' },
}

// ─── Default mappings by exercise name keywords ───────────────────────────────

const KEYWORD_RULES = [
  { keys: ['flessioni', 'push up', 'pushup', 'piegamenti', 'pettorali'],
    muscles: { pettorali: 1.0, tricipiti: 0.6, spalle_ant: 0.4 } },
  { keys: ['squat', 'goblet', 'pistol'],
    muscles: { quadricipiti: 1.0, glutei: 0.7, femorali: 0.3 } },
  { keys: ['affondi', 'lunge', 'split squat'],
    muscles: { quadricipiti: 0.9, glutei: 0.8, femorali: 0.4 } },
  { keys: ['pull up', 'pullup', 'trazion', 'chin up', 'lat'],
    muscles: { dorsali: 1.0, bicipiti: 0.7, trapezio: 0.5 } },
  { keys: ['dip', 'tricip'],
    muscles: { tricipiti: 1.0, pettorali: 0.5, spalle_ant: 0.3 } },
  { keys: ['addomin', 'crunch', 'sit up', 'situp', 'leg raise', 'v-up', 'vup'],
    muscles: { addominali: 1.0, lombari: 0.2 } },
  { keys: ['plank', 'tavola'],
    muscles: { addominali: 1.0, lombari: 0.7, spalle_ant: 0.3 } },
  { keys: ['curl', 'bicip'],
    muscles: { bicipiti: 1.0, avambracci: 0.4 } },
  { keys: ['shoulder press', 'military', 'overhead', 'lento avanti'],
    muscles: { spalle_ant: 1.0, spalle_post: 0.5, tricipiti: 0.5, trapezio: 0.3 } },
  { keys: ['stacco', 'deadlift', 'rumeno', 'sumo'],
    muscles: { femorali: 1.0, glutei: 0.9, lombari: 0.8, trapezio: 0.4 } },
  { keys: ['kettlebell', 'swing', 'kb'],
    muscles: { glutei: 1.0, femorali: 0.7, lombari: 0.5, spalle_ant: 0.3, addominali: 0.3 } },
  { keys: ['burpee'],
    muscles: { pettorali: 0.6, quadricipiti: 0.6, glutei: 0.4, addominali: 0.5, tricipiti: 0.3 } },
  { keys: ['mountain climber', 'scalatore'],
    muscles: { addominali: 1.0, quadricipiti: 0.5, spalle_ant: 0.4 } },
  { keys: ['calf', 'polpacci', 'alzate'],
    muscles: { polpacci_post: 1.0, polpacci_ant: 0.6 } },
  { keys: ['hip thrust', 'glutei', 'bridge', 'ponte'],
    muscles: { glutei: 1.0, femorali: 0.5, lombari: 0.3 } },
  { keys: ['femorali', 'hamstring', 'leg curl'],
    muscles: { femorali: 1.0, glutei: 0.4 } },
  { keys: ['remator', 'rowing', 'row', 'dorsal'],
    muscles: { dorsali: 1.0, trapezio: 0.5, bicipiti: 0.4, lombari: 0.3 } },
  { keys: ['pike', 'handstand', 'verticale'],
    muscles: { spalle_ant: 1.0, spalle_post: 0.7, tricipiti: 0.4, trapezio: 0.4 } },
  { keys: ['superman', 'iperestension'],
    muscles: { lombari: 1.0, glutei: 0.5, femorali: 0.3 } },
  { keys: ['ruota', 'wheel', 'ab wheel'],
    muscles: { addominali: 1.0, lombari: 0.5, dorsali: 0.3 } },
]

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getDefaultMuscles(exerciseName) {
  if (!exerciseName) return {}
  const lower = exerciseName.toLowerCase()
  for (const rule of KEYWORD_RULES) {
    if (rule.keys.some(k => lower.includes(k))) return rule.muscles
  }
  return {}
}

export function getMusclesForExercise(exercise) {
  if (exercise?.muscles && Object.keys(exercise.muscles).length > 0) return exercise.muscles
  return getDefaultMuscles(exercise?.name || '')
}

// ─── Volume computation ───────────────────────────────────────────────────────

export function computeMuscleVolumes(exercises, exerciseLog, dateFilter) {
  const raw = {}
  Object.keys(MUSCLE_GROUPS).forEach(k => { raw[k] = 0 })

  const exMap = {}
  ;(exercises || []).forEach(ex => { exMap[ex.id] = ex })

  // Sum reps per exercise in the filtered date range
  const repsByExId = {}
  Object.entries(exerciseLog || {}).forEach(([dateStr, sessions]) => {
    if (!dateFilter(dateStr)) return
    ;(sessions || []).forEach(s => {
      repsByExId[s.exerciseId] = (repsByExId[s.exerciseId] || 0) + s.reps
    })
  })

  // Distribute reps to muscle groups using weight coefficients
  Object.entries(repsByExId).forEach(([exId, totalReps]) => {
    const ex = exMap[exId]
    if (!ex) return
    const muscles = getMusclesForExercise(ex)
    Object.entries(muscles).forEach(([muscle, weight]) => {
      if (raw[muscle] !== undefined) {
        raw[muscle] += totalReps * weight
      }
    })
  })

  // Normalize 0–1 relative to the most-trained muscle
  const maxVol = Math.max(...Object.values(raw), 0.001)
  const normalized = {}
  Object.keys(raw).forEach(k => { normalized[k] = raw[k] / maxVol })

  return { raw, normalized }
}

// ─── Date filters ─────────────────────────────────────────────────────────────

export function makeDateFilter(period) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  if (period === 'today') {
    return (d) => d === todayStr
  }
  if (period === 'week') {
    const cutoff = new Date(today); cutoff.setDate(today.getDate() - 6)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return (d) => d >= cutoffStr
  }
  if (period === 'month') {
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const prefix = `${today.getFullYear()}-${mm}`
    return (d) => d.startsWith(prefix)
  }
  return () => true
}
