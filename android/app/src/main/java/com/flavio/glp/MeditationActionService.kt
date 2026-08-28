package com.flavio.glp

import android.app.Service
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.IBinder
import android.widget.Toast
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
import java.util.*

// Tap sul widget 1x1 meditazione → un momento loggato all'istante, nessuna UI
// (stesso pattern di HabitActionService per il tap done/fail sul widget
// abitudini): scrive subito su Firestore in background e aggiorna la cache
// locale per il conteggio "oggi" mostrato sul widget stesso.
class MeditationActionService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        // Punti fissi a 1 lato nativo: il tasso personalizzabile (ActivityRateEditor)
        // vive solo in localStorage della web app, non sincronizzato su Firestore —
        // qui si usa il default (vedi DEFAULT_MEDITATION_RATE in meditationStats.js).
        val rate = 1.0
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

        val entry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "pts" to rate,
            "time" to SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        )

        val userRef = FirebaseFirestore.getInstance().collection("users").document("flavio")
        userRef.update(
            "meditationLog.$today", FieldValue.arrayUnion(entry),
            "score", FieldValue.increment(rate)
        ).addOnCompleteListener {
            Toast.makeText(this, "🧘 Momento registrato! +${rate.toInt()}pt", Toast.LENGTH_SHORT).show()
            refreshWidgetCount(today)
        }.addOnFailureListener {
            Toast.makeText(this, "Errore, riprova", Toast.LENGTH_SHORT).show()
            stopSelf()
        }

        return START_NOT_STICKY
    }

    private fun refreshWidgetCount(today: String) {
        FirebaseFirestore.getInstance().collection("users").document("flavio").get()
            .addOnSuccessListener { doc ->
                @Suppress("UNCHECKED_CAST")
                val meditationLog = doc.get("meditationLog") as? Map<String, Any> ?: emptyMap()
                val todayEntries = meditationLog[today] as? List<*> ?: emptyList<Any>()

                getSharedPreferences("glp_widget", MODE_PRIVATE).edit()
                    .putInt("meditation_count_today", todayEntries.size)
                    .apply()

                val manager = AppWidgetManager.getInstance(this)
                val ids = manager.getAppWidgetIds(ComponentName(this, MeditationWidgetProvider::class.java))
                ids.forEach { MeditationWidgetProvider.updateWidget(this, manager, it) }
            }
            .addOnCompleteListener { stopSelf() }
    }
}
