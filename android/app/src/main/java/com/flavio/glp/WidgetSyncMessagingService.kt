package com.flavio.glp

import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

// Push FCM "silenzioso" (solo dati, mai una notifica visibile) per svegliare
// i widget home-screen appena qualcosa cambia su Firestore da un altro
// device (watch, web, altro telefono) — vedi syncWidgetsOnUserDataChange in
// Cloud Functions. Senza questo, i widget si aggiornano solo aprendo l'app,
// premendo il refresh manuale, o al ciclo periodico WidgetUpdateWorker
// (minimo 15 minuti, limite imposto da Android su WorkManager).
class WidgetSyncMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        saveToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        if (message.data["type"] == "widget_sync") {
            WorkManager.getInstance(applicationContext)
                .enqueue(OneTimeWorkRequestBuilder<WidgetUpdateWorker>().build())
        }
    }

    private fun saveToken(token: String) {
        // Se l'utente non ha ancora fatto login la scrittura fallisce (regole
        // Firestore) — non è un problema, verrà ritentata al prossimo avvio
        // dell'app tramite registerTokenIfNeeded() in MainActivity.
        FirebaseFirestore.getInstance()
            .collection("users").document("flavio")
            .collection("fcmTokens").document(token)
            .set(mapOf("platform" to "android", "updatedAt" to System.currentTimeMillis()))
    }

    companion object {
        // Chiamata dopo un login riuscito (MainActivity) per assicurarsi che il
        // token corrente sia salvato anche se onNewToken era scattato prima
        // dell'autenticazione (es. al primo avvio dell'app).
        fun registerTokenIfNeeded() {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token ->
                    FirebaseFirestore.getInstance()
                        .collection("users").document("flavio")
                        .collection("fcmTokens").document(token)
                        .set(mapOf("platform" to "android", "updatedAt" to System.currentTimeMillis()))
                }
        }
    }
}
