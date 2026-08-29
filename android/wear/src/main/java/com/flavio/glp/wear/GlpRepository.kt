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

fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

private fun asDouble(v: Any?): Double = when (v) {
    is Double -> v
    is Long -> v.toDouble()
    is Int -> v.toDouble()
    is String -> v.toDoubleOrNull() ?: 0.0
    else -> 0.0
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

// Punti "Netto" di oggi — porta su Kotlin computeDayNet() di habitLogic.js,
// con lo stesso approccio del watch per il resto (habitLevels sempre "max",
// niente numericConfig/obiettivi/purchases: funzioni non presenti sul watch).
// Aggiunto dopo che è emerso che il campo Firestore "score" non viene più
// scritto da nessun'altra parte dell'app dal refactor che l'ha reso
// puramente calcolato lato client (vedi CLAUDE.md) — il watch lo leggeva
// comunque, mostrando un numero permanentemente disallineato da telefono/web.
@Suppress("UNCHECKED_CAST")
private fun computeTodayNet(doc: DocumentSnapshot): Double {
    val todayStr = today()
    val (doneIds, failedIds) = todayDoneAndFailed(doc, todayStr)

    val habits = doc.get("habits") as? List<Map<String, Any>> ?: emptyList()
    var dailyEarned = 0.0
    var penaltyCost = 0.0
    habits.forEach { h ->
        if (h["type"] == "goal" || h["type"] == "single") return@forEach
        if (!isHabitVisibleToday(h, todayStr, doneIds, failedIds)) return@forEach
        val id = stableHabitId(h)
        if (doneIds.contains(id)) dailyEarned += asDouble(h["reward"])
        if (failedIds.contains(id)) penaltyCost += asDouble(h["penalty"])
    }

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

    val todayEntryMap = (doc.get("dailyLogs") as? Map<String, Any>)?.get(todayStr) as? Map<String, Any>
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

    return dailyEarned + taskPts + extraPts + checkInPts + readingPts - penaltyCost - expiredTaskCost
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
}
