import { useMemo, useState, useCallback } from 'react'
import { computeMuscleVolumes, makeDateFilter, MUSCLE_GROUPS } from '../lib/muscleMapping'

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function lerpColor(t, fromHex, toHex) {
  const a = hexToRgb(fromHex)
  const b = hexToRgb(toHex)
  const r = Math.round(a.r + (b.r - a.r) * t)
  const g = Math.round(a.g + (b.g - a.g) * t)
  const bl = Math.round(a.b + (b.b - a.b) * t)
  return `rgb(${r},${g},${bl})`
}

function getMuscleColor(normalized, themeColor, isLight) {
  const neutral = isLight ? '#d4d4d4' : '#2a2a2a'
  if (!normalized || normalized < 0.02) return neutral
  // Low activity: neutral → warm mid (orange-ish)
  // High activity: mid → theme color
  if (normalized < 0.5) {
    const t = normalized * 2
    return lerpColor(t, neutral, '#e67e22')
  }
  const t = (normalized - 0.5) * 2
  return lerpColor(t, '#e67e22', themeColor)
}

// ─── SVG path data ────────────────────────────────────────────────────────────
// ViewBox: 0 0 100 210 for each body

const BODY_OUTLINE_FRONT = `
  M50,2 m-11,0 a11,11 0 1 0 22,0 a11,11 0 1 0 -22,0
  M45,23 L22,36 L14,48 L10,82 L12,110 L20,110 L20,82 L22,50 L26,38 L44,30 L56,30 L74,38 L78,50 L80,82 L80,110 L88,110 L90,82 L86,48 L78,36 L55,23
  L55,23 L55,30 L56,30 M45,23 L45,30 L44,30
  M26,106 L74,106 L76,168 L56,168 L56,207 L44,207 L44,168 L24,168 Z
`

const BODY_OUTLINE_BACK = `
  M50,2 m-11,0 a11,11 0 1 0 22,0 a11,11 0 1 0 -22,0
  M45,23 L22,36 L14,48 L10,82 L12,110 L20,110 L20,82 L22,50 L26,38 L44,30 L56,30 L74,38 L78,50 L80,82 L80,110 L88,110 L90,82 L86,48 L78,36 L55,23
  L55,23 L55,30 L56,30 M45,23 L45,30 L44,30
  M26,106 L74,106 L76,168 L56,168 L56,207 L44,207 L44,168 L24,168 Z
`

// Each muscle: { path: string or array of strings, label }
const FRONT_MUSCLE_PATHS = {
  spalle_ant: {
    paths: [
      'M18,38 Q10,42 10,56 Q14,62 22,60 L24,40 Z',
      'M82,38 Q90,42 90,56 Q86,62 78,60 L76,40 Z',
    ],
  },
  pettorali: {
    paths: [
      'M24,40 L50,42 L50,64 L36,68 L20,60 L20,46 Z',
      'M76,40 L50,42 L50,64 L64,68 L80,60 L80,46 Z',
    ],
  },
  addominali: {
    paths: ['M36,68 L64,68 L62,104 L38,104 Z'],
  },
  bicipiti: {
    paths: [
      'M10,58 Q6,70 8,82 L18,84 L22,62 Z',
      'M90,58 Q94,70 92,82 L82,84 L78,62 Z',
    ],
  },
  avambracci: {
    paths: [
      'M8,84 Q4,96 6,110 L16,110 L18,86 Z',
      'M92,84 Q96,96 94,110 L84,110 L82,86 Z',
    ],
  },
  quadricipiti: {
    paths: [
      'M24,108 L48,108 L46,164 L22,164 Z',
      'M76,108 L52,108 L54,164 L78,164 Z',
    ],
  },
  polpacci_ant: {
    paths: [
      'M22,166 L44,166 L42,205 L20,205 Z',
      'M78,166 L56,166 L58,205 L80,205 Z',
    ],
  },
}

