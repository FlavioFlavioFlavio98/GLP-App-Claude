/**
 * Restituisce la data locale come stringa "YYYY-MM-DD".
 * Usa i metodi locali (getFullYear/getMonth/getDate) invece di toISOString()
 * che opera in UTC e causa bug nelle ore notturne (es. 00:30 ora italiana
 * risulta ancora il giorno prima in UTC).
 *
 * @param {Date} date - data da convertire (default: ora corrente)
 * @returns {string} es. "2026-06-07"
 */
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
