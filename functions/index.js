const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onDocumentWritten } = require('firebase-functions/v2/firestore')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const Anthropic = require('@anthropic-ai/sdk')

admin.initializeApp()

const anthropicKey = defineSecret('ANTHROPIC_KEY')
const geminiKey = defineSecret('GEMINI_KEY')
const { GoogleGenerativeAI } = require('@google/generative-ai')
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

// Notifiche/reminder: gestiti dall'app Android nativa (AlarmManager, vedi
// NotificationScheduler.kt) invece che via push FCM — rimossa perché dipendeva
// da server/token/rete al momento dello scatto, meno affidabile delle notifiche
// locali sul dispositivo.

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

    let hasChanges = false
    const updatedTasks = tasks.map(task => {
      if (task.status === 'active' && task.deadline < today) {
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

    // Il punteggio non è più un campo salvato: viene sempre ricalcolato al volo
    // lato client sommando i dailyLogs/tasks, quindi qui basta aggiornare i task
    // (penaltyApplied:true viene già letto dal calcolo dinamico della penalità).
    await flavioRef.update({ tasks: updatedTasks })
    console.log(`[expireTasks] expired ${updatedTasks.filter(t => t.status === 'expired').length - tasks.filter(t => t.status === 'expired').length} tasks`)
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

// ── updateHabitDiaries ────────────────────────────────────────────────────────
exports.updateHabitDiaries = onCall(
  { region: REGION, secrets: [anthropicKey], invoker: 'public' },
  async (request) => {
    authCheck(request)
    const { conversationMessages, habits } = request.data
    if (!conversationMessages || !Array.isArray(conversationMessages) || conversationMessages.length < 2)
      throw new HttpsError('invalid-argument', 'conversationMessages obbligatorio')

    const anthropic = getClient(anthropicKey.value())
    const habitList = (habits || []).map(h => `- ${h.name} (id: ${h.id || h.name.replace(/[^a-zA-Z0-9]/g,'')})`).join('\n')
    const transcript = conversationMessages.map(m => `${m.role === 'user' ? 'Flavio' : 'Coach'}: ${m.content}`).join('\n')

    const prompt = `Analizza questa conversazione tra Flavio e il suo Coach AI e identifica tutte le informazioni rilevanti sulle sue abitudini.

CONVERSAZIONE:
${transcript}

ABITUDINI ESISTENTI:
${habitList}

Per ogni abitudine menzionata nella conversazione, estrai informazioni utili.
Rispondi SOLO con un JSON valido, senza testo aggiuntivo:
{
  "habitUpdates": [
    {
      "habitId": "id_dell_abitudine",
      "habitName": "nome abitudine",
      "narrative": "riassunto narrativo in 2-3 frasi in prima persona",
      "keyPoints": {
        "why": "motivazione emersa o null",
        "whenFails": "quando fallisce o null",
        "coachTips": ["consiglio 1", "consiglio 2"],
        "patterns": "pattern comportamentali o null"
      },
      "rawSummary": "riassunto grezzo della parte di conversazione rilevante"
    }
  ]
}
Se nessuna abitudine specifica è stata discussa, restituisci {"habitUpdates": []}`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].text
    const clean = text.replace(/```json|```/g, '').trim()
    let parsed
    try { parsed = JSON.parse(clean) } catch { parsed = { habitUpdates: [] } }

    return {
      habitUpdates: parsed.habitUpdates || [],
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens
    }
  }
)

// ── geminiChat ────────────────────────────────────────────────────────────────
exports.geminiChat = onCall(
  { region: REGION, secrets: [geminiKey], invoker: 'public' },
  async (request) => {
    if (!request.auth || request.auth.token.email !== ALLOWED_EMAIL)
      throw new HttpsError('permission-denied', 'Non autorizzato')
    const { messages, systemPrompt, model } = request.data
    if (!messages || messages.length === 0)
      throw new HttpsError('invalid-argument', 'messages obbligatorio')

    const selectedModel = model || 'gemini-2.5-flash-lite'
    const genAI = new GoogleGenerativeAI(geminiKey.value())
    const geminiModel = genAI.getGenerativeModel({ model: selectedModel, systemInstruction: systemPrompt || '' })

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
    const chat = geminiModel.startChat({ history })
    const lastMessage = messages[messages.length - 1].content
    const result = await chat.sendMessage(lastMessage)
    const response = await result.response
    const usageMetadata = response.usageMetadata || {}

    const pricingUSD = {
      'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
      'gemini-2.5-flash':      { input: 0.30, output: 2.50 },
      'gemini-2.5-pro':        { input: 1.25, output: 10.00 },
      'gemini-3.5-flash':      { input: 1.50, output: 9.00 },
    }
    const p = pricingUSD[selectedModel] || pricingUSD['gemini-2.5-flash-lite']
    const inputCostUSD  = ((usageMetadata.promptTokenCount || 0) / 1_000_000) * p.input
    const outputCostUSD = ((usageMetadata.candidatesTokenCount || 0) / 1_000_000) * p.output
    const totalCostEUR  = (inputCostUSD + outputCostUSD) * 0.92

    return {
      content: response.text(),
      usage: {
        model: selectedModel,
        inputTokens:  usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens:  usageMetadata.totalTokenCount || 0,
        costEUR: parseFloat(totalCostEUR.toFixed(6))
      }
    }
  }
)

// ── generateDayRecap ────────────────────────────────────────────────────────
// Trascrizione vocale libera (tipicamente lunga, non strutturata) → riepilogo
// a categorie con elenco puntato, per il ricordo di fine giornata (tab
// Mente). Le 6 categorie sotto sono un punto di partenza suggerito, non un
// paletto rigido: se qualcosa non ci rientra bene, il modello crea una nuova
// categoria appropriata invece di ometterla o forzarla in una sbagliata —
// niente va perso. Il modello restituisce label+emoji per ogni categoria
// (comprese quelle nuove), quindi qui non serve più filtrare/mappare contro
// un elenco fisso.
const DAY_RECAP_CATEGORIES = [
  { key: 'allenamento',  label: 'Allenamento',       emoji: '💪' },
  { key: 'alimentazione',label: 'Alimentazione',     emoji: '🍽️' },
  { key: 'mente',        label: 'Mente & Relax',     emoji: '🧘' },
  { key: 'lavoro',       label: 'Lavoro/Produttività', emoji: '💼' },
  { key: 'relazioni',    label: 'Relazioni',         emoji: '❤️' },
  { key: 'altro',        label: 'Altro',             emoji: '✨' },
]

exports.generateDayRecap = onCall(
  { region: REGION, secrets: [geminiKey], invoker: 'public' },
  async (request) => {
    if (!request.auth || request.auth.token.email !== ALLOWED_EMAIL)
      throw new HttpsError('permission-denied', 'Non autorizzato')
    const { transcript } = request.data
    if (!transcript || transcript.trim().length < 10)
      throw new HttpsError('invalid-argument', 'transcript obbligatorio')

    const genAI = new GoogleGenerativeAI(geminiKey.value())
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    const categoryList = DAY_RECAP_CATEGORIES.map(c => `- ${c.key}: ${c.label} ${c.emoji}`).join('\n')

    const prompt = `Sei un assistente che organizza la trascrizione di una nota vocale in cui una persona racconta cosa ha fatto durante la giornata, per aiutarla a ricordarsi a fine giornata di cosa può essere fiera.

TRASCRIZIONE:
"""
${transcript}
"""

Estrai TUTTE le azioni/eventi positivi o rilevanti realmente menzionati (non inventare nulla, non aggiungere consigli o giudizi) — non deve andare perso nulla di rilevante.

Usa queste categorie di partenza quando il contenuto ci rientra bene:
${categoryList}

Se qualcosa non rientra bene in nessuna di queste, NON ometterlo e NON forzarlo in una categoria sbagliata: crea invece una nuova categoria su misura, con una label breve e un'emoji adatta. Ometti solo le categorie (di partenza o nuove) che risultano completamente senza contenuto — non inventare voci per riempirle.

Per ogni categoria con contenuto reale, scrivi una lista di frasi brevi (max 10 parole ciascuna, stile elenco puntato, in seconda/prima persona naturale, es. "Allenamento gambe 45 minuti").

Rispondi SOLO con JSON valido, senza backtick e senza altro testo. Includi sempre "label" ed "emoji" per ogni categoria, comprese quelle dell'elenco di partenza:
{
  "categories": [
    { "key": "allenamento", "label": "Allenamento", "emoji": "💪", "items": ["voce 1", "voce 2"] }
  ]
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const clean = text.replace(/```json\n?|```\n?/g, '').trim()
    let parsed
    try { parsed = JSON.parse(clean) } catch { parsed = { categories: [] } }

    const defaultByKey = Object.fromEntries(DAY_RECAP_CATEGORIES.map(c => [c.key, c]))
    const categories = (parsed.categories || [])
      .filter(c => Array.isArray(c.items) && c.items.length > 0)
      .map(c => {
        const fallback = defaultByKey[c.key]
        return {
          key: c.key || (c.label || 'altro').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          label: c.label || fallback?.label || 'Altro',
          emoji: c.emoji || fallback?.emoji || '✨',
          items: c.items,
        }
      })

    return { categories }
  }
)

// ── estimateFoodProtein ───────────────────────────────────────────────────────
// Dato uno o più nomi di alimenti, stima quanti grammi di proteine ci sono in
// 100g di quell'alimento crudo — usato per popolare in automatico il database
// proteine (tab Nutrizione) quando si aggiunge un alimento mai visto prima.
// Valore modificabile a mano dall'utente in caso di stima imprecisa.
exports.estimateFoodProtein = onCall(
  { region: REGION, secrets: [geminiKey], invoker: 'public' },
  async (request) => {
    if (!request.auth || request.auth.token.email !== ALLOWED_EMAIL)
      throw new HttpsError('permission-denied', 'Non autorizzato')
    const foods = (request.data?.foods || []).map(f => (f || '').trim()).filter(Boolean).slice(0, 20)
    if (foods.length === 0) throw new HttpsError('invalid-argument', 'foods obbligatorio')

    const genAI = new GoogleGenerativeAI(geminiKey.value())
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    const foodList = foods.map((f, i) => `${i + 1}. ${f}`).join('\n')

    const prompt = `Per ciascuno di questi alimenti, indica quanti grammi di proteine ci sono in 100g dell'alimento crudo/non cotto (valori nutrizionali standard, i più comunemente usati):
${foodList}

Rispondi SOLO con JSON valido, senza backtick e senza altro testo, un numero (anche decimale) per alimento, nello stesso ordine:
{ "results": [{ "name": "nome esatto come dato in input", "proteinPer100g": 0 }] }`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const clean = text.replace(/```json\n?|```\n?/g, '').trim()
    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch {
      // A volte il modello aggiunge testo attorno al JSON nonostante le
      // istruzioni — estrae l'oggetto {...} anche in mezzo ad altro testo,
      // invece di arrendersi subito a un risultato vuoto (che dava sempre
      // 0g/100g senza che l'utente capisse perché).
      const match = clean.match(/\{[\s\S]*\}/)
      try { parsed = match ? JSON.parse(match[0]) : { results: [] } } catch { parsed = { results: [] } }
    }
    if (!Array.isArray(parsed.results) || parsed.results.length === 0) {
      console.error('[estimateFoodProtein] Risposta AI non interpretabile:', text)
    }

    const results = foods.map((name, i) => {
      const match = (parsed.results || []).find(r => r.name?.toLowerCase().trim() === name.toLowerCase().trim()) || parsed.results?.[i]
      const val = parseFloat(match?.proteinPer100g)
      return { name, proteinPer100g: isNaN(val) ? 0 : Math.round(val * 10) / 10 }
    })

    return { results }
  }
)

// ── updatePsychProfile ────────────────────────────────────────────────────────
exports.updatePsychProfile = onCall(
  { region: REGION, secrets: [geminiKey], invoker: 'public' },
  async (request) => {
    if (!request.auth || request.auth.token.email !== ALLOWED_EMAIL)
      throw new HttpsError('permission-denied', 'Non autorizzato')
    const { sessionMessages, existingProfile, glpContext } = request.data
    if (!sessionMessages || sessionMessages.length < 2)
      throw new HttpsError('invalid-argument', 'sessionMessages obbligatorio')

    const genAI = new GoogleGenerativeAI(geminiKey.value())
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    const prompt = `Sei uno psicologo analitico. Analizza questa sessione e aggiorna il profilo psicologico di Flavio.

SESSIONE CORRENTE:
${sessionMessages.map(m => `${m.role === 'user' ? 'Flavio' : 'Psicologo'}: ${m.content}`).join('\n')}

PROFILO ESISTENTE:
${JSON.stringify(existingProfile || {}, null, 2)}

DATI GLP:
${JSON.stringify(glpContext || {}, null, 2)}

Rispondi SOLO con JSON valido senza backtick:
{
  "narrative": "riassunto narrativo aggiornato (max 300 parole, terza persona)",
  "coreThemes": ["tema 1", "tema 2"],
  "emotionalPatterns": ["pattern 1"],
  "growthAreas": ["area 1"],
  "strengths": ["forza 1"],
  "recentInsights": ["insight da questa sessione"],
  "sessionSummary": "riassunto breve sessione (max 100 parole)",
  "lastUpdated": "${new Date().toISOString()}"
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const clean = text.replace(/```json|```/g, '').trim()
    let parsed
    try { parsed = JSON.parse(clean) } catch { parsed = { sessionSummary: 'Parsing error', lastUpdated: new Date().toISOString() } }
    return { profile: parsed }
  }
)

// ── generateDailyEntry ────────────────────────────────────────────────────────
exports.generateDailyEntry = onCall(
  { region: REGION, secrets: [geminiKey], invoker: 'public' },
  async (request) => {
    if (!request.auth || request.auth.token.email !== ALLOWED_EMAIL)
      throw new HttpsError('permission-denied', 'Non autorizzato')
    const { sessionMessages, existingEntries, globalSummary, date, existingEntry } = request.data
    if (!sessionMessages || sessionMessages.length < 2)
      throw new HttpsError('invalid-argument', 'sessionMessages obbligatorio')

    const genAI = new GoogleGenerativeAI(geminiKey.value())
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    const recentEntries = Object.entries(existingEntries || {})
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 10)
      .map(([d, e]) => `${d}: ${e.insights || ''}`)
      .join('\n')

    const existingBlock = existingEntry
      ? `\nATTENZIONE: Esiste già un entry per oggi. Integralo con le nuove informazioni invece di sovrascriverlo:\n${JSON.stringify(existingEntry)}`
      : ''

    const prompt = `Sei uno psicologo analitico. Analizza questa sessione e genera l'entry del diario psicologico per oggi (${date}).

SESSIONE DI OGGI:
${sessionMessages.map(m => `${m.role === 'user' ? 'Flavio' : 'Psicologo'}: ${m.content}`).join('\n')}

PROFILO GLOBALE ESISTENTE:
${JSON.stringify(globalSummary || {}, null, 2)}

ENTRY RECENTI (ultimi 10 giorni):
${recentEntries}
${existingBlock}

Genera un entry dettagliato e completo — scrivi quanto serve per catturare tutto ciò che è rilevante per le sessioni future. Non limitare la lunghezza se ci sono contenuti importanti.
Cerca connessioni con entry passati se esistono pattern ricorrenti.

IMPORTANTE: Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza delimitatori markdown. I valori dei campi devono essere STRINGHE DI TESTO PURO, non oggetti o array JSON annidati.

{
  "insights": "testo narrativo dettagliato su cosa è emerso oggi — STRINGA PURA, non JSON",
  "patterns": "pattern comportamentali o emotivi emersi — STRINGA PURA oppure null",
  "openQuestions": "domande aperte da esplorare — STRINGA PURA oppure null",
  "connections": [
    { "date": "YYYY-MM-DD", "note": "descrizione connessione con entry passato" }
  ],
  "globalSummaryUpdate": {
    "narrative": "riassunto globale aggiornato integrando tutti gli entry (max 400 parole)",
    "coreThemes": ["tema 1", "tema 2"],
    "emotionalPatterns": ["pattern 1"],
    "growthAreas": ["area 1"],
    "strengths": ["forza 1"],
    "lastUpdated": "${new Date().toISOString()}"
  }
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const clean = text.replace(/```json\n?|```\n?/g, '').trim()
    let parsed
    try { parsed = JSON.parse(clean) } catch { parsed = { insights: text, connections: [] } }

    // Sanitize: ensure text fields are plain strings, not nested JSON/objects
    function toPlainString(val) {
      if (val === null || val === undefined) return null
      if (typeof val === 'object') return JSON.stringify(val)
      const s = String(val)
      return s.replace(/^```json\n?|^```\n?|```$/g, '').replace(/^["']|["']$/g, '').trim() || null
    }
    parsed.insights = toPlainString(parsed.insights)
    parsed.patterns = toPlainString(parsed.patterns)
    parsed.openQuestions = toPlainString(parsed.openQuestions)

    return { entry: parsed }
  }
)

// ── correctDailyEntry ─────────────────────────────────────────────────────────
exports.correctDailyEntry = onCall(
  { region: REGION, secrets: [geminiKey], invoker: 'public' },
  async (request) => {
    if (!request.auth || request.auth.token.email !== ALLOWED_EMAIL)
      throw new HttpsError('permission-denied', 'Non autorizzato')
    const { entryDate, currentEntry, correction } = request.data
    if (!correction || !currentEntry)
      throw new HttpsError('invalid-argument', 'correction e currentEntry obbligatori')

    const genAI = new GoogleGenerativeAI(geminiKey.value())
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    const prompt = `Sei uno psicologo. L'utente vuole correggere un'informazione nel profilo psicologico.

ENTRY ORIGINALE DEL ${entryDate}:
Insights: ${currentEntry.insights || ''}
Pattern: ${currentEntry.patterns || ''}
Domande aperte: ${currentEntry.openQuestions || ''}

CORREZIONE DELL'UTENTE:
"${correction}"

Elabora la correzione, capisci cosa va cambiato e aggiorna l'entry.

Rispondi SOLO con JSON valido senza backtick:
{
  "updatedInsights": "insights aggiornati con la correzione applicata",
  "updatedPatterns": "pattern aggiornati o null se invariati",
  "updatedOpenQuestions": "domande aperte aggiornate o null se invariate",
  "changesSummary": "Spiegazione chiara e concisa di cosa ho cambiato e perché"
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const clean = text.replace(/```json|```/g, '').trim()
    let parsed
    try { parsed = JSON.parse(clean) } catch { parsed = { updatedInsights: currentEntry.insights, changesSummary: 'Errore nel parsing' } }
    return { correctedEntry: parsed }
  }
)

// ── generateSessionTitle ─────────────────────────────────────────────────────
exports.generateSessionTitle = onCall(
  { region: REGION, secrets: [geminiKey], invoker: 'public' },
  async (request) => {
    if (!request.auth || request.auth.token.email !== ALLOWED_EMAIL)
      throw new HttpsError('permission-denied', 'Non autorizzato')
    const { firstMessages } = request.data
    if (!firstMessages || firstMessages.length === 0)
      throw new HttpsError('invalid-argument', 'firstMessages obbligatorio')

    const genAI = new GoogleGenerativeAI(geminiKey.value())
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    const prompt = `Genera un titolo breve (max 6 parole) per questa sessione di chat psicologica basandoti sui primi messaggi. Il titolo deve catturare il tema principale della conversazione. Rispondi SOLO con il titolo, nessun altro testo, nessuna punteggiatura finale.

PRIMI MESSAGGI:
${firstMessages.slice(0, 4).map(m => `${m.role === 'user' ? 'Flavio' : 'Psicologo'}: ${m.content.slice(0, 200)}`).join('\n')}`

    const result = await model.generateContent(prompt)
    const title = result.response.text().trim().replace(/^["']|["']$/g, '')
    return { title }
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

// ── syncWidgetsOnUserDataChange ─────────────────────────────────────────────
// Trigger Firestore: a ogni scrittura su users/flavio (task completata,
// abitudine spuntata, serie loggata — da telefono, watch o web) manda un push
// FCM "silenzioso" (solo dati, nessuna notifica visibile) ai device registrati
// per svegliare il widget home-screen del telefono e farlo aggiornare subito,
// invece di aspettare il refresh periodico ogni 15 minuti di WorkManager.
exports.syncWidgetsOnUserDataChange = onDocumentWritten(
  { document: 'users/flavio', region: REGION },
  async (event) => {
    const tokensSnap = await admin.firestore()
      .collection('users').doc('flavio').collection('fcmTokens').get()
    if (tokensSnap.empty) return

    const tokens = tokensSnap.docs.map(d => d.id)
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      data: { type: 'widget_sync' },
      android: { priority: 'high' },
    })

    // Pulizia token scaduti/disinstallati (stesso pattern usato in passato per
    // il web push, ora per i token nativi Android)
    const toDelete = []
    response.responses.forEach((r, i) => {
      if (!r.success && (r.error?.code === 'messaging/registration-token-not-registered')) {
        toDelete.push(tokens[i])
      }
    })
    if (toDelete.length > 0) {
      await Promise.all(toDelete.map(t =>
        admin.firestore().collection('users').doc('flavio').collection('fcmTokens').doc(t).delete()
      ))
    }
  }
)

// ── backupUserData ──────────────────────────────────────────────────────────
// Copia giornaliera del documento principale (users/flavio) in una
// sottocollezione separata — aggiunta dopo un incidente in cui un bug lato
// client ha sovrascritto silenziosamente tutti i dati (score, task, log
// allenamenti, storico completo) con un account vuoto, senza alcun backup da
// cui recuperare. Non protegge da un bug che colpisce nello stesso istante
// del backup, ma limita qualunque incidente futuro a "al massimo un giorno
// perso" invece di "tutto lo storico perso per sempre". Retention 60 giorni
// per non far crescere la sottocollezione all'infinito.
exports.backupUserData = onSchedule(
  { schedule: '30 2 * * *', timeZone: 'Europe/Rome', region: REGION },
  async () => {
    const db = admin.firestore()
    const flavioRef = db.collection('users').doc('flavio')
    const snap = await flavioRef.get()
    if (!snap.exists) return

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
    await flavioRef.collection('backups').doc(today).set({
      data: snap.data(),
      backedUpAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Retention: elimina i backup più vecchi di 60 giorni
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)
    const cutoffStr = cutoff.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
    const oldBackups = await flavioRef.collection('backups')
      .where(admin.firestore.FieldPath.documentId(), '<', cutoffStr)
      .get()
    if (!oldBackups.empty) {
      const batch = db.batch()
      oldBackups.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
    }
  }
)