const BACK_MUSCLE_PATHS = {
  trapezio: {
    paths: ['M24,36 L76,36 L70,56 L50,60 L30,56 Z'],
  },
  spalle_post: {
    paths: [
      'M18,38 Q10,42 10,56 Q14,62 22,60 L24,40 Z',
      'M82,38 Q90,42 90,56 Q86,62 78,60 L76,40 Z',
    ],
  },
  dorsali: {
    paths: [
      'M22,60 Q14,74 16,96 L32,98 L30,62 Z',
      'M78,60 Q86,74 84,96 L68,98 L70,62 Z',
    ],
  },
  tricipiti: {
    paths: [
      'M10,58 Q6,70 8,84 L18,86 L22,60 Z',
      'M90,58 Q94,70 92,84 L82,86 L78,60 Z',
    ],
  },
  lombari: {
    paths: ['M30,98 L70,98 L68,108 L32,108 Z'],
  },
  glutei: {
    paths: [
      'M22,110 L50,110 L48,146 Q36,154 22,144 Z',
      'M78,110 L50,110 L52,146 Q64,154 78,144 Z',
    ],
  },
  femorali: {
    paths: [
      'M22,146 L46,146 L44,164 L20,164 Z',
      'M78,146 L54,146 L56,164 L80,164 Z',
    ],
  },
  polpacci_post: {
    paths: [
      'M20,166 Q22,190 20,205 L42,205 Q44,188 44,166 Z',
      'M80,166 Q78,190 80,205 L58,205 Q56,188 56,166 Z',
    ],
  },
}

// ─── Body SVG component ───────────────────────────────────────────────────────

