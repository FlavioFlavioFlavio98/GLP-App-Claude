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

        AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Task completata?")
            .setMessage("\"$taskTitle\"")
            .setPositiveButton("Si, completata!") { _, _ ->
                completeTask(taskId, taskReward)
            }
            .setNegativeButton("Annulla") { _, _ -> finish() }
            .setOnCancelListener { finish() }
            .show()
    }

    private fun completeTask(taskId: String, reward: Double) {
        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        // Aggiornamento ottimistico: rimuovi task dalla lista + aggiorna subito DayWidget
        removeTaskFromWidgetPrefs(taskId, reward)

        val db = FirebaseFirestore.getInstance()
        val userRef = db.collection("users").document("flavio")

        userRef.get().addOnSuccessListener { doc ->
            @Suppress("UNCHECKED_CAST")
            val tasks = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
            val updated = tasks.map { task ->
                if (task["id"]?.toString() == taskId) {
                    task.toMutableMap().apply {
                        put("status", "completed")
                        put("completedAt", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.getDefault()).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date()))
                        put("rewardApplied", true)
                    }
                } else task
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

    private fun removeTaskFromWidgetPrefs(taskId: String, reward: Double) {
        val prefs = getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
        val json = prefs.getString("active_tasks", "[]") ?: "[]"
        val type = object : TypeToken<MutableList<Map<String, Any>>>() {}.type
        val current: MutableList<Map<String, Any>> = try {
            Gson().fromJson(json, type) ?: mutableListOf()
        } catch (e: Exception) { mutableListOf() }

        val filtered = current.filter { it["id"]?.toString() != taskId }
        prefs.edit().putString("active_tasks", Gson().toJson(filtered)).apply()

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
