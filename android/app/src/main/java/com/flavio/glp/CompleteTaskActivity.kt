package com.flavio.glp

import android.app.Activity
import android.app.AlertDialog
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.widget.Toast
import com.google.firebase.firestore.FirebaseFirestore
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class CompleteTaskActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val taskId = intent.getStringExtra("task_id") ?: run { finish(); return }
        val taskTitle = intent.getStringExtra("task_title") ?: "Task"
        val taskReward = intent.getDoubleExtra("task_reward", 0.0)
        val taskPriority = intent.getStringExtra("task_priority") ?: "medium"

        AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Task completata?")
            .setMessage("\"$taskTitle\"")
            .setPositiveButton("Si, completata!") { _, _ ->
                completeTask(taskId, taskTitle, taskReward, taskPriority)
            }
            .setNegativeButton("Annulla") { _, _ -> finish() }
            .setOnCancelListener { finish() }
            .show()
    }

    private fun completeTask(taskId: String, title: String, reward: Double, priority: String) {
        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        // Aggiornamento ottimistico: sposta subito la task da attiva a completata
        // (verde, sbarrata, in fondo) invece di farla solo sparire finché non
        // arriva la risposta di Firestore — altrimenti il widget sembra "in ritardo".
        markTaskCompletedOptimistic(taskId, title, reward, priority)

        val db = FirebaseFirestore.getInstance()
        val userRef = db.collection("users").document("flavio")

        userRef.get().addOnSuccessListener { doc ->
            @Suppress("UNCHECKED_CAST")
            val tasks = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
            val original = tasks.find { it["id"]?.toString() == taskId }
            var updated = tasks.map { task ->
                if (task["id"]?.toString() == taskId) {
                    task.toMutableMap().apply {
                        put("status", "completed")
                        put("completedAt", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.getDefault()).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date()))
                        put("rewardApplied", true)
                    }
                } else task
            }

            // Task ricorrente: genera subito la prossima istanza, scadenza =
            // data di completamento reale + N giorni (stessa logica di
            // store.jsx _spawnNextRecurringInstance sul web — non un
            // calendario fisso, riparte da quando la completi davvero).
            val recurringId = original?.get("recurringId") as? String
            if (recurringId != null) {
                @Suppress("UNCHECKED_CAST")
                val recurringTasks = doc.get("recurringTasks") as? List<Map<String, Any>> ?: emptyList()
                val template = recurringTasks.find { it["id"]?.toString() == recurringId }
                val templateActive = template?.get("active") != false
                val alreadyPending = updated.any { it["recurringId"] == recurringId && (it["status"] as? String) != "completed" }
                if (template != null && templateActive && !alreadyPending) {
                    fun asDouble(v: Any?): Double = when (v) { is Double -> v; is Long -> v.toDouble(); is Int -> v.toDouble(); else -> 0.0 }
                    val intervalDays = asDouble(template["intervalDays"]).toInt().coerceAtLeast(1)
                    val dayFormat = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
                    val nextDeadline = dayFormat.format(java.util.Calendar.getInstance().apply { add(java.util.Calendar.DAY_OF_YEAR, intervalDays) }.time)
                    val nextInstance = hashMapOf<String, Any>(
                        "id" to "task_${System.currentTimeMillis()}",
                        "title" to (template["title"] as? String ?: title),
                        "description" to "",
                        "deadline" to nextDeadline,
                        "reward" to asDouble(template["reward"]),
                        "penalty" to asDouble(template["penalty"]),
                        "priority" to (template["priority"] as? String ?: "medium"),
                        "status" to "active",
                        "rewardApplied" to false,
                        "penaltyApplied" to false,
                        "createdAt" to com.google.firebase.Timestamp.now(),
                        "recurringId" to recurringId,
                    )
                    updated = updated + nextInstance
                }
            }

            val currentScore = doc.getDouble("score") ?: 0.0
            userRef.update(
                "tasks", updated,
                "score", currentScore + reward
            ).addOnSuccessListener {
                android.util.Log.d("GLPWidget", "Task $taskId completed +${reward}pt")
                vibrate()
                Toast.makeText(this, "+${reward.toInt()}pt Task completata!", Toast.LENGTH_SHORT).show()
                finish()
            }.addOnFailureListener { e ->
                android.util.Log.e("GLPWidget", "Error completing task: ${e.message}")
                finish()
            }
        }.addOnFailureListener { finish() }
    }

    private fun markTaskCompletedOptimistic(taskId: String, title: String, reward: Double, priority: String) {
        val prefs = getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
        val type = object : TypeToken<MutableList<Map<String, Any>>>() {}.type

        val active: MutableList<Map<String, Any>> = try {
            Gson().fromJson(prefs.getString("active_tasks", "[]") ?: "[]", type) ?: mutableListOf()
        } catch (e: Exception) { mutableListOf() }
        val completed: MutableList<Map<String, Any>> = try {
            Gson().fromJson(prefs.getString("completed_tasks_widget", "[]") ?: "[]", type) ?: mutableListOf()
        } catch (e: Exception) { mutableListOf() }

        val removedTask = active.find { it["id"]?.toString() == taskId }
        val newActive = active.filter { it["id"]?.toString() != taskId }

        val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.getDefault())
            .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date())

        val completedEntry: MutableMap<String, Any> = mutableMapOf<String, Any>().apply {
            if (removedTask != null) putAll(removedTask) else {
                put("id", taskId); put("title", title); put("reward", reward); put("priority", priority)
            }
            put("status", "completed")
            put("completedAt", nowIso)
        }
        val newCompleted = (listOf(completedEntry) + completed).take(TaskWidgetProvider.MAX_ROWS)

        prefs.edit()
            .putString("active_tasks", Gson().toJson(newActive.take(TaskWidgetProvider.MAX_ROWS)))
            .putString("completed_tasks_widget", Gson().toJson(newCompleted))
            .apply()

        val manager = AppWidgetManager.getInstance(this)
        val ids = manager.getAppWidgetIds(ComponentName(this, TaskWidgetProvider::class.java))
        ids.forEach { TaskWidgetProvider.updateWidget(this, manager, it) }

        // Aggiorna subito DayWidget con i punti guadagnati dalla task
        DayWidgetProvider.applyDelta(this, earnedDelta = reward.toInt(), taskEarnedDelta = reward.toInt())
    }

    private fun vibrate() {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                v.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
            }
        } catch (e: Exception) { /* ignora */ }
    }
}
