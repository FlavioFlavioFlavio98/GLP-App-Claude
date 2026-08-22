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

            getSharedPreferences("glp_widget", MODE_PRIVATE)
                .edit()
                .putString("selected_date", selected)
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
                    val filtered = tasks
                        .filter { it["status"] == "active" && it["deadline"] as? String == selected }
                        .sortedBy { it["deadline"] as? String ?: "" }

                    getSharedPreferences("glp_widget", MODE_PRIVATE)
                        .edit()
                        .putString("active_tasks", com.google.gson.Gson().toJson(filtered.take(5)))
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
