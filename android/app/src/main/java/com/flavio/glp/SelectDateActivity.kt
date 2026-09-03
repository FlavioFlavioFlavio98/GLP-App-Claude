package com.flavio.glp

import android.app.Activity
import android.app.DatePickerDialog
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Bundle
import java.text.SimpleDateFormat
import java.util.*

class SelectDateActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val cal = Calendar.getInstance()
        DatePickerDialog(this, { _, y, m, d ->
            val selected = String.format("%04d-%02d-%02d", y, m + 1, d)

            // selected_date_set_at: usato da TaskWidgetUtils.resolveSelectedDate
            // per riportare da solo la data a "oggi" dopo un'ora, se te ne
            // dimentichi — vedi il commento lì.
            getSharedPreferences("glp_widget", MODE_PRIVATE)
                .edit()
                .putString("selected_date", selected)
                .putLong("selected_date_set_at", System.currentTimeMillis())
                .apply()

            if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
                com.google.firebase.FirebaseApp.initializeApp(this)
            }

            com.google.firebase.firestore.FirebaseFirestore.getInstance()
                .collection("users").document("flavio")
                .get()
                .addOnSuccessListener { doc ->
                    @Suppress("UNCHECKED_CAST")
                    val tasks = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
                    val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                    // Stesso filtro condiviso di TaskWidgetProvider/WidgetUpdateWorker
                    // (TaskWidgetUtils) invece di reimplementarlo qui in modo
                    // incompleto — la versione precedente non includeva le task
                    // scadute su "oggi", non ordinava per priorità, limitava a 5
                    // righe invece di MAX_ROWS e non scriveva mai il riepilogo
                    // "completate", lasciando quello del giorno precedente in
                    // cache dopo aver cambiato data dal selettore.
                    val active = TaskWidgetUtils.activeTasksForDate(tasks, selected, today)
                    val completed = TaskWidgetUtils.completedTasksForDate(tasks, selected)

                    getSharedPreferences("glp_widget", MODE_PRIVATE)
                        .edit()
                        .putString("active_tasks", com.google.gson.Gson().toJson(active.take(TaskWidgetProvider.MAX_ROWS)))
                        .putString("completed_tasks_widget", com.google.gson.Gson().toJson(completed.take(TaskWidgetProvider.MAX_ROWS)))
                        .apply()

                    val manager = AppWidgetManager.getInstance(this)
                    val ids = manager.getAppWidgetIds(ComponentName(this, TaskWidgetProvider::class.java))
                    ids.forEach { TaskWidgetProvider.updateWidget(this, manager, it) }
                    finish()
                }
                .addOnFailureListener { finish() }
        }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).apply {
            setOnCancelListener { finish() }
            show()
        }
    }
}