function BodySVG({ side, normalized, onTap, themeColor, isLight }) {
  const musclePaths = side === 'front' ? FRONT_MUSCLE_PATHS : BACK_MUSCLE_PATHS

  const silFill = isLight ? '#c8c8c8' : '#1e1e1e'
  const silStroke = isLight ? '#aaa' : '#333'

  return (
    <svg
      viewBox="0 0 100 210"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Head */}
      <circle cx="50" cy="13" r="11" fill={silFill} stroke={silStroke} strokeWidth="0.8" />
      {/* Neck */}
      <rect x="45" y="23" width="10" height="8" fill={silFill} />
      {/* Upper body */}
      <path
        d="M26,30 L74,30 L80,38 L82,110 L76,110 L76,168 L56,168 L56,207 L44,207 L44,168 L24,168 L24,110 L18,110 L20,38 Z"
        fill={silFill} stroke={silStroke} strokeWidth="0.8"
      />
      {/* Arms */}
      <path d="M20,38 L10,46 L8,110 L18,110 L20,84 L22,38 Z" fill={silFill} stroke={silStroke} strokeWidth="0.8" />
      <path d="M80,38 L90,46 L92,110 L82,110 L80,84 L78,38 Z" fill={silFill} stroke={silStroke} strokeWidth="0.8" />

      {/* Muscle zones */}
      {Object.entries(musclePaths).map(([key, { paths }]) => {
        const val = normalized[key] || 0
        const fill = getMuscleColor(val, themeColor, isLight)
        const opacity = val < 0.02 ? 0.25 : 0.85
        return paths.map((p, i) => (
          <path
            key={`${key}_${i}`}
            d={p}
            fill={fill}
            fillOpacity={opacity}
            stroke={isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'}
            strokeWidth="0.5"
            style={{ cursor: 'pointer', transition: 'fill 0.3s' }}
            onClick={(e) => {
              const rect = e.currentTarget.closest('svg').getBoundingClientRect()
              onTap({ key, val })
            }}
          />
        ))
      })}
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const PERIOD_OPTS = [
  { id: 'today', label: 'Oggi' },
  { id: 'week',  label: 'Settimana' },
  { id: 'month', label: 'Mese' },
]

export default function MuscleHeatmapBody({ exerciseLog, quickExercises }) {
  const [period, setPeriod] = useState('week')
  const [tooltip, setTooltip] = useState(null) // { key, val }

  // Read theme color and light/dark mode from CSS variable
  const themeColor = (() => {
    if (typeof document !== 'undefined') {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim()
      return c || '#ffca28'
    }
    return '#ffca28'
  })()
  const isLight = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-theme') === 'light'

  const { raw, normalized } = useMemo(() => {
    const filter = makeDateFilter(period)
    return computeMuscleVolumes(quickExercises, exerciseLog, filter)
  }, [period, exerciseLog, quickExercises])

  const handleTap = useCallback((info) => {
    setTooltip(prev => prev?.key === info.key ? null : info)
  }, [])

  const tooltipMuscle = tooltip ? MUSCLE_GROUPS[tooltip.key] : null
  const tooltipReps   = tooltip ? Math.round(raw[tooltip.key] || 0) : 0
  const tooltipPct    = tooltip ? Math.round((normalized[tooltip.key] || 0) * 100) : 0

  const cardBg    = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(30,30,30,0.7)'
  const cardBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'

  const totalReps = Object.values(raw).reduce((a, b) => a + b, 0)
  const topMuscles = Object.entries(raw)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => ({ key: k, reps: Math.round(v), label: MUSCLE_GROUPS[k]?.label || k }))

  return (
    <div style={{
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 16,
      padding: '14px 14px 10px',
      marginBottom: 14,
    }}>
      {/* Title + period selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: '0.78em', fontWeight: 700, color: 'var(--theme-color)', textTransform: 'uppercase', letterSpacing: 1 }}>
          🫀 Muscoli allenati
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIOD_OPTS.map(opt => (
            <button
              key={opt.id}
              onClick={() => { setPeriod(opt.id); setTooltip(null) }}
              style={{
                padding: '3px 9px', borderRadius: 20, fontSize: '0.68em', fontWeight: 700, cursor: 'pointer',
                background: period === opt.id ? 'var(--theme-color)' : 'transparent',
                color: period === opt.id ? '#111' : 'var(--text-sec)',
                border: `1px solid ${period === opt.id ? 'var(--theme-color)' : cardBorder}`,
              }}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Bodies side by side */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ textAlign: 'center', fontSize: '0.6em', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Fronte</div>
          <BodySVG
            side="front"
            normalized={normalized}
            onTap={handleTap}
            themeColor={themeColor}
            isLight={isLight}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ textAlign: 'center', fontSize: '0.6em', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Retro</div>
          <BodySVG
            side="back"
            normalized={normalized}
            onTap={handleTap}
            themeColor={themeColor}
            isLight={isLight}
          />
        </div>
      </div>

      {/* Tooltip / muscle info */}
      {tooltip && tooltipMuscle && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
          border: `1px solid var(--theme-color)`,
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '0.82em', fontWeight: 700, color: 'var(--text)' }}>
            {tooltipMuscle.emoji} {tooltipMuscle.label}
          </span>
          <span style={{ fontSize: '0.75em', color: 'var(--theme-color)', fontWeight: 700 }}>
            {tooltipReps > 0 ? `~${tooltipReps} rep equiv.` : 'Nessun dato'} · {tooltipPct}%
          </span>
        </div>
      )}

      {/* Top 3 muscles summary */}
      {topMuscles.length > 0 ? (
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {topMuscles.map(({ key, reps, label }, i) => (
            <div key={key} style={{
              fontSize: '0.65em', fontWeight: 700,
              padding: '3px 8px', borderRadius: 12,
              background: i === 0 ? 'var(--theme-glow)' : 'transparent',
              border: `1px solid ${i === 0 ? 'var(--theme-color)' : cardBorder}`,
              color: i === 0 ? 'var(--theme-color)' : 'var(--text-sec)',
            }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {label}: {reps}r
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 8, fontSize: '0.72em', color: 'var(--text-sec)', textAlign: 'center' }}>
          Nessun allenamento nel periodo — registra una sessione!
        </div>
      )}
    </div>
  )
}
