package com.flavio.glp

import java.text.SimpleDateFormat
import java.util.*

// Estrae una scadenza da una frase dettata a voce ("fare la spesa domani",
// "chiamare il dentista tra 3 giorni") e restituisce il titolo ripulito dalla
// frase temporale insieme alla data risolta — usato da VoiceAddTaskActivity
// per proporre subito la task con la data già impostata, da confermare.
object VoiceDateParser {
    private val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    private val displaySdf = SimpleDateFormat("d MMMM", Locale.ITALIAN)

    private val numberWords = mapOf(
        "un" to 1, "uno" to 1, "una" to 1,
        "due" to 2, "tre" to 3, "quattro" to 4, "cinque" to 5,
        "sei" to 6, "sette" to 7, "otto" to 8, "nove" to 9, "dieci" to 10,
        "undici" to 11, "dodici" to 12, "tredici" to 13, "quattordici" to 14
    )

    private val weekdays = mapOf(
        "domenica" to Calendar.SUNDAY,
        "lunedi" to Calendar.MONDAY, "lunedì" to Calendar.MONDAY,
        "martedi" to Calendar.TUESDAY, "martedì" to Calendar.TUESDAY,
        "mercoledi" to Calendar.WEDNESDAY, "mercoledì" to Calendar.WEDNESDAY,
        "giovedi" to Calendar.THURSDAY, "giovedì" to Calendar.THURSDAY,
        "venerdi" to Calendar.FRIDAY, "venerdì" to Calendar.FRIDAY,
        "sabato" to Calendar.SATURDAY
    )

    // deadline == null significa "nessuna frase di data riconosciuta" — il
    // chiamante decide il fallback (es. la data selezionata nel widget),
    // invece di questa classe deciderlo per lui. title può essere vuoto se
    // la frase dettata era solo una data ("domani") senza nient'altro: il
    // chiamante deve trattarlo come "non ho capito", non come titolo valido.
    data class Result(val title: String, val deadline: String?)

    // Ordine importante: "dopodomani" va controllato prima di "domani" nel
    // caso venga dettato con uno spazio ("dopo domani") — la frase scadenza
    // va rimossa dal titolo appena trovata, quindi al massimo una sola
    // espressione di data viene riconosciuta per task. Costruita una sola
    // volta (non ad ogni parse()): nessuna delle regex/lambda cattura stato
    // per chiamata, ricompilarle ogni volta sarebbe lavoro sprecato.
    private val patterns = listOf<Pair<Regex, (MatchResult) -> String>>(
        Regex("(?i)\\bdopo\\s*domani\\b") to { _ -> addDays(2) },
        Regex("(?i)\\bdomani\\b") to { _ -> addDays(1) },
        Regex("(?i)\\boggi\\b") to { _ -> addDays(0) },
        Regex("(?i)\\b(?:tra|fra)\\s+(un|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|\\d+)\\s+settiman[ae]\\b") to { m ->
            addDays(wordToNumber(m.groupValues[1]) * 7)
        },
        Regex("(?i)\\b(?:tra|fra)\\s+(un|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|\\d+)\\s+giorn[oi]\\b") to { m ->
            addDays(wordToNumber(m.groupValues[1]))
        },
        Regex("(?i)\\b(lunedi|lunedì|martedi|martedì|mercoledi|mercoledì|giovedi|giovedì|venerdi|venerdì|sabato|domenica)\\b") to { m ->
            nextWeekday(weekdays[m.groupValues[1].lowercase()]!!)
        }
    )

    fun parse(rawText: String): Result {
        var text = rawText.trim()
        var deadline: String? = null

        for ((regex, resolve) in patterns) {
            val match = regex.find(text)
            if (match != null) {
                deadline = resolve(match)
                text = (text.substring(0, match.range.first) + text.substring(match.range.last + 1)).trim()
                break
            }
        }

        // Pulizia: spazi doppi e punteggiatura orfana lasciata dalla frase rimossa.
        text = text.replace(Regex("\\s{2,}"), " ").replace(Regex("\\s+([,.;])"), "$1").trim(' ', ',', '.', ';')
        if (text.isNotEmpty()) text = text.replaceFirstChar { it.uppercase() }

        return Result(title = text, deadline = deadline)
    }

    // Per il dialog di conferma: "oggi"/"domani"/"dopodomani" restano parole,
    // qualunque altra data usa il formato esteso italiano ("5 dicembre").
    fun formatDisplay(deadline: String): String {
        val today = sdf.format(Date())
        val tomorrow = addDays(1)
        val dayAfter = addDays(2)
        return when (deadline) {
            today -> "oggi"
            tomorrow -> "domani"
            dayAfter -> "dopodomani"
            else -> try { displaySdf.format(sdf.parse(deadline)!!) } catch (e: Exception) { deadline }
        }
    }

    private fun wordToNumber(s: String): Int = s.toIntOrNull() ?: numberWords[s.lowercase()] ?: 1

    private fun addDays(n: Int): String {
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_YEAR, n)
        return sdf.format(cal.time)
    }

    // Il prossimo giorno con quel nome, sempre nel futuro (mai oggi stesso):
    // dettare "lunedì" di lunedì intende quasi certamente il lunedì prossimo.
    private fun nextWeekday(target: Int): String {
        val cal = Calendar.getInstance()
        do {
            cal.add(Calendar.DAY_OF_YEAR, 1)
        } while (cal.get(Calendar.DAY_OF_WEEK) != target)
        return sdf.format(cal.time)
    }
}
