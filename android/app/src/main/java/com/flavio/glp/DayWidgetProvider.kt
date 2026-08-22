package com.flavio.glp

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.*

class DayWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) updateWidget(context, appWidgetManager, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == "com.flavio.glp.REFRESH_DAY_WIDGET") {
            val appWidgetId = intent.getIntExtra(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            )
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId)
            }
        }
    }

    companion object {

        // Applica un delta ottimistico alle SharedPreferences del widget giornaliero
        // e aggiorna immediatamente tutti i DayWidget visibili.
        fun applyDelta(
            context: Context,
            earnedDelta: Int = 0,
            spentDelta: Int = 0,
            extraEarnedDelta: Int = 0,
            taskEarnedDelta: Int = 0,
            penaltyDelta: Int = 0,
            tasksSpentDelta: Int = 0
        ) {
            val prefs = context.getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
            val newEarned = (prefs.getInt("day_earned_int", 0) + earnedDelta).coerceAtLeast(0)
            val newSpent  = (prefs.getInt("day_spent_int", 0)  + spentDelta).coerceAtLeast(0)
            prefs.edit()
                .putInt("day_earned_int",    newEarned)
                .putInt("day_spent_int",     newSpent)
                .putInt("day_net_int",       newEarned - newSpent)
                .putInt("day_extra_earned",  (prefs.getInt("day_extra_earned", 0)  + extraEarnedDelta).coerceAtLeast(0))
                .putInt("day_tasks_earned",  (prefs.getInt("day_tasks_earned", 0)  + taskEarnedDelta).coerceAtLeast(0))
                .putInt("day_penalty_spent", (prefs.getInt("day_penalty_spent", 0) + penaltyDelta).coerceAtLeast(0))
                .putInt("day_tasks_spent",   (prefs.getInt("day_tasks_spent", 0)   + tasksSpentDelta).coerceAtLeast(0))
                .apply()
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, DayWidgetProvider::class.java))
            ids.forEach { updateWidget(context, manager, it) }
        }

        fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_day)
            val prefs = context.getSharedPreferences("glp_widget", Context.MODE_PRIVATE)

            val earned = prefs.getInt("day_earned_int", -999)
            val spent = prefs.getInt("day_spent_int", -999)
            val net = prefs.getInt("day_net_int", -999)
            val habitsEarned = prefs.getInt("day_habits_earned", 0)
            val extraEarned = prefs.getInt("day_extra_earned", 0)
            val tasksEarned = prefs.getInt("day_tasks_earned", 0)
            val penaltySpent = prefs.getInt("day_penalty_spent", 0)
            val tasksSpent = prefs.getInt("day_tasks_spent", 0)

            android.util.Log.d("GLPWidget", "DayWidget reading: earned=$earned spent=$spent net=$net habits=$habitsEarned extra=$extraEarned tasks=$tasksEarned penalty=$penaltySpent tasksSpent=$tasksSpent")

            val netSign = if (net >= 0) "+" else ""
            views.setTextViewText(R.id.day_net, "${netSign}${net}pt")
            views.setTextViewText(R.id.day_earned, "+${earned}pt")
            views.setTextViewText(R.id.day_spent, "-${spent}pt")

            // Riga dettaglio guadagni: mostra la fonte con valore maggiore, o più voci
            val earnedDetail = buildString {
                val sources = mutableListOf<Pair<String, Int>>()
                if (habitsEarned > 0) sources += "Abitudini" to habitsEarned
                if (tasksEarned > 0) sources += "Task" to tasksEarned
                if (extraEarned > 0) sources += "Extra" to extraEarned
                sources.sortByDescending { it.second }
                when {
                    sources.isEmpty() -> append("")
                    sources.size == 1 -> append("${sources[0].first} +${sources[0].second}pt")
                    else -> {
                        // Prima voce per esteso, poi solo nomi delle altre
                        append("${sources[0].first} +${sources[0].second}pt")
                        sources.drop(1).forEach { append(", ${it.first}") }
                    }
                }
            }
            views.setTextViewText(R.id.day_earned_detail, earnedDetail)

            // Riga dettaglio costi: voce con valore maggiore
            val spentDetail = buildString {
                val sources = mutableListOf<Pair<String, Int>>()
                if (penaltySpent > 0) sources += "Penalità" to penaltySpent
                if (tasksSpent > 0) sources += "Task scad." to tasksSpent
                sources.sortByDescending { it.second }
                when {
                    sources.isEmpty() -> append("")
                    sources.size == 1 -> append("${sources[0].first} -${sources[0].second}pt")
                    else -> {
                        append("${sources[0].first} -${sources[0].second}pt")
                        sources.drop(1).forEach { append(", ${it.first}") }
                    }
                }
            }
            views.setTextViewText(R.id.day_spent_detail, spentDetail)

            // Mantieni aggiornati gli ID nascosti per compatibilità
            views.setTextViewText(R.id.day_habits_row, "Abitudini  +${habitsEarned}pt")
            views.setTextViewText(R.id.day_extra_row, "Extra  +${extraEarned}pt")
            views.setTextViewText(R.id.day_tasks_row_earned, "Task  +${tasksEarned}pt")
            views.setTextViewText(R.id.day_penalty_row, "Penalità  -${penaltySpent}pt")
            views.setTextViewText(R.id.day_tasks_row, "Task scad.  -${tasksSpent}pt")

            val time = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
            views.setTextViewText(R.id.day_updated, time)

            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val launchPi = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.day_net, launchPi)

            val refreshIntent = Intent(context, DayWidgetProvider::class.java).apply {
                action = "com.flavio.glp.REFRESH_DAY_WIDGET"
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            }
            val refreshPi = PendingIntent.getBroadcast(
                context, appWidgetId + 100, refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.day_refresh, refreshPi)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
