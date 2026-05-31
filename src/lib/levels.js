export const LEVELS = [
  { level: 1,  name: 'Principiante', min: 0,     max: 999 },
  { level: 2,  name: 'Apprendista',  min: 1000,  max: 2499 },
  { level: 3,  name: 'Praticante',   min: 2500,  max: 4999 },
  { level: 4,  name: 'Esperto',      min: 5000,  max: 8999 },
  { level: 5,  name: 'Veterano',     min: 9000,  max: 14999 },
  { level: 6,  name: 'Maestro',      min: 15000, max: 24999 },
  { level: 7,  name: 'Campione',     min: 25000, max: 39999 },
  { level: 8,  name: 'Leggenda',     min: 40000, max: 59999 },
  { level: 9,  name: 'Mito',         min: 60000, max: 84999 },
  { level: 10, name: 'Immortale',    min: 85000, max: Infinity },
]

export function getLevel(score) {
  const xp = Math.max(0, score ?? 0)
  const lvl = [...LEVELS].reverse().find(l => xp >= l.min) || LEVELS[0]
  const nextLvl = LEVELS.find(l => l.level === lvl.level + 1)
  const rangeSize = nextLvl ? nextLvl.min - lvl.min : 1
  const progress = nextLvl
    ? Math.min(100, ((xp - lvl.min) / rangeSize) * 100)
    : 100
  return {
    level: lvl.level,
    name: lvl.name,
    xp,
    nextMin: nextLvl?.min ?? null,
    nextName: nextLvl?.name ?? null,
    progress,
    xpToNext: nextLvl ? nextLvl.min - xp : 0,
  }
}
