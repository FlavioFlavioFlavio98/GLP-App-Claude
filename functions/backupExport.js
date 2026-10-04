// Logica pura del backup via email: serializzazione e ripristino dei documenti
// utente. I Timestamp di Firestore diventano { __timestamp: ISO } così il file è
// JSON puro e il ripristino può ricreare il tipo originale.

function isTimestampLike(v) {
  return v && typeof v === 'object' && typeof v.toDate === 'function' && typeof v.seconds === 'number'
}

function serialize(value) {
  if (value === null || value === undefined) return value ?? null
  if (isTimestampLike(value)) return { __timestamp: value.toDate().toISOString() }
  if (Array.isArray(value)) return value.map(serialize)
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v)
    return out
  }
  return value
}

// docs: { flavio: <dati|null>, simona: <dati|null> }
function buildBackupFile(docs, now = new Date()) {
  const users = {}
  for (const [id, data] of Object.entries(docs)) users[id] = data ? serialize(data) : null
  const payload = { app: 'GLP', format: 1, exportedAt: now.toISOString(), users }
  const json = JSON.stringify(payload)
  return {
    json,
    bytes: Buffer.byteLength(json),
    base64: Buffer.from(json, 'utf8').toString('base64'),
    summary: Object.fromEntries(Object.entries(users).map(([id, d]) => [id, d ? Object.keys(d).length : 0])),
  }
}

// Inverso di serialize: ricrea i Timestamp tramite la factory passata
// (admin.firestore.Timestamp.fromDate nello script di ripristino).
function deserialize(value, toTimestamp) {
  if (Array.isArray(value)) return value.map(v => deserialize(v, toTimestamp))
  if (value && typeof value === 'object') {
    if (typeof value.__timestamp === 'string' && Object.keys(value).length === 1) return toTimestamp(new Date(value.__timestamp))
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = deserialize(v, toTimestamp)
    return out
  }
  return value
}

module.exports = { serialize, buildBackupFile, deserialize }
