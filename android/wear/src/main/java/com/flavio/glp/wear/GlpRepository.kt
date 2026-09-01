package com.flavio.glp.wear

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.util.Date
import java.util.Locale
import java.util.TimeZone

// Stesso schema dati della web app / widget Android (users/flavio: campi
// "tasks" e "quickExercises"/"exerciseLog") — nessuna duplicazione di schema,
// solo lettura/scrittura diretta su Firestore come fanno già i widget nativi.

data class WearTask(
    val id: String,
    val title: String,
    val priority: String,
    val reward: Int,
    val deadline: String,
)

data class WearExercise(
    val id: String,
    val name: String,
    val emoji: String,
    val pointsPerRep: Double,
)

data class WearHabit(
    val id: String,
    val name: String,
    val emoji: String,
    val done: Boolean,
)

data class WearFood(
    val id: String,
    val name: String,
    val emoji: String,
    val proteinPer100g: Double,
)

// Moltiplicatori identici a MEAL_LEVELS in mealStats.js — il watch non ha
// (e non gli serve) l'editor del tasso pt/min della web app, usa sempre il
// default: uno scostamento minimo e accettabile per una schermata pensata
// per essere veloce, non per la messa a punto fine dei punteggi.
private val MEAL_LEVEL_MULTIPLIERS = mapOf(1 to 0.3, 2 to 0.7, 3 to 1.2)
private const val DEFAULT_MEAL_RATE = 0.3

fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

private fun asDouble(v: Any?): Double = when (v) {
    is Double -> v
    is Long -> v.toDouble()
    is Int -> v.toDouble()
    is String -> v.toDoubleOrNull() ?: 0.0
    else -> 0.0
}

// Porta su Kotlin di calcNumericPoints() di habitLogic.js — usata solo dal
// calcolo punti (computeTodayNet), il watch non ha una schermata per
// registrare valori numerici, ma deve comunque contarli nel totale se sono
// stati registrati da telefono/web nella stessa giornata.
@Suppress("UNCHECKED_CAST")
private fun calcNumericPoints(value: Double, config: Map<String, Any>): Double {
    val threshold = asDouble(config["threshold"])
    val unitSize = asDouble(config["unitSize"]).let { if (it == 0.0) 1.0 else it }
    val ppu = asDouble(config["pointsPerUnit"])
    if (value < threshold) {
        return when (config["belowThreshold"] as? String) {
            "fixed" -> -asDouble(config["penaltyFixed"])
            "proportional" -> {
                // Arrotonda la grandezza positiva e SOLO DOPO nega — negare
                // prima di arrotondare (Math.round(-2.5) = -2 in Kotlin/Java,
                // arrotonda verso l'alto sui negativi) divergeva dalla JS
                // (Math.round(2.5) = 3, poi negato = -3) proprio sui mezzi
                // punti, lo stesso disallineamento watch/web che questa
                // funzione esiste per evitare.
                val deficit = threshold - value
                -(Math.round((deficit / unitSize) * ppu * 10) / 10.0)
            }
            else -> 0.0 // "zero" o non impostato
        }
    }
    var pts = (value / unitSize) * ppu
    val cap = config["cap"]
    if (cap != null) {
        val capVal = asDouble(cap)
        if (pts > capVal) pts = capVal
    }
    return Math.round(pts * 10) / 10.0
}

private fun priorityRank(p: String): Int = when (p) {
    "high" -> 0
    "low" -> 2
    else -> 1
}

private fun stableHabitId(h: Map<String, Any>): String =
    h["id"] as? String ?: (h["name"] as? String ?: "").replace(Regex("[^a-zA-Z0-9]"), "")

private fun daysBetween(fromStr: String, toStr: String): Long = try {
    ChronoUnit.DAYS.between(LocalDate.parse(fromStr), LocalDate.parse(toStr))
} catch (e: Exception) { 0L }

