package com.flavio.glp.wear

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
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
    else -> 0.0
}

private fun priorityRank(p: String): Int = when (p) {
    "high" -> 0
    "low" -> 2
    else -> 1
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

    fun completeTask(taskId: String, reward: Int, onDone: () -> Unit, onError: (Exception) -> Unit) {
        val ref = userRef()
        ref.get().addOnSuccessListener { doc ->
            @Suppress("UNCHECKED_CAST")
            val tasks = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
            val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                .apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())
            val updated = tasks.map { task ->
                if (task["id"]?.toString() == taskId) {
                    task.toMutableMap().apply {
                        put("status", "completed")
                        put("completedAt", nowIso)
                        put("rewardApplied", true)
                    }
                } else task
            }
            val currentScore = doc.getDouble("score") ?: 0.0
            ref.update("tasks", updated, "score", currentScore + reward)
                .addOnSuccessListener { onDone() }
                .addOnFailureListener(onError)
        }.addOnFailureListener(onError)
    }

    fun loadExercises(onResult: (List<WearExercise>) -> Unit, onError: (Exception) -> Unit) {
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
                onResult(exercises)
            }
            .addOnFailureListener(onError)
    }

    fun loadScore(onResult: (Double) -> Unit, onError: (Exception) -> Unit) {
        userRef().get()
            .addOnSuccessListener { doc -> onResult(doc.getDouble("score") ?: 0.0) }
            .addOnFailureListener(onError)
    }

    // Versione semplificata di isHabitVisible/setHabitStatus della web app —
    // niente frequenze multi-giorno, livelli "min/max" o abitudini singole a
    // data fissa: solo le abitudini normali di oggi con toggle fatto/non fatto,
    // sufficiente per farsi un'idea reale sul watch senza portare tutta la
    // logica di scheduling in Kotlin.
    fun loadHabits(onResult: (List<WearHabit>) -> Unit, onError: (Exception) -> Unit) {
        userRef().get()
            .addOnSuccessListener { doc ->
                @Suppress("UNCHECKED_CAST")
                val rawHabits = doc.get("habits") as? List<Map<String, Any>> ?: emptyList()
                @Suppress("UNCHECKED_CAST")
                val todayEntry = (doc.get("dailyLogs") as? Map<String, Any>)?.get(today()) as? Map<String, Any>
                @Suppress("UNCHECKED_CAST")
                val doneIds = (todayEntry?.get("habits") as? List<String>) ?: emptyList()

                val habits = rawHabits
                    .filter { it["archivedAt"] == null && it["type"] != "single" }
                    .map {
                        val id = it["id"] as? String ?: (it["name"] as? String ?: "").replace(Regex("[^a-zA-Z0-9]"), "")
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
        ref.get().addOnSuccessListener { doc ->
            @Suppress("UNCHECKED_CAST")
            val habitsArr = (doc.get("habits") as? List<Map<String, Any>> ?: emptyList()).toMutableList()
            val todayStr = today()
            @Suppress("UNCHECKED_CAST")
            val dailyLogs = (doc.get("dailyLogs") as? Map<String, Any>) ?: emptyMap()
            @Suppress("UNCHECKED_CAST")
            val todayEntryRaw = dailyLogs[todayStr] as? Map<String, Any>
            @Suppress("UNCHECKED_CAST")
            val doneIds = ((todayEntryRaw?.get("habits") as? List<String>) ?: emptyList()).toMutableList()
            @Suppress("UNCHECKED_CAST")
            val habitLevels = ((todayEntryRaw?.get("habitLevels") as? Map<String, Any>) ?: emptyMap()).toMutableMap()

            if (currentlyDone) {
                doneIds.remove(habitId)
                habitLevels.remove(habitId)
            } else {
                doneIds.add(habitId)
                habitLevels[habitId] = "max"
                val idx = habitsArr.indexOfFirst {
                    (it["id"] as? String ?: (it["name"] as? String ?: "").replace(Regex("[^a-zA-Z0-9]"), "")) == habitId
                }
                if (idx >= 0) habitsArr[idx] = habitsArr[idx].toMutableMap().apply { put("lastDone", todayStr) }
            }

            ref.update(
                "dailyLogs.$todayStr.habits", doneIds,
                "dailyLogs.$todayStr.habitLevels", habitLevels,
                "habits", habitsArr,
            ).addOnSuccessListener { onDone() }
                .addOnFailureListener(onError)
        }.addOnFailureListener(onError)
    }

    // Log rapido dal watch: sempre 10 reps a sforzo "leggero" (1x) — stesso
    // criterio di default della web app, pensato per un tap solo dal polso,
    // non per sostituire il log dettagliato dal telefono.
    fun logQuickSet(exercise: WearExercise, onDone: (Double) -> Unit, onError: (Exception) -> Unit) {
        val reps = 10
        val pts = (reps * exercise.pointsPerRep * 100).toLong() / 100.0
        val logEntry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "exerciseId" to exercise.id,
            "reps" to reps,
            "pts" to pts,
            "effort" to 1,
            "time" to SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date()),
        )
        userRef().update("exerciseLog.${today()}", FieldValue.arrayUnion(logEntry))
            .addOnSuccessListener { onDone(pts) }
            .addOnFailureListener(onError)
    }
}
