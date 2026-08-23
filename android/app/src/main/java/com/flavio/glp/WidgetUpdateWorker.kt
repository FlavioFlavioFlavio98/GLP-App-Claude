package com.flavio.glp

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.work.*
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.gson.Gson
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

class WidgetUpdateWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        if (FirebaseApp.getApps(context).isEmpty()) {
            FirebaseApp.initializeApp(context)
        }

        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val today = sdf.format(Date())
        val db = FirebaseFirestore.getInstance()

        return try {
            val doc = db.collection("users").document("flavio").get().await()
            if (doc == null || !doc.exists()) return Result.retry()

            @Suppress("UNCHECKED_CAST")
            val tasks     = doc.get("tasks")    as? List<Map<String, Any>> ?: emptyList()
            val habits    = doc.get("habits")   as? List<Map<String, Any>> ?: emptyList()
            val rewards   = doc.get("rewards")  as? List<Map<String, Any>> ?: emptyList()
            val dailyLogs = doc.get("dailyLogs") as? Map<String, Any> ?: emptyMap()
            val todayLog  = dailyLogs[today] as? Map<String, Any> ?: emptyMap()
            val score     = (doc.getDouble("score") ?: 0.0).toFloat()

            // ── Task attive per la data selezionata nel widget (oggi = include
            // anche le scadute), più le completate quel giorno per lo stesso ──
            val prefsRead = context.getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
            val selectedDate = prefsRead.getString("selected_date", null) ?: today
            val activeTasks = TaskWidgetUtils.activeTasksForDate(tasks, selectedDate, today)
            val completedTasksWidget = TaskWidgetUtils.completedTasksForDate(tasks, selectedDate)

            // ── Liste completati/falliti ──────────────────────────────────────
            val doneList   = (todayLog["habits"]       as? List<*>)?.map { it.toString() } ?: emptyList()
            val failedList = (todayLog["failedHabits"] as? List<*>)?.map { it.toString() } ?: emptyList()
            val activeHabits = habits.filter { it["archivedAt"] == null }

            // ── Guadagni abitudini ────────────────────────────────────────────
            var habitEarned = 0.0
            doneList.forEach { habitId ->
                val h = habits.find { (it["id"] as? String) == habitId || it["id"].toString() == habitId }
                habitEarned += (h?.get("reward") as? Double) ?: (h?.get("reward") as? Long)?.toDouble() ?: 0.0
            }

            // ── Guadagni esercizi (extra) ─────────────────────────────────────
            var extraEarned = 0.0
            val exerciseLog = doc.get("exerciseLog") as? Map<String, Any> ?: emptyMap()
            val todayExercises = exerciseLog[today] as? List<Map<String, Any>> ?: emptyList()
            todayExercises.forEach { ex -> extraEarned += (ex["pts"] as? Double) ?: 0.0 }

            // ── Guadagni task completate oggi ──────────────────────────────────
            var taskEarned = 0.0
            tasks.filter { task ->
                task["status"] == "completed" &&
                (task["rewardApplied"] == true || task["rewardApplied"] == "true") &&
                (task["completedAt"] as? String)?.startsWith(today) == true
            }.forEach { task ->
                taskEarned += (task["reward"] as? Double) ?: (task["reward"] as? Long)?.toDouble() ?: 0.0
            }

            val earned = habitEarned + extraEarned + taskEarned

            // ── Costi penalità abitudini fallite ──────────────────────────────
            var penaltySpent = 0.0
            failedList.forEach { habitId ->
                val h = habits.find { (it["id"] as? String) == habitId || it["id"].toString() == habitId }
                penaltySpent += (h?.get("penalty") as? Double) ?: (h?.get("penalty") as? Long)?.toDouble() ?: 0.0
            }
            // Costi acquisti negozio
            val purchases = todayLog["purchases"] as? List<*> ?: emptyList<Any>()
            purchases.forEach { rewardId ->
                val rewardIdStr = rewardId.toString()
                val r = rewards.find { (it["id"] as? String) == rewardIdStr || it["id"].toString() == rewardIdStr }
                penaltySpent += (r?.get("cost") as? Double) ?: (r?.get("cost") as? Long)?.toDouble() ?: 0.0
            }

            // ── Costi task scadute ────────────────────────────────────────────
            val yesterday = sdf.format(Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -1) }.time)
            val tasksSpent = tasks
                .filter { task ->
                    task["status"] == "expired" &&
                    (task["penaltyApplied"] == true || task["penaltyApplied"] == "true") &&
                    ((task["expiredAt"] as? String)?.startsWith(today) == true ||
                     (task["expiredAt"] as? String)?.startsWith(yesterday) == true)
                }
                .sumOf { task ->
                    (task["penalty"] as? Double) ?: (task["penalty"] as? Long)?.toDouble() ?: 0.0
                }

            val spent = penaltySpent + tasksSpent
            val net   = earned - spent

            // ── Streak ───────────────────────────────────────────────────────
            var streak = 0
            val cal = Calendar.getInstance()
            for (i in 0..365) {
                val dateStr = sdf.format(cal.time)
                val dayLog  = dailyLogs[dateStr] as? Map<String, Any>
                val dayDone = dayLog?.get("habits") as? List<*>
                if (!dayDone.isNullOrEmpty()) { streak++; cal.add(Calendar.DAY_OF_YEAR, -1) } else break
            }

            // ── Abitudini pending ─────────────────────────────────────────────
            val pendingHabits = habits.filter { habit ->
                val id = habit["id"]?.toString() ?: return@filter false
                habit["archivedAt"] == null && !doneList.contains(id) && !failedList.contains(id)
            }

            // ── Salva in SharedPreferences ────────────────────────────────────
            val prefs = context.getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
            prefs.edit()
                .putString("active_tasks",   Gson().toJson(activeTasks.take(5)))
                .putString("completed_tasks_widget", Gson().toJson(completedTasksWidget.take(5)))
                .putString("pending_habits", Gson().toJson(pendingHabits.take(5)))
                .putString("last_update",    today)
                .putInt("day_earned_int",    earned.toInt())
                .putInt("day_spent_int",     spent.toInt())
                .putInt("day_net_int",       net.toInt())
                .putInt("day_habits_earned", habitEarned.toInt())
                .putInt("day_extra_earned",  extraEarned.toInt())
                .putInt("day_tasks_earned",  taskEarned.toInt())
                .putInt("day_penalty_spent", penaltySpent.toInt())
                .putInt("day_tasks_spent",   tasksSpent.toInt())
                .putInt("habits_completed",  doneList.size)
                .putInt("habits_total",      activeHabits.size)
                .putInt("streak",            streak)
                .putInt("total_score_int",   score.toInt())
                .apply()

            // ── Aggiorna tutti i widget ───────────────────────────────────────
            val manager = AppWidgetManager.getInstance(context)

            manager.getAppWidgetIds(ComponentName(context, TaskWidgetProvider::class.java))
                .forEach { TaskWidgetProvider.updateWidget(context, manager, it) }

            manager.getAppWidgetIds(ComponentName(context, DayWidgetProvider::class.java))
                .forEach { DayWidgetProvider.updateWidget(context, manager, it) }

            manager.getAppWidgetIds(ComponentName(context, HabitsWidgetProvider::class.java))
                .forEach { HabitsWidgetProvider.updateWidget(context, manager, it) }

            android.util.Log.d("GLPWidget", "Worker: earned=$earned spent=$spent net=$net streak=$streak")
            Result.success()
        } catch (e: Exception) {
            android.util.Log.e("GLPWidget", "Worker error: ${e.message}")
            Result.retry()
        }
    }

    companion object {
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<WidgetUpdateWorker>(
                15, TimeUnit.MINUTES
            ).build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "widget_update",
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}
