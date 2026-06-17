const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const Anthropic = require('@anthropic-ai/sdk')

admin.initializeApp()

const anthropicKey = defineSecret('ANTHROPIC_KEY')
const ALLOWED_EMAIL = 'flavio.rossi94@gmail.com'
const REGION = 'europe-west1'

function getClient(key) {
  return new Anthropic.default({ apiKey: key.trim() })
}

function authCheck(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login richiesto')
  if (request.auth.token.email !== ALLOWED_EMAIL) throw new HttpsError('permission-denied', 'Non autorizzato')
}

// ── coachChat ────────────────────────────────────────────────────────────────
exports.coachChat = onCall(
  { region: REGION, secrets: [anthropicKey], invoker: 'public' },
  async (request) => {
    authCheck(request)
    const { messages, systemPrompt } = request.data
    if (!messages || !Array.isArray(messages) || messages.length === 0)
      throw new HttpsError('invalid-argument', 'messages è obbligatorio')

    const anthropic = getClient(anthropicKey.value())
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt || 'Sei il coach personale di Flavio.',
      messages,
    })
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    // Prezzi claude-haiku-4-5: $1/1M input, $5/1M output
    const costUSD = (inputTokens / 1000000) * 1 + (outputTokens / 1000000) * 5
    return {
      content: response.content[0].text,
      usage: {
        model: 'claude-haiku-4-5',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUSD: parseFloat(costUSD.toFixed(6))
      }
    }
  }
)

// ── coachWeeklyReport ────────────────────────────────────────────────────────
exports.coachWeeklyReport = onCall(
  { region: REGION, secrets: [anthropicKey], invoker: 'public' },
  async (request) => {
    authCheck(request)
    const { coachContext, systemPrompt } = request.data
    if (!coachContext) throw new HttpsError('invalid-argument', 'coachContext è obbligatorio')

    const anthropic = getClient(anthropicKey.value())
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt || 'Sei il coach personale di Flavio.',
      messages: [{
        role: 'user',
        content: `Analizza questi dati e genera il report settimanale:\n${JSON.stringify(coachContext, null, 2)}`,
      }],
    })
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const costUSD = (inputTokens / 1000000) * 1 + (outputTokens / 1000000) * 5
    return {
      content: response.content[0].text,
      usage: {
        model: 'claude-haiku-4-5',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUSD: parseFloat(costUSD.toFixed(6))
      }
    }
  }
)

// ── summarizeConversation ─────────────────────────────────────────────────────
exports.summarizeConversation = onCall(
  { region: REGION, secrets: [anthropicKey], invoker: 'public' },
  async (request) => {
    authCheck(request)
    const { messages } = request.data
    if (!messages || messages.length === 0) throw new HttpsError('invalid-argument', 'messages obbligatorio')

    const anthropic = getClient(anthropicKey.value())
    const transcript = messages.map(m => `${m.role === 'user' ? 'Flavio' : 'Coach'}: ${m.content}`).join('\n')

    const [summaryRes, toneRes] = await Promise.all([
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: 'Sei un assistente che riassume conversazioni in modo conciso.',
        messages: [{
          role: 'user',
          content: `Riassumi questa conversazione in 2-3 frasi concise, evidenziando: 1) cosa ha chiesto Flavio, 2) i problemi/pattern identificati, 3) i consigli dati. Max 150 parole.\n\n${transcript}`,
        }],
      }),
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        system: 'Analizza il tono emotivo del messaggio utente.',
        messages: [{
          role: 'user',
          content: `Analizza il tono delle domande di Flavio in questa conversazione e rispondi SOLO con un JSON: {"tone":"positivo"|"neutro"|"preoccupato"|"frustrato"|"motivato","toneScore":1-5}\n\n${transcript}`,
        }],
      }),
    ])

    const summary = summaryRes.content[0].text
    let tone = 'neutro', toneScore = 3
    try {
      const raw = toneRes.content[0].text
      const match = raw.match(/\{.*\}/s)
      if (match) {
        const parsed = JSON.parse(match[0])
        tone = parsed.tone || 'neutro'
        toneScore = Math.min(5, Math.max(1, parseInt(parsed.toneScore) || 3))
      }
    } catch { /* usa defaults */ }

    // Aggregate usage from both calls
    const inputTokens = summaryRes.usage.input_tokens + toneRes.usage.input_tokens
    const outputTokens = summaryRes.usage.output_tokens + toneRes.usage.output_tokens
    const costUSD = (inputTokens / 1000000) * 1 + (outputTokens / 1000000) * 5

    return {
      summary,
      tone,
      toneScore,
      usage: {
        model: 'claude-haiku-4-5',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUSD: parseFloat(costUSD.toFixed(6))
      }
    }
  }
)

// ── Push notifications helper ────────────────────────────────────────────────
async function sendPushToFlavio(title, body) {
  try {
    const { getMessaging } = require('firebase-admin/messaging')
    const flavioSnap = await admin.firestore().collection('users').doc('flavio').get()
    const token = flavioSnap.data()?.fcmToken
    if (!token) { console.log('[push] no FCM token'); return }
    await getMessaging().send({
      token,
      notification: { title, body },
      webpush: { fcmOptions: { link: 'https://flavioflavioflavio98.github.io/GLP-App-Claude/' } },
    })
    console.log('[push] sent:', title)
  } catch (e) {
    console.error('[push] error:', e.message)
  }
}

