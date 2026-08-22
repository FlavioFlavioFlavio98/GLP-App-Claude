package com.flavio.glp

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.text.SimpleDateFormat
import java.util.*

class HabitsWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) updateWidget(context, appWidgetManager, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == "com.flavio.glp.REFRESH_HABITS") {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, HabitsWidgetProvider::class.java))
            ids.forEach { updateWidget(context, manager, it) }
        }
    }

    companion object {
        data class HabitRow(val rowId: Int, val nameId: Int, val doneId: Int, val failId: Int)

        private val habitRows = listOf(
            HabitRow(R.id.habit_row_0, R.id.habit_name_0, R.id.habit_done_0, R.id.habit_fail_0),
            HabitRow(R.id.habit_row_1, R.id.habit_name_1, R.id.habit_done_1, R.id.habit_fail_1),
            HabitRow(R.id.habit_row_2, R.id.habit_name_2, R.id.habit_done_2, R.id.habit_fail_2),
            HabitRow(R.id.habit_row_3, R.id.habit_name_3, R.id.habit_done_3, R.id.habit_fail_3),
            HabitRow(R.id.habit_row_4, R.id.habit_name_4, R.id.habit_done_4, R.id.habit_fail_4),
        )

        fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            android.util.Log.d("HabitsWidget", "updateWidget called for $appWidgetId")

            val views = RemoteViews(context.packageName, R.layout.widget_habits)
            val prefs = context.getSharedPreferences("glp_widget", Context.MODE_PRIVATE)

            val openApp = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val openPi = PendingIntent.getActivity(
                context, 0, openApp,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val refreshIntent = Intent(context, HabitsWidgetProvider::class.java).apply {
                action = "com.flavio.glp.REFRESH_HABITS"
            }
            val refreshPi = PendingIntent.getBroadcast(
                context, appWidgetId + 300, refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.habits_refresh, refreshPi)

            val time = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
            views.setTextViewText(R.id.habits_updated, "↻ $time")

            val json = prefs.getString("pending_habits", "[]") ?: "[]"
            android.util.Log.d("HabitsWidget", "pending_habits json length: ${json.length}")

            val type = object : TypeToken<List<Map<String, Any>>>() {}.type
            val habits: List<Map<String, Any>> = try {
                Gson().fromJson(json, type) ?: emptyList()
            } catch (e: Exception) {
                android.util.Log.e("HabitsWidget", "JSON parse error: ${e.message}")
                emptyList()
            }

            android.util.Log.d("HabitsWidget", "Habits count: ${habits.size}")
            views.setTextViewText(R.id.habits_count, "${habits.size} rimaste")

            if (habits.isEmpty()) {
                views.setViewVisibility(R.id.habits_empty, View.VISIBLE)
                habitRows.forEach { views.setViewVisibility(it.rowId, View.GONE) }
            } else {
                views.setViewVisibility(R.id.habits_empty, View.GONE)

                habits.take(5).forEachIndexed { index, habit ->
                    val row = habitRows[index]
                    val habitId = habit["id"]?.toString() ?: return@forEachIndexed
                    val name = habit["name"] as? String ?: "Abitudine"
                    val reward = (habit["reward"] as? Double)
                        ?: (habit["reward"] as? Long)?.toDouble() ?: 0.0
                    val penalty = (habit["penalty"] as? Double)
                        ?: (habit["penalty"] as? Long)?.toDouble() ?: 0.0
                    val importance = habit["importance"] as? String ?: "medium"
                    val icon = when (importance) { "high" -> "🔴"; "low" -> "🟢"; else -> "🟡" }

                    views.setViewVisibility(row.rowId, View.VISIBLE)
                    views.setTextViewText(row.nameId, "$icon $name  +${reward.toInt()}pt")

                    val doneIntent = Intent(context, HabitActionService::class.java).apply {
                        putExtra("habit_id", habitId)
                        putExtra("action", "done")
                        putExtra("reward", reward)
                        putExtra("penalty", penalty)
                        putExtra("widget_id", appWidgetId)
                    }
                    val donePi = PendingIntent.getService(
                        context, appWidgetId * 100 + index * 2, doneIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(row.doneId, donePi)

                    val failIntent = Intent(context, HabitActionService::class.java).apply {
                        putExtra("habit_id", habitId)
                        putExtra("action", "fail")
                        putExtra("reward", reward)
                        putExtra("penalty", penalty)
                        putExtra("widget_id", appWidgetId)
                    }
                    val failPi = PendingIntent.getService(
                        context, appWidgetId * 100 + index * 2 + 1, failIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(row.failId, failPi)
                }

                for (i in habits.size until 5) {
                    views.setViewVisibility(habitRows[i].rowId, View.GONE)
                }
            }

            android.util.Log.d("HabitsWidget", "Calling updateAppWidget")
            appWidgetManager.updateAppWidget(appWidgetId, views)
            android.util.Log.d("HabitsWidget", "updateAppWidget completed")
        }
    }
}