// Data (yyyy-MM-dd) nel fuso Europe/Rome di un timestamp ISO — stessa
// conversione di habitLogic.js (expiredTaskCost) per capire a quale giorno
// "conta" una scadenza vicino alla mezzanotte.
private fun isoToRomeDate(iso: String): String? = try {
    Instant.parse(iso).atZone(ZoneId.of("Europe/Rome")).toLocalDate().toString()
} catch (e: Exception) { null }

// Porta su Kotlin isHabitVisible() di habitLogic.js (versione semplificata:
// niente abitudini "singole a data fissa" — già escluse a monte — né date di
// creazione). Serve sia per decidere cosa mostrare in lista sia per calcolare
// i punti di oggi, così le due cose restano coerenti fra loro.
private fun isHabitVisibleToday(h: Map<String, Any>, todayStr: String, doneIds: List<String>, failedIds: List<String>): Boolean {
    val archivedAt = h["archivedAt"] as? String
    if (archivedAt != null && todayStr >= archivedAt) return false
    val id = stableHabitId(h)
    val isDone = doneIds.contains(id)
    val isFailed = failedIds.contains(id)
    val freq = asDouble(h["frequency"]).toInt().let { if (it <= 0) 1 else it }
    if (h["type"] != "if" && freq > 1) {
        if (isDone || isFailed) return true
        val lastDone = h["lastDone"] as? String
        if (lastDone != null) {
            val diff = daysBetween(lastDone, todayStr)
            if (diff < freq && diff >= 0) return false
        }
    }
    return true
}

@Suppress("UNCHECKED_CAST")
private fun todayDoneAndFailed(doc: DocumentSnapshot, todayStr: String): Pair<List<String>, List<String>> {
    val dailyLogs = doc.get("dailyLogs") as? Map<String, Any> ?: emptyMap()
    val raw = dailyLogs[todayStr]
    // Formato legacy: la voce del giorno era un array semplice di id abitudine
    // invece di un oggetto {habits, failedHabits, ...} — habitLogic.js's
    // parseEntry() gestisce ancora entrambi, lo stesso qui per sicurezza anche
    // se sul watch "oggi" è quasi sempre nel formato nuovo.
    return when (raw) {
        is List<*> -> Pair(raw.filterIsInstance<String>(), emptyList())
        is Map<*, *> -> Pair(
            (raw["habits"] as? List<String>) ?: emptyList(),
            (raw["failedHabits"] as? List<String>) ?: emptyList(),
        )
        else -> Pair(emptyList(), emptyList())
    }
}

