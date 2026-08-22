package com.flavio.glp

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

class FitSyncService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        const val TAG = "FitSync"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.getStringExtra("action") ?: "sync_all"
        Log.d(TAG, "FitSyncService started — action: $action")

        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        val fitManager = GoogleFitManager(this)
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val db = FirebaseFirestore.getInstance()

        serviceScope.launch {
            try {
                if (!fitManager.isAvailable()) {
                    Log.w(TAG, "Health Connect non disponibile")
                    stopSelf()
                    return@launch
                }

                if (!fitManager.isAuthorizedSuspend()) {
                    Log.w(TAG, "Health Connect non autorizzato")
                    stopSelf()
                    return@launch
                }

                when (action) {
                    "sync_steps" -> {
                        val steps = fitManager.readTodaySteps()
                        saveHealthData(db, today, "steps", steps.toDouble())
                    }
                    "sync_sleep" -> {
                        val hours = fitManager.readLastNightSleepHours()
                        saveHealthData(db, today, "sleepHours", hours.toDouble())
                    }
                    else -> {
                        val steps = fitManager.readTodaySteps()
                        saveHealthData(db, today, "steps", steps.toDouble())
                        val hours = fitManager.readLastNightSleepHours()
                        saveHealthData(db, today, "sleepHours", hours.toDouble())
                    }
                }
                Log.d(TAG, "Sync completato — stopSelf")
                stopSelf()
            } catch (e: Exception) {
                Log.e(TAG, "Sync error: ${e.javaClass.simpleName}: ${e.message}", e)
                stopSelf()
            }
        }

        return START_NOT_STICKY
    }

    private suspend fun saveHealthData(db: FirebaseFirestore, today: String, field: String, value: Double) {
        Log.d(TAG, "Saving healthData.$today.$field = $value")
        suspendCancellableCoroutine<Unit> { cont ->
            db.collection("users").document("flavio")
                .set(
                    mapOf("healthData" to mapOf(
                        today to mapOf(
                            field to value,
                            "syncedAt" to com.google.firebase.Timestamp.now()
                        )
                    )),
                    SetOptions.merge()
                )
                .addOnSuccessListener {
                    Log.d(TAG, "Saved $field=$value successfully")
                    cont.resume(Unit) {}
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Failed to save $field: ${e.message}")
                    cont.resume(Unit) {}
                }
        }
    }

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }
}