exports.notifyMorningCheckIn = onSchedule(
  { schedule: '30 7 * * *', timeZone: 'Europe/Rome', region: REGION },
  async () => { await sendPushToFlavio('🌅 Check-in mattino', 'Inizia bene la giornata! +1pt ti aspetta.') }
)

exports.notifyMiddayCheckIn = onSchedule(
  { schedule: '30 12 * * *', timeZone: 'Europe/Rome', region: REGION },
  async () => { await sendPushToFlavio('☀️ Check-in mezzogiorno', 'Come sta andando? +1pt per aggiornarsi.') }
)

exports.notifyEveningCheckIn = onSchedule(
  { schedule: '0 20 * * *', timeZone: 'Europe/Rome', region: REGION },
  async () => { await sendPushToFlavio('🌙 Check-in serale', 'Momento di riflettere sulla giornata. +1pt') }
)

exports.notifyHabitsReminder = onSchedule(
  { schedule: '0 21 * * *', timeZone: 'Europe/Rome', region: REGION },
  async () => { await sendPushToFlavio('💪 Abitudini', 'Hai ancora abitudini da completare oggi?') }
)

// ── expireTasks ───────────────────────────────────────────────────────────────
exports.expireTasks = onSchedule(
  { schedule: '1 0 * * *', timeZone: 'Europe/Rome', region: REGION },
  async () => {
    const db = admin.firestore()
    const flavioRef = db.collection('users').doc('flavio')
    const flavioSnap = await flavioRef.get()
    if (!flavioSnap.exists) return

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
    const tasks = flavioSnap.data()?.tasks || []

    let scoreDeduction = 0
    let hasChanges = false
    const updatedTasks = tasks.map(task => {
      if (task.status === 'active' && task.deadline < today) {
        scoreDeduction += (task.penalty || 0)
        hasChanges = true
        return {
          ...task,
          status: 'expired',
          expiredAt: new Date().toISOString(),
          penaltyApplied: true,
        }
      }
      return task
    })

    if (!hasChanges) return

    const update = { tasks: updatedTasks }
    if (scoreDeduction > 0) {
      update.score = admin.firestore.FieldValue.increment(-scoreDeduction)
    }
    await flavioRef.update(update)
    console.log(`[expireTasks] expired ${updatedTasks.filter(t => t.status === 'expired').length - tasks.filter(t => t.status === 'expired').length} tasks, deducted ${scoreDeduction} points`)
  }
)

// ── cleanupTranscription ──────────────────────────────────────────────────────
exports.cleanupTranscription = onCall(
  { region: REGION, secrets: [anthropicKey], invoker: 'public' },
  async (request) => {
    authCheck(request)
    const { rawText } = request.data
    if (!rawText) throw new HttpsError('invalid-argument', 'rawText richiesto')

    const anthropic = getClient(anthropicKey.value())
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: 'Sei un assistente che corregge e formatta trascrizioni vocali in italiano. Correggi errori grammaticali, punteggiatura mancante, e rendi il testo leggibile. Non aggiungere nulla, non rimuovere il contenuto. Restituisci SOLO il testo corretto, niente altro.',
      messages: [{ role: 'user', content: `Correggi questa trascrizione:\n${rawText}` }]
    })

    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    // Haiku: $1/1M input, $5/1M output → converti in EUR (tasso fisso 0.92)
    const costUSD = (inputTokens / 1_000_000) * 1 + (outputTokens / 1_000_000) * 5
    const costEUR = parseFloat((costUSD * 0.92).toFixed(6))

    return {
      text: response.content[0].text,
      costEUR,
      inputTokens,
      outputTokens
    }
  }
)

// ── generateDailyInsight ──────────────────────────────────────────────────────
exports.generateDailyInsight = onCall(
  { region: REGION, secrets: [anthropicKey], invoker: 'public' },
  async (request) => {
    authCheck(request)
    const { coachContext, systemPrompt } = request.data
    if (!coachContext) throw new HttpsError('invalid-argument', 'coachContext obbligatorio')

    const anthropic = getClient(anthropicKey.value())
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: systemPrompt || 'Sei il coach personale di Flavio.',
      messages: [{
        role: 'user',
        content: `Analizza i dati di Flavio e genera UN SOLO insight proattivo breve (max 2 frasi) che sia:
1) Basato su un pattern reale nei dati degli ultimi 7 giorni
2) Azionabile — suggerisce qualcosa di concreto da fare oggi
3) Specifico — cita dati reali (nomi abitudini, percentuali, ecc.)
4) Diretto — niente intro, vai subito al punto

Rispondi SOLO con l'insight, niente altro.`,
      }],
    })
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const costUSD = (inputTokens / 1000000) * 1 + (outputTokens / 1000000) * 5
    return {
      content: response.content[0].text,
      usage: {
        model: 'claude-haiku-4-5',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUSD: parseFloat(costUSD.toFixed(6))
      }
    }
  }
)