// Punti "Netto" di oggi — porta su Kotlin computeDayNet() di habitLogic.js.
// Aggiunto dopo che è emerso che il campo Firestore "score" non viene più
// scritto da nessun'altra parte dell'app dal refactor che l'ha reso
// puramente calcolato lato client (vedi CLAUDE.md) — il watch lo leggeva
// comunque, mostrando un numero permanentemente disallineato da telefono/web.
// Include anche habitLevels (min/max), abitudini numeriche e spese
// (acquisti/tracked rewards): il watch non ha schermate per queste azioni,
// ma se vengono fatte da telefono/web nella stessa giornata il "punti oggi"
// del watch deve comunque rifletterle correttamente — altrimenti si
// ripresenta esattamente il disallineamento che questa funzione esiste per
// evitare, solo per altri campi invece del vecchio "score" morto.
@Suppress("UNCHECKED_CAST")
private fun computeTodayNet(doc: DocumentSnapshot): Double {
    val todayStr = today()
    val (doneIds, failedIds) = todayDoneAndFailed(doc, todayStr)

    val todayEntryMap = (doc.get("dailyLogs") as? Map<String, Any>)?.get(todayStr) as? Map<String, Any>
    val habitLevels = todayEntryMap?.get("habitLevels") as? Map<String, Any> ?: emptyMap()
    val habitValues = todayEntryMap?.get("habitValues") as? Map<String, Any> ?: emptyMap()

    val habits = doc.get("habits") as? List<Map<String, Any>> ?: emptyList()
    var dailyEarned = 0.0
    var penaltyCost = 0.0
    habits.forEach { h ->
        // Solo "goal" è escluso qui, esattamente come computeDayNet() in
        // habitLogic.js (if (h.type === 'goal') return) — escludere anche
        // "single" (come faceva prima) toglieva dal punteggio del watch la
        // ricompensa di un'abitudine singola a data fissa completata da
        // telefono/web, un disallineamento silenzioso con la web app.
        if (h["type"] == "goal") return@forEach
        if (!isHabitVisibleToday(h, todayStr, doneIds, failedIds)) return@forEach
        val id = stableHabitId(h)
        if (doneIds.contains(id)) {
            val isMulti = h["isMulti"] == true
            val level = habitLevels[id] as? String ?: "max"
            dailyEarned += if (isMulti && level == "min") asDouble(h["rewardMin"]) else asDouble(h["reward"])
        }
        if (failedIds.contains(id)) penaltyCost += asDouble(h["penalty"])
    }

    // Chiave "h.id" grezzo (non lo stableId con fallback sul nome usato sopra
    // per fatta/fallita) — habitValues su Firestore è indicizzato così anche
    // lato web, vedi computeDayNet in habitLogic.js.
    val numericHabitPoints = habits
        .filter { h -> (h["numericConfig"] as? Map<String, Any>) != null && habitValues[h["id"] as? String] != null }
        .sumOf { h ->
            val config = h["numericConfig"] as Map<String, Any>
            val value = asDouble(habitValues[h["id"] as? String])
            calcNumericPoints(value, config).let { if (it > 0) it else 0.0 }
        }
    val totalHabitPoints = dailyEarned + numericHabitPoints

    val purchases = todayEntryMap?.get("purchases") as? List<Map<String, Any>> ?: emptyList()
    val purchaseCost = purchases.sumOf { asDouble(it["cost"]) }
    val trackedRewards = todayEntryMap?.get("trackedRewards") as? Map<String, Any> ?: emptyMap()
    val trackedCost = trackedRewards.values.sumOf { tr -> asDouble((tr as? Map<String, Any>)?.get("cost")) }
    val dailySpent = penaltyCost + purchaseCost + trackedCost

    fun sumArrayLogPts(field: String): Double {
        val log = doc.get(field) as? Map<String, Any> ?: emptyMap()
        val entries = log[todayStr] as? List<Map<String, Any>> ?: emptyList()
        return entries.sumOf { asDouble(it["pts"]) }
    }
    fun singleLogPts(field: String): Double {
        val log = doc.get(field) as? Map<String, Any> ?: emptyMap()
        val entry = log[todayStr] as? Map<String, Any> ?: return 0.0
        return asDouble(entry["pts"])
    }

    val extraPts = sumArrayLogPts("exerciseLog") + sumArrayLogPts("mobilityLog") +
        sumArrayLogPts("studyLog") + sumArrayLogPts("willpowerLog") +
        sumArrayLogPts("meditationLog") + sumArrayLogPts("mealLog") +
        sumArrayLogPts("barefootLog") + sumArrayLogPts("hangLog") +
        singleLogPts("dayRecapLog") + singleLogPts("mindSocialLog")

    val checkIns = todayEntryMap?.get("checkIns") as? Map<String, Any> ?: emptyMap()
    val checkInPts = checkIns.values.sumOf { c ->
        val m = c as? Map<String, Any> ?: return@sumOf 0.0
        if (m["done"] == true) (asDouble(m["pts"]).takeIf { it != 0.0 } ?: 1.0) else 0.0
    }
    val readingPts = asDouble(todayEntryMap?.get("readingEarned"))

    val tasks = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
    val taskPts = tasks.filter {
        (it["status"] as? String) == "completed" && (it["completedAt"] as? String)?.startsWith(todayStr) == true
    }.sumOf { asDouble(it["reward"]) }
    val expiredTaskCost = tasks.filter {
        val expiredAt = it["expiredAt"] as? String
        it["penaltyApplied"] == true && expiredAt != null && isoToRomeDate(expiredAt) == todayStr
    }.sumOf { asDouble(it["penalty"]) }

    return totalHabitPoints + taskPts + extraPts + checkInPts + readingPts - dailySpent - expiredTaskCost
}

