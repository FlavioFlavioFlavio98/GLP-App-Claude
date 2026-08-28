package com.flavio.glp

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.widget.Toast
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
import java.util.*

// Tap sul widget 1x1 "detta task" → apre subito il riconoscimento vocale di
// sistema (stessa UI di Google usata per la ricerca vocale, "Parla ora") e
// appena finisci di parlare salva la task in automatico col testo dettato
// come titolo — nessun tocco extra, pensata per quando hai le mani occupate.
// Nessun layout proprio: l'unica UI visibile è quella di sistema.
class VoiceAddTaskActivity : Activity() {

    private val REQUEST_CODE_SPEECH = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Detta la task...")
        }

        try {
            startActivityForResult(intent, REQUEST_CODE_SPEECH)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "Riconoscimento vocale non disponibile su questo dispositivo", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_CODE_SPEECH) { finish(); return }

        if (resultCode != RESULT_OK) {
            // Annullato o nessun match — niente task vuote silenziose
            finish()
            return
        }

        val results = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
        val title = results?.firstOrNull()?.trim()
        if (title.isNullOrEmpty()) {
            Toast.makeText(this, "Non ho capito, riprova", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        saveTask(title)
    }

    private fun saveTask(title: String) {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val widgetPrefs = getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
        val deadline = widgetPrefs.getString("selected_date", null) ?: today

        val task = hashMapOf(
            "id" to "task_${System.currentTimeMillis()}",
            "title" to title,
            "deadline" to deadline,
            "reward" to 0.0,
            "penalty" to 0.0,
            "priority" to "medium",
            "status" to "active",
            "rewardApplied" to false,
            "penaltyApplied" to false,
            "createdAt" to com.google.firebase.Timestamp.now()
        )

        // arrayUnion invece di get()+update(): un read-modify-write non atomico
        // qui perderebbe silenziosamente qualunque modifica concorrente a
        // "tasks" fatta da web/telefono/altro widget nella finestra tra le due
        // chiamate (stessa classe di bug della perdita dati del 28/8/2026,
        // anche se più circoscritta).
        val db = FirebaseFirestore.getInstance()
        val userRef = db.collection("users").document("flavio")
        userRef.update("tasks", FieldValue.arrayUnion(task))
            .addOnSuccessListener {
                Toast.makeText(this, "✅ Task creata: $title", Toast.LENGTH_LONG).show()
                addTaskToWidgetPrefs(task)
                finish()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Errore: ${it.message}", Toast.LENGTH_LONG).show()
                finish()
            }
    }

    // Aggiornamento ottimistico, stesso pattern di QuickAddTaskActivity: la
    // task appena creata ha deadline uguale alla data selezionata nel widget
    // lista, quindi va aggiunta subito alla cache locale.
    private fun addTaskToWidgetPrefs(task: Map<String, Any>) {
        val prefs = getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
        val json = prefs.getString("active_tasks", "[]") ?: "[]"
        val type = object : com.google.gson.reflect.TypeToken<MutableList<Map<String, Any>>>() {}.type
        val current: MutableList<Map<String, Any>> = try {
            com.google.gson.Gson().fromJson(json, type) ?: mutableListOf()
        } catch (e: Exception) { mutableListOf() }
        current.add(task)
        prefs.edit().putString("active_tasks", com.google.gson.Gson().toJson(current.take(TaskWidgetProvider.MAX_ROWS))).apply()

        val manager = AppWidgetManager.getInstance(this)
        val ids = manager.getAppWidgetIds(ComponentName(this, TaskWidgetProvider::class.java))
        ids.forEach { TaskWidgetProvider.updateWidget(this, manager, it) }
    }
}
