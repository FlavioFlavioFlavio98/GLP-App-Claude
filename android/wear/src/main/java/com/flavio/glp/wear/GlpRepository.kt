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
