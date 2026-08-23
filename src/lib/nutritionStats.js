// Tracciamento proteine giornaliere (tab Nutrizione) — obiettivo 2g di
// proteine per kg di peso corporeo, calcolato dal peso più recente noto
// (weightLog, lo stesso usato dal Tracciamento Peso).

// I 9 alimenti forniti dall'utente al lancio della feature — le proteine per
// 100g vengono stimate via AI (estimateFoodProtein) al primo avvio, poi
// l'utente può correggerle a mano se imprecise.
export const SEED_FOODS = [
  { name: 'Petto di pollo', emoji: '🍗' },
  { name: 'Uova', emoji: '🥚' },
  { name: 'Albume', emoji: '🥚' },
  { name: 'Fiocchi di latte', emoji: '🧀' },
  { name: 'Manzo magro', emoji: '🥩' },
  { name: 'Lenticchie', emoji: '🫘' },
  { name: 'Parmigiano', emoji: '🧀' },
  { name: 'Tonno scatola', emoji: '🐟' },
  { name: 'Sardine scatola', emoji: '🐟' },
]

export function slugifyFoodName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Peso "di oggi" secondo l'app: quello registrato per la data richiesta, o in
// mancanza l'ultima misurazione nota prima di quella data (weightLog non ha
// necessariamente una voce per ogni giorno).
export function getCurrentWeight(weightLog, dateStr) {
  if (!weightLog) return null
  if (weightLog[dateStr] !== undefined) return weightLog[dateStr]
  const priorDates = Object.keys(weightLog).filter(d => d <= dateStr).sort()
  if (priorDates.length > 0) return weightLog[priorDates[priorDates.length - 1]]
  const allDates = Object.keys(weightLog).sort()
  return allDates.length > 0 ? weightLog[allDates[0]] : null
}

export function getProteinGoal(weightKg) {
  if (!weightKg) return null
  return Math.round(weightKg * 2)
}

export function getDayProteinTotal(proteinLog, dateStr) {
  const entries = proteinLog?.[dateStr] || []
  return Math.round(entries.reduce((sum, e) => sum + (e.proteinGrams || 0), 0) * 10) / 10
}
