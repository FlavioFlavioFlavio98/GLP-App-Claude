package com.flavio.glp

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Paint
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
            val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val targetDate = prefs.getString("selected_date", null) ?: today

            com.google.firebase.firestore.FirebaseFirestore.getInstance()
                .collection("users").document("flavio")
                .get()
                .addOnSuccessListener { doc ->
                    @Suppress("UNCHECKED_CAST")
                    val tasks = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
                    val active = TaskWidgetUtils.activeTasksForDate(tasks, targetDate, today)
                    val completed = TaskWidgetUtils.completedTasksForDate(tasks, targetDate)

                    prefs.edit()
                        .putString("active_tasks", Gson().toJson(active.take(MAX_ROWS)))
                        .putString("completed_tasks_widget", Gson().toJson(completed.take(MAX_ROWS)))
                        .apply()

                    updateWidget(context, manager, appWidgetId)
                }
        }
    }

    companion object {

        const val MAX_ROWS = 12
        private val ROW_IDS  = listOf(R.id.task_row_0, R.id.task_row_1, R.id.task_row_2, R.id.task_row_3, R.id.task_row_4, R.id.task_row_5, R.id.task_row_6, R.id.task_row_7, R.id.task_row_8, R.id.task_row_9, R.id.task_row_10, R.id.task_row_11)
        private val DOT_IDS  = listOf(R.id.task_dot_0, R.id.task_dot_1, R.id.task_dot_2, R.id.task_dot_3, R.id.task_dot_4, R.id.task_dot_5, R.id.task_dot_6, R.id.task_dot_7, R.id.task_dot_8, R.id.task_dot_9, R.id.task_dot_10, R.id.task_dot_11)
        private val NAME_IDS = listOf(R.id.task_0, R.id.task_1, R.id.task_2, R.id.task_3, R.id.task_4, R.id.task_5, R.id.task_6, R.id.task_7, R.id.task_8, R.id.task_9, R.id.task_10, R.id.task_11)
        private val META_IDS = listOf(R.id.task_meta_0, R.id.task_meta_1, R.id.task_meta_2, R.id.task_meta_3, R.id.task_meta_4, R.id.task_meta_5, R.id.task_meta_6, R.id.task_meta_7, R.id.task_meta_8, R.id.task_meta_9, R.id.task_meta_10, R.id.task_meta_11)

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

            // Tap "+" → aggiunta rapida stile Google Tasks (solo titolo, nessun altro dettaglio)
            val quickAddIntent = Intent(context, QuickAddTaskActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val quickAddPi = PendingIntent.getActivity(
                context, appWidgetId + 2000, quickAddIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_quick_add, quickAddPi)

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

            // Legge task attive/scadute per la data selezionata. Le completate
            // NON occupano più righe singole: senza scroll (RemoteViews non lo
            // supporta) riempivano tutto lo spazio visibile e nascondevano le
            // task ancora da fare — ora solo un conteggio riassuntivo in fondo.
            val type = object : TypeToken<List<Map<String, Any>>>() {}.type
            val activeTasks: List<Map<String, Any>> =
                Gson().fromJson(prefs.getString("active_tasks", "[]") ?: "[]", type) ?: emptyList()
            val completedTasks: List<Map<String, Any>> =
                Gson().fromJson(prefs.getString("completed_tasks_widget", "[]") ?: "[]", type) ?: emptyList()

            if (completedTasks.isEmpty()) {
                views.setViewVisibility(R.id.widget_completed_summary, View.GONE)
            } else {
                views.setViewVisibility(R.id.widget_completed_summary, View.VISIBLE)
                views.setTextViewText(R.id.widget_completed_summary, "✓ ${completedTasks.size} completat${if (completedTasks.size == 1) "a" else "e"}")
                views.setOnClickPendingIntent(R.id.widget_completed_summary, openAppPendingIntent)
            }

            val rows = activeTasks.take(MAX_ROWS)

            if (rows.isEmpty()) {
                views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
                ROW_IDS.forEach { id -> views.setViewVisibility(id, View.GONE) }
            } else {
                views.setViewVisibility(R.id.widget_empty, View.GONE)
                rows.forEachIndexed { index, task ->
                    val taskId = task["id"]?.toString() ?: ""
                    val name = task["title"] as? String ?: "Task"
                    val reward = when (val r = task["reward"]) {
                        is Double -> r.toInt()
                        is Long -> r.toInt()
                        is Int -> r
                        else -> 0
                    }
                    val penalty = when (val p = task["penalty"]) {
                        is Double -> p.toInt()
                        is Long -> p.toInt()
                        is Int -> p
                        else -> 0
                    }
                    val priority = task["priority"] as? String ?: "medium"
                    val taskDeadline = task["deadline"] as? String ?: today
                    // Task scadute (penalità già applicata a mezzanotte, mai
                    // completate) restano visibili nel widget invece di
                    // sparire — vedi TaskWidgetUtils.activeTasksForDate.
                    val isExpired = (task["status"] as? String) == "expired"

                    // Scaduta: trattata come una task normale a livello visivo (nome
                    // bianco, pallino del colore della priorità) — l'unico indicatore
                    // è la piccola scritta "SCADUTA" in rosso a destra, niente più
                    // "rosso allarme" diffuso su testo/pallino.
                    views.setTextViewText(NAME_IDS[index], name)
                    views.setInt(NAME_IDS[index], "setPaintFlags", Paint.ANTI_ALIAS_FLAG)
                    views.setTextColor(NAME_IDS[index], android.graphics.Color.WHITE)

                    // Niente data nel meta: il widget è già filtrato per la data
                    // selezionata sopra, quindi è ridondante ripeterla per ogni riga.
                    val meta = if (isExpired) "SCADUTA -${penalty}pt" else "+${reward}pt"
                    views.setTextViewText(META_IDS[index], meta)
                    views.setTextColor(
                        META_IDS[index],
                        android.graphics.Color.parseColor(if (isExpired) "#EB5757" else "#777777")
                    )

                    // Cerchietto sempre colorato in base alla priorità (stesso schema
                    // colori di taskColors.js sul web: alta/media/bassa = rosso/arancio/blu),
                    // anche per le scadute — l'avviso è solo nel testo "SCADUTA".
                    val priorityColor = when (priority) {
                        "high" -> "#EB5757"
                        "low"  -> "#4A90D9"
                        else   -> "#F2994A" // medium
                    }
                    views.setImageViewResource(DOT_IDS[index], R.drawable.circle_ring)
                    views.setInt(DOT_IDS[index], "setColorFilter", android.graphics.Color.parseColor(priorityColor))

                    views.setViewVisibility(ROW_IDS[index], View.VISIBLE)

                    // Tap sul nome (o sui punti) → apre la task in modifica, con
                    // tutti i dettagli pre-compilati. Tap sul cerchietto → completa,
                    // con dialog di conferma (mai un'azione distruttiva a un tap solo).
                    val editIntent = Intent(context, AddTaskActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        putExtra("edit_task_id", taskId)
                        putExtra("edit_title", name)
                        putExtra("edit_priority", priority)
                        putExtra("edit_reward", reward)
                        putExtra("edit_penalty", penalty)
                        putExtra("edit_deadline", taskDeadline)
                    }
                    val editPi = PendingIntent.getActivity(
                        context, appWidgetId * 100 + index, editIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(NAME_IDS[index], editPi)
                    views.setOnClickPendingIntent(META_IDS[index], editPi)

                    // Tap sul cerchietto → apre CompleteTaskActivity (conferma completamento)
                    // — funziona anche per le scadute: si può ancora completarla in ritardo
                    // e prendere la ricompensa, la penalità resta comunque applicata.
                    val completeIntent = Intent(context, CompleteTaskActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        putExtra("task_id", taskId)
                        putExtra("task_title", name)
                        putExtra("task_reward", reward.toDouble())
                        putExtra("task_priority", priority)
                    }
                    val completePi = PendingIntent.getActivity(
                        context,
                        appWidgetId * 10 + index,
                        completeIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    views.setOnClickPendingIntent(DOT_IDS[index], completePi)
                }
                for (i in rows.size until MAX_ROWS) {
                    views.setViewVisibility(ROW_IDS[i], View.GONE)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
