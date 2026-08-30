package com.flavio.glp

import android.app.Activity
import android.app.AlertDialog
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
// sistema (stessa UI di Google usata per la ricerca vocale, "Parla ora").
// Il testo dettato viene passato a VoiceDateParser per riconoscere una
// scadenza in linguaggio naturale ("...domani", "...tra 3 giorni", nome di
// un giorno della settimana) e ripulire il titolo dalla frase temporale.
// A differenza della versione precedente NON salva più in automatico: mostra
// un dialog di conferma con titolo e data già interpretati, così puoi
// controllare che il riconoscimento abbia capito bene prima di creare la
// task — un errore di trascrizione qui creerebbe una task sbagliata senza
// che te ne accorga finché non la rivedi nell'app.
class VoiceAddTaskActivity : Activity() {

    private val REQUEST_CODE_SPEECH = 1001
    // Guardia anti-doppio-invio: mancava su questo file — un doppio tap su
    // "OK, crea" prima che il dialog si chiudesse creava due task duplicate
    // (stesso bug per cui è stata aggiunta ovunque altrove in questa sessione).
    private var submitting = false

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
        val rawTitle = results?.firstOrNull()?.trim()
        if (rawTitle.isNullOrEmpty()) {
            Toast.makeText(this, "Non ho capito, riprova", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        val parsed = VoiceDateParser.parse(rawTitle)
        if (parsed.title.isEmpty()) {
            Toast.makeText(this, "Non ho capito il titolo, riprova", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        // Nessuna frase di data riconosciuta → stessa scelta di fallback di
        // QuickAddTaskActivity/AddTaskActivity: la data attualmente
        // selezionata nel widget lista, non sempre "oggi" a prescindere.
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val widgetPrefs = getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
        val deadline = parsed.deadline ?: (widgetPrefs.getString("selected_date", null) ?: today)

        showConfirmDialog(parsed.title, deadline)
    }

    // "Deve mostrarmi la task già impostata, io devo solo cliccare su OK" —
    // niente editor completo, solo titolo + data interpretati e due bottoni.
    private fun showConfirmDialog(title: String, deadline: String) {
        // Guardia anti-crash: il riconoscimento vocale è asincrono (activity
        // di sistema separata) — se nel frattempo l'utente ha premuto Home o
        // l'activity non è più in primo piano quando arriva il risultato,
        // aprire un AlertDialog qui lancerebbe BadTokenException ("token is
        // not valid; is your activity running?").
        if (isFinishing || isDestroyed) return
        val dateLabel = VoiceDateParser.formatDisplay(deadline)
        AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Conferma task")
            .setMessage("\"$title\"\n\n📅 Scadenza: $dateLabel")
            .setPositiveButton("OK, crea") { _, _ ->
                if (!submitting) {
                    submitting = true
                    saveTask(title, deadline)
                }
            }
            .setNegativeButton("Annulla") { _, _ -> finish() }
            .setOnCancelListener { finish() }
            .show()
    }

    private fun saveTask(title: String, deadline: String) {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        // Scadenza già passata (di norma non capita con le frasi riconosciute,
        // sempre relative a oggi in avanti, ma può succedere se non viene
        // riconosciuta nessuna data e si ricade sulla data selezionata nel
        // widget) → segnata scaduta subito, stessa logica di AddTaskActivity.
        val isPast = deadline < today
        val task = hashMapOf<String, Any>(
            "id" to "task_${System.currentTimeMillis()}",
            "title" to title,
            "deadline" to deadline,
            "reward" to 0.0,
            "penalty" to 0.0,
            "priority" to "medium",
            "status" to if (isPast) "expired" else "active",
            "rewardApplied" to false,
            "penaltyApplied" to isPast,
            "createdAt" to com.google.firebase.Timestamp.now()
        )
        if (isPast) {
            task["expiredAt"] = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                .apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())
        }

        // arrayUnion invece di get()+update(): un read-modify-write non atomico
        // qui perderebbe silenziosamente qualunque modifica concorrente a
        // "tasks" fatta da web/telefono/altro widget nella finestra tra le due
        // chiamate (stessa classe di bug della perdita dati del 28/8/2026,
        // anche se più circoscritta).
        val db = FirebaseFirestore.getInstance()
        val userRef = db.collection("users").document("flavio")

        // Ottimistico: chiude subito invece di aspettare la conferma di
        // Firestore. Offline la scrittura resta comunque in coda localmente e
        // si sincronizza da sola alla riconnessione — aspettare qui lasciava
        // l'activity bloccata a tempo indeterminato senza rete (bug reale
        // riscontrato sul widget "gemello" QuickAddTaskActivity).
        Toast.makeText(this, "✅ Task creata: $title", Toast.LENGTH_LONG).show()
        // Cache ottimistica del widget lista: solo se la scadenza coincide con
        // il giorno attualmente mostrato nel widget, altrimenti comparirebbe
        // nella lista sbagliata finché non arriva il prossimo refresh reale.
        val widgetPrefs = getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
        val selectedWidgetDate = widgetPrefs.getString("selected_date", null) ?: today
        if (!isPast && deadline == selectedWidgetDate) addTaskToWidgetPrefs(task)
        finish()

        userRef.update("tasks", FieldValue.arrayUnion(task))
            .addOnFailureListener {
                Toast.makeText(this, "Errore: ${it.message}", Toast.LENGTH_LONG).show()
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
