package com.flavio.glp

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.text.SimpleDateFormat
import java.util.*

class TaskWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == "com.flavio.glp.REFRESH_WIDGET") {
            val appWidgetId = intent.getIntExtra(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            )
            if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return

            val manager = AppWidgetManager.getInstance(context)
            if (com.google.firebase.FirebaseApp.getApps(context).isEmpty()) {
                com.google.firebase.FirebaseApp.initializeApp(context)
            }

            val prefs = context.getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
            val targetDate = prefs.getString("selected_date", null)
                ?: SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

            com.google.firebase.firestore.FirebaseFirestore.getInstance()
                .collection("users").document("flavio")
                .get()
                .addOnSuccessListener { doc ->
                    @Suppress("UNCHECKED_CAST")
                    val tasks = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
                    val active = tasks
                        .filter { task ->
                            val status = task["status"] as? String ?: ""
                            val deadline = task["deadline"] as? String ?: ""
                            status == "active" && deadline == targetDate
                        }
                        .sortedBy { it["deadline"] as? String ?: "9999" }

                    prefs.edit()
                        .putString("active_tasks", Gson().toJson(active.take(5)))
                        .apply()

                    updateWidget(context, manager, appWidgetId)
                }
        }
    }

    companion object {

        private val TASK_IDS = listOf(R.id.task_0, R.id.task_1, R.id.task_2, R.id.task_3, R.id.task_4)

        fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_tasks)

            val prefs = context.getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
            val todaySdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val today = todaySdf.format(Date())
            val selectedDate = prefs.getString("selected_date", null) ?: today

            // Tap titolo → apre app
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val openAppPendingIntent = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_title, openAppPendingIntent)

            // Tap data → apre SelectDateActivity
            val selectDateIntent = Intent(context, SelectDateActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            }
            val selectDatePendingIntent = PendingIntent.getActivity(
                context, appWidgetId + 1000, selectDateIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_date_selector, selectDatePendingIntent)

            // Tap refresh → ricarica da Firestore
            val refreshIntent = Intent(context, TaskWidgetProvider::class.java).apply {
                action = "com.flavio.glp.REFRESH_WIDGET"
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            }
            val refreshPendingIntent = PendingIntent.getBroadcast(
                context, appWidgetId, refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_refresh, refreshPendingIntent)

            // Mostra data selezionata
            val displaySdf = SimpleDateFormat("EEE d MMM", Locale.ITALIAN)
            val displayDate = try {
                val parsed = todaySdf.parse(selectedDate)!!
                if (selectedDate == today) "📅 Oggi" else "📅 ${displaySdf.format(parsed)}"
            } catch (e: Exception) {
                "📅 Oggi"
            }
            views.setTextViewText(R.id.widget_date_selector, displayDate)

            val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            views.setTextViewText(R.id.widget_updated, "Aggiornato: ${timeFormat.format(Date())}")

            // Legge task per la data selezionata
            val taskJson = prefs.getString("active_tasks", "[]") ?: "[]"
            val type = object : TypeToken<List<Map<String, Any>>>() {}.type
            val activeTasks: List<Map<String, Any>> = Gson().fromJson(taskJson, type) ?: emptyList()

            if (activeTasks.isEmpty()) {
                views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
                TASK_IDS.forEach { id -> views.setViewVisibility(id, View.GONE) }
            } else {
                views.setViewVisibility(R.id.widget_empty, View.GONE)
                activeTasks.take(5).forEachIndexed { index, task ->
                    val taskId = task["id"]?.toString() ?: ""
                    val name = task["title"] as? String ?: "Task"
                    val deadline = task["deadline"] as? String ?: ""
                    val reward = when (val r = task["reward"]) {
                        is Double -> r.toInt()
                        is Long -> r.toInt()
                        is Int -> r
                        else -> 0
                    }
                    val priority = task["priority"] as? String ?: "medium"
                    val icon = when (priority) { "high" -> "🔴"; "medium" -> "🟡"; else -> "🟢" }
                    val deadlineLabel = when {
                        deadline == today -> " ⚠️ oggi"
                        deadline.isNotEmpty() -> " · $deadline"
                        else -> ""
                    }
                    views.setTextViewText(TASK_IDS[index], "$icon $name +${reward}pt$deadlineLabel")
                    views.setViewVisibility(TASK_IDS[index], View.VISIBLE)

                    // Tap su task → apre CompleteTaskActivity (conferma completamento)
                    val completeIntent = Intent(context, CompleteTaskActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        putExtra("task_id", taskId)
                        putExtra("task_title", name)
                        putExtra("task_reward", reward.toDouble())
                    }
                    val completePi = PendingIntent.getActivity(
                        context,
                        appWidgetId * 10 + index,
                        completeIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(TASK_IDS[index], completePi)
                }
                for (i in activeTasks.size until 5) {
                    views.setViewVisibility(TASK_IDS[i], View.GONE)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