object GlpRepository {

    private fun userRef() = FirebaseFirestore.getInstance().collection("users").document("flavio")

    fun loadActiveTasks(onResult: (List<WearTask>) -> Unit, onError: (Exception) -> Unit) {
        userRef().get()
            .addOnSuccessListener { doc ->
                @Suppress("UNCHECKED_CAST")
                val raw = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
                val todayStr = today()
                val tasks = raw
                    .filter { (it["status"] as? String) == "active" && !(it["deadline"] as? String).isNullOrEmpty() }
                    .filter { (it["deadline"] as? String ?: "") <= todayStr }
                    .map {
                        WearTask(
                            id = it["id"]?.toString() ?: "",
                            title = it["title"] as? String ?: "Task",
                            priority = it["priority"] as? String ?: "medium",
                            reward = asDouble(it["reward"]).toInt(),
                            deadline = it["deadline"] as? String ?: todayStr,
                        )
                    }
                    .sortedWith(compareBy({ priorityRank(it.priority) }, { it.deadline }))
                onResult(tasks)
            }
            .addOnFailureListener(onError)
    }

    // Transazione invece di get()+update(): questa scrittura modifica un
    // elemento esistente dell'array "tasks", quindi arrayUnion da solo non
    // basta — serve una vera lettura atomica con retry in caso di scrittura
    // concorrente da telefono/web nella stessa finestra (stessa classe di bug
    // della perdita dati del 28/8/2026). Niente più scrittura sul campo
    // "score": non esiste più da nessun'altra parte dell'app (vedi CLAUDE.md),
    // il punteggio si ricalcola sempre (computeTodayNet qui sopra).
    fun completeTask(taskId: String, onDone: () -> Unit, onError: (Exception) -> Unit) {
        val ref = userRef()
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            .apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())
        FirebaseFirestore.getInstance().runTransaction { transaction ->
            val doc = transaction.get(ref)
            @Suppress("UNCHECKED_CAST")
            val tasks = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
            val updated = tasks.map { task ->
                if (task["id"]?.toString() == taskId) {
                    task.toMutableMap().apply {
                        put("status", "completed")
                        put("completedAt", nowIso)
                        put("rewardApplied", true)
                    }
                } else task
            }
            transaction.update(ref, "tasks", updated)
        }.addOnSuccessListener { onDone() }
            .addOnFailureListener(onError)
    }

    // Esercizi (ordine alfabetico) + id degli ultimi 3 usati oggi (più recente
    // prima) — quasi sempre gli stessi di sempre, per suggerirli come
    // scorciatoia accanto al "+" nella schermata Workout.
    fun loadExercises(onResult: (List<WearExercise>, List<String>) -> Unit, onError: (Exception) -> Unit) {
        userRef().get()
            .addOnSuccessListener { doc ->
                @Suppress("UNCHECKED_CAST")
                val raw = doc.get("quickExercises") as? List<Map<String, Any>> ?: emptyList()
                val exercises = raw
                    .filter { it["active"] != false }
                    .map {
                        WearExercise(
                            id = it["id"]?.toString() ?: "",
                            name = it["name"] as? String ?: "Esercizio",
                            emoji = it["emoji"] as? String ?: "💪",
                            pointsPerRep = asDouble(it["pointsPerRep"]),
                        )
                    }
                    .sortedBy { it.name }

                @Suppress("UNCHECKED_CAST")
                val todayLog = (doc.get("exerciseLog") as? Map<String, Any>)?.get(today()) as? List<Map<String, Any>> ?: emptyList()
                val recentIds = todayLog
                    .sortedByDescending { it["time"] as? String ?: "" }
                    .mapNotNull { it["exerciseId"] as? String }
                    .distinct()
                    .take(3)

                onResult(exercises, recentIds)
            }
            .addOnFailureListener(onError)
    }

    // "Punti oggi" (non più un fittizio "punti totali" letto da un campo
    // Firestore morto — vedi computeTodayNet).
    fun loadScore(onResult: (Double) -> Unit, onError: (Exception) -> Unit) {
        userRef().get()
            .addOnSuccessListener { doc -> onResult(computeTodayNet(doc)) }
            .addOnFailureListener(onError)
    }

    // Versione semplificata di isHabitVisible/setHabitStatus della web app —
    // niente abitudini numeriche, "min/max" o singole a data fissa — ma
    // rispetta comunque la cadenza multi-giorno (frequency), altrimenti
    // un'abitudine "ogni 3 giorni" restava spuntabile ogni giorno dal watch,
    // guadagnandone la ricompensa più spesso del previsto.
    fun loadHabits(onResult: (List<WearHabit>) -> Unit, onError: (Exception) -> Unit) {
        userRef().get()
            .addOnSuccessListener { doc ->
                val todayStr = today()
                val (doneIds, failedIds) = todayDoneAndFailed(doc, todayStr)
                @Suppress("UNCHECKED_CAST")
                val rawHabits = doc.get("habits") as? List<Map<String, Any>> ?: emptyList()

                val habits = rawHabits
                    .filter { it["type"] != "single" && it["type"] != "goal" }
                    .filter { isHabitVisibleToday(it, todayStr, doneIds, failedIds) }
                    .map {
                        val id = stableHabitId(it)
                        WearHabit(
                            id = id,
                            name = it["name"] as? String ?: "Abitudine",
                            emoji = it["emoji"] as? String ?: "⭐",
                            done = doneIds.contains(id),
                        )
                    }
                onResult(habits)
            }
            .addOnFailureListener(onError)
    }

    fun toggleHabit(habitId: String, currentlyDone: Boolean, onDone: () -> Unit, onError: (Exception) -> Unit) {
        val ref = userRef()
        val todayStr = today()
        // Transazione invece di get()+update(): stessa motivazione di
        // completeTask qui sopra — modifica un elemento esistente dell'array
        // "habits", serve lettura atomica con retry.
        FirebaseFirestore.getInstance().runTransaction { transaction ->
            val doc = transaction.get(ref)
            @Suppress("UNCHECKED_CAST")
            val habitsArr = (doc.get("habits") as? List<Map<String, Any>> ?: emptyList()).toMutableList()
            @Suppress("UNCHECKED_CAST")
            val dailyLogs = (doc.get("dailyLogs") as? Map<String, Any>) ?: emptyMap()
            @Suppress("UNCHECKED_CAST")
            val todayEntryRaw = dailyLogs[todayStr] as? Map<String, Any>
            @Suppress("UNCHECKED_CAST")
            val doneIds = ((todayEntryRaw?.get("habits") as? List<String>) ?: emptyList()).toMutableList()
            @Suppress("UNCHECKED_CAST")
            val habitLevels = ((todayEntryRaw?.get("habitLevels") as? Map<String, Any>) ?: emptyMap()).toMutableMap()

            val idx = habitsArr.indexOfFirst { stableHabitId(it) == habitId }
            if (currentlyDone) {
                doneIds.remove(habitId)
                habitLevels.remove(habitId)
                // Ripristina anche lastDone, altrimenti un tap accidentale
                // seguito da un annulla lascia una data "fatta" fantasma che
                // la cadenza multi-giorno (isHabitVisibleToday) leggerebbe
                // come "già fatta di recente", nascondendo l'abitudine per il
                // resto della giornata anche se non è mai stata completata.
                if (idx >= 0) habitsArr[idx] = habitsArr[idx].toMutableMap().apply { remove("lastDone") }
            } else {
                doneIds.add(habitId)
                habitLevels[habitId] = "max"
                if (idx >= 0) habitsArr[idx] = habitsArr[idx].toMutableMap().apply { put("lastDone", todayStr) }
            }

            transaction.update(
                ref,
                mapOf(
                    "dailyLogs.$todayStr.habits" to doneIds,
                    "dailyLogs.$todayStr.habitLevels" to habitLevels,
                    "habits" to habitsArr,
                )
            )
        }.addOnSuccessListener { onDone() }
            .addOnFailureListener(onError)
    }

    // Log dal watch con reps/sforzo scelti dall'utente — stessa formula punti
    // della web app (vedi EFFORT_MULTIPLIERS in workoutStats.js). Math.round
    // invece di un troncamento manuale via toLong(): con virgola mobile binaria
    // (reps * pointsPerRep * multiplier * 100).toLong() arrotonda sempre per
    // difetto (es. 28.999999999999996 -> 28 invece di 29), sottostimando i
    // punti in modo sistematico rispetto alla stessa formula sul web.
    fun logQuickSet(exercise: WearExercise, reps: Int, effort: Int, onDone: (Double) -> Unit, onError: (Exception) -> Unit) {
        val multiplier = when (effort) { 2 -> 1.2; 3 -> 1.5; else -> 1.0 }
        val pts = Math.round(reps * exercise.pointsPerRep * multiplier * 100) / 100.0
        val logEntry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "exerciseId" to exercise.id,
            "reps" to reps,
            "pts" to pts,
            "effort" to effort,
            "load" to 0.0,
            "time" to SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date()),
        )
        userRef().update("exerciseLog.${today()}", FieldValue.arrayUnion(logEntry))
            .addOnSuccessListener { onDone(pts) }
            .addOnFailureListener(onError)
    }

    // Alimenti (ordine alfabetico) + id degli ultimi 3 usati oggi — stesso
    // schema di loadExercises qui sopra, per lo stesso motivo (scorciatoia
    // rapida per i pasti che si ripetono più spesso).
    fun loadFoods(onResult: (List<WearFood>, List<String>) -> Unit, onError: (Exception) -> Unit) {
        userRef().get()
            .addOnSuccessListener { doc ->
                @Suppress("UNCHECKED_CAST")
                val raw = doc.get("proteinFoods") as? List<Map<String, Any>> ?: emptyList()
                val foods = raw
                    .map {
                        WearFood(
                            id = it["id"]?.toString() ?: "",
                            name = it["name"] as? String ?: "Alimento",
                            emoji = it["emoji"] as? String ?: "🍽️",
                            proteinPer100g = asDouble(it["proteinPer100g"]),
                        )
                    }
                    .sortedBy { it.name }

                @Suppress("UNCHECKED_CAST")
                val todayLog = (doc.get("proteinLog") as? Map<String, Any>)?.get(today()) as? List<Map<String, Any>> ?: emptyList()
                val recentIds = todayLog
                    .sortedByDescending { it["time"] as? String ?: "" }
                    .mapNotNull { it["foodId"] as? String }
                    .distinct()
                    .take(3)

                onResult(foods, recentIds)
            }
            .addOnFailureListener(onError)
    }

    // arrayUnion invece di get()+update(): niente lettura, niente race con
    // scritture concorrenti da telefono/web nella stessa finestra (stessa
    // lezione della perdita dati del 28/8/2026) — stessa forma dell'entry
    // scritta da AddProteinActivity.kt sul widget nativo Android.
    fun logProtein(food: WearFood, grams: Int, onDone: (Double) -> Unit, onError: (Exception) -> Unit) {
        val proteinGrams = Math.round(grams * (food.proteinPer100g / 100) * 10) / 10.0
        val logEntry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "foodId" to food.id,
            "name" to food.name,
            "emoji" to food.emoji,
            "grams" to grams,
            "proteinGrams" to proteinGrams,
            "time" to SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date()),
        )
        userRef().update("proteinLog.${today()}", FieldValue.arrayUnion(logEntry))
            .addOnSuccessListener { onDone(proteinGrams) }
            .addOnFailureListener(onError)
    }

    // Pasto consapevole: stessa forma dell'entry scritta da logMeal() in
    // store.jsx (mealLog.{data}), livello 1/2/3 = veloce/normale/con calma.
    // Il target impostato prima di iniziare è solo un traguardo mostrato
    // durante il timer, non viene salvato sull'entry (a differenza della web
    // app, che lo usa per il badge "obiettivo centrato" nello storico — non
    // essenziale per una schermata pensata per essere rapida).
    // Aggiunta rapida stile QuickAddTaskActivity/VoiceAddTaskActivity sul
    // telefono: solo titolo + scadenza, reward/penalità a 0, priorità media —
    // si rifinisce poi dall'app se serve. arrayUnion invece di get()+update():
    // niente lettura, niente race con scritture concorrenti (stessa lezione
    // della perdita dati del 28/8/2026).
    fun addTask(title: String, deadline: String, onDone: () -> Unit, onError: (Exception) -> Unit) {
        val todayStr = today()
        val isPast = deadline < todayStr
        val task = hashMapOf<String, Any>(
            "id" to "task_${System.currentTimeMillis()}",
            "title" to title,
            "deadline" to deadline,
            "reward" to 0.0,
            "penalty" to 0.0,
            "priority" to "medium",
            "status" to if (isPast) "expired" else "active",
            "rewardApplied" to false,
            "penaltyApplied" to isPast,
        )
        if (isPast) {
            task["expiredAt"] = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                .apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())
        }
        userRef().update("tasks", FieldValue.arrayUnion(task))
            .addOnSuccessListener { onDone() }
            .addOnFailureListener(onError)
    }

    // Willpower: log rapido +/-, non una sessione con durata — stessa forma
    // dell'entry scritta da addWillpowerEntry in store.jsx / AddWillpowerActivity.kt.
    fun logWillpower(text: String, succeeded: Boolean, points: Int, onDone: (Double) -> Unit, onError: (Exception) -> Unit) {
        val pts = if (succeeded) points.toDouble() else -points.toDouble()
        val logEntry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "text" to text,
            "succeeded" to succeeded,
            "pts" to pts,
            "time" to SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date()),
        )
        userRef().update("willpowerLog.${today()}", FieldValue.arrayUnion(logEntry))
            .addOnSuccessListener { onDone(pts) }
            .addOnFailureListener(onError)
    }

    // Meditazione: punti a tasso fisso per sessione (non scalato sui minuti,
    // stessa scelta di logMeditation in store.jsx — "se tocchi il pulsante è
    // perché l'hai fatto", non serve un'autovalutazione come per i pasti.
    private const val MEDITATION_RATE = 1.0

    fun logMeditation(minutes: Int, onDone: (Double) -> Unit, onError: (Exception) -> Unit) {
        val logEntry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "pts" to MEDITATION_RATE,
            "minutes" to minutes,
            "time" to SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date()),
        )
        userRef().update("meditationLog.${today()}", FieldValue.arrayUnion(logEntry))
            .addOnSuccessListener { onDone(MEDITATION_RATE) }
            .addOnFailureListener(onError)
    }

    fun logMeal(durationMin: Int, level: Int, onDone: (Double) -> Unit, onError: (Exception) -> Unit) {
        val multiplier = MEAL_LEVEL_MULTIPLIERS[level] ?: 0.7
        val pts = Math.round(durationMin * DEFAULT_MEAL_RATE * multiplier * 10) / 10.0
        val logEntry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "durationMin" to durationMin,
            "level" to level,
            "pts" to pts,
            "time" to SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date()),
        )
        userRef().update("mealLog.${today()}", FieldValue.arrayUnion(logEntry))
            .addOnSuccessListener { onDone(pts) }
            .addOnFailureListener(onError)
    }
}
