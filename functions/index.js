const { onCall, HttpsError } = require('firebase-functions/v2/https')
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
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: systemPrompt || 'Sei il coach personale di Flavio.',
      messages,
    })
    return { content: response.content[0].text }
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
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: systemPrompt || 'Sei il coach personale di Flavio.',
      messages: [{
        role: 'user',
        content: `Analizza questi dati e genera il report settimanale:\n${JSON.stringify(coachContext, null, 2)}`,
      }],
    })
    return { content: response.content[0].text }
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
        model: 'claude-opus-4-5',
        max_tokens: 200,
        system: 'Sei un assistente che riassume conversazioni in modo conciso.',
        messages: [{
          role: 'user',
          content: `Riassumi questa conversazione in 2-3 frasi concise, evidenziando: 1) cosa ha chiesto Flavio, 2) i problemi/pattern identificati, 3) i consigli dati. Max 150 parole.\n\n${transcript}`,
        }],
      }),
      anthropic.messages.create({
        model: 'claude-opus-4-5',
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

    return { summary, tone, toneScore }
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
      model: 'claude-opus-4-5',
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
    return { content: response.content[0].text }
  }
)
