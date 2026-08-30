package com.flavio.glp

import android.app.Service
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.IBinder
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
import java.util.*

class HabitActionService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val habitId = intent?.getStringExtra("habit_id") ?: run { stopSelf(); return START_NOT_STICKY }
        val action = intent.getStringExtra("action") ?: run { stopSelf(); return START_NOT_STICKY }
        val widgetId = intent.getIntExtra("widget_id", -1)

        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        // FEEDBACK IMMEDIATO — rimuovi subito l'abitudine dalla lista locale
        val prefs = getSharedPreferences("glp_widget", MODE_PRIVATE)
        val json = prefs.getString("pending_habits", "[]") ?: "[]"
        val type = object : com.google.gson.reflect.TypeToken<List<Map<String, Any>>>() {}.type
        val pending: List<Map<String, Any>> = try {
            com.google.gson.Gson().fromJson(json, type) ?: emptyList()
        } catch (e: Exception) { emptyList() }

        val updatedPending = pending.filter { it["id"]?.toString() != habitId }
        prefs.edit().putString("pending_habits", com.google.gson.Gson().toJson(updatedPending)).apply()

        val manager = AppWidgetManager.getInstance(this)
        val ids = manager.getAppWidgetIds(ComponentName(this, HabitsWidgetProvider::class.java))
        ids.forEach { HabitsWidgetProvider.updateWidget(this, manager, it) }

        // Aggiorna Firebase in background
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val reward = intent.getDoubleExtra("reward", 0.0)
        val penalty = intent.getDoubleExtra("penalty", 0.0)
        val userRef = FirebaseFirestore.getInstance().collection("users").document("flavio")

        // Niente più scrittura sul campo "score": non esiste più da
        // nessun'altra parte dell'app (vedi CLAUDE.md, il punteggio si
        // ricalcola sempre lato client da tasks/habits/log) — incrementarlo
        // qui lo rendeva solo disallineato, stesso bug trovato oggi anche sul
        // modulo Wear OS e sui widget task.
        //
        // Aggiornamento ottimistico del widget Day: prima mancava del tutto,
        // quindi completare/fallire un'abitudine dal widget (l'azione più
        // frequente in assoluto) non si rifletteva sul widget punti finché
        // non arrivava il prossimo refresh periodico (fino a 15 minuti) —
        // stesso pattern già usato da CompleteTaskActivity/AddWorkoutActivity.
        when (action) {
            "done" -> {
                DayWidgetProvider.applyDelta(this, earnedDelta = reward.toInt(), habitsEarnedDelta = reward.toInt())
                userRef.update(
                    "dailyLogs.$today.habits", FieldValue.arrayUnion(habitId)
                ).addOnCompleteListener { updateWidgetData() }
            }
            "fail" -> {
                DayWidgetProvider.applyDelta(this, spentDelta = penalty.toInt(), penaltyDelta = penalty.toInt())
                userRef.update(
                    "dailyLogs.$today.failedHabits", FieldValue.arrayUnion(habitId)
                ).addOnCompleteListener { updateWidgetData() }
            }
            "refresh" -> updateWidgetData()
            else -> stopSelf()
        }

        return START_NOT_STICKY
    }

    private fun updateWidgetData() {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        FirebaseFirestore.getInstance()
            .collection("users").document("flavio")
            .get()
            .addOnSuccessListener { doc ->
                @Suppress("UNCHECKED_CAST")
                val habits = doc.get("habits") as? List<Map<String, Any>> ?: emptyList()
                val dailyLogs = doc.get("dailyLogs") as? Map<String, Any> ?: emptyMap()
                val todayLog = dailyLogs[today] as? Map<String, Any> ?: emptyMap()
                val doneList = (todayLog["habits"] as? List<*>)?.map { it.toString() } ?: emptyList()
                val failedList = (todayLog["failedHabits"] as? List<*>)?.map { it.toString() } ?: emptyList()

                val pending = habits.filter { habit ->
                    val id = habit["id"]?.toString() ?: return@filter false
                    val archived = habit["archivedAt"]
                    val type = habit["type"] as? String ?: ""
                    archived == null &&
                    !doneList.contains(id) &&
                    !failedList.contains(id) &&
                    type != "auto_fit"
                }

                val prefs = getSharedPreferences("glp_widget", MODE_PRIVATE)
                prefs.edit()
                    .putString("pending_habits", com.google.gson.Gson().toJson(pending.take(5)))
                    .apply()

                val manager = AppWidgetManager.getInstance(this)
                val ids = manager.getAppWidgetIds(ComponentName(this, HabitsWidgetProvider::class.java))
                ids.forEach { HabitsWidgetProvider.updateWidget(this, manager, it) }
            }
            .addOnCompleteListener { stopSelf() }
    }
}
