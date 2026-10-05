package com.flavio.glp.wear

import android.content.Context
import android.os.Build
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * Rete di sicurezza per l'uso offline (modalità aereo, telefono lontano).
 *
 * Una scrittura fatta senza rete NON va persa: Firestore la tiene in una coda
 * su disco e la spedisce quando il suo client è attivo con la rete disponibile.
 * Il punto debole è "quando il client è attivo": se registri un momento dal
 * quadrante in aereo e poi non riapri più l'app, il processo viene chiuso dal
 * sistema e la coda resterebbe ferma fino al prossimo utilizzo.
 *
 * Questo worker chiude il buco: WorkManager lo fa partire da solo appena il
 * watch ha di nuovo una connessione (anche dopo un riavvio), riaccende il
 * client Firestore e aspetta che tutta la coda sia stata confermata dal
 * server. Vale per ogni scrittura in coda, non solo per i momenti di
 * consapevolezza.
 */
class PendingWritesWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext
        if (FirebaseApp.getApps(app).isEmpty()) FirebaseApp.initializeApp(app)
        // Senza login il server rifiuterebbe comunque: si riprova al prossimo
        // utilizzo (ogni nuova scrittura rimette in coda questo worker).
        if (FirebaseAuth.getInstance().currentUser == null) return Result.success()
        return try {
            // Fotografia PRIMA dell'attesa: si confermano solo le modifiche già
            // in coda adesso, non un tocco arrivato mentre si aspettava.
            val adds = MindfulStore.pendingAdds(app)
            val removes = MindfulStore.pendingRemoves(app)
            withContext(Dispatchers.IO) {
                Tasks.await(FirebaseFirestore.getInstance().waitForPendingWrites(), 25, TimeUnit.SECONDS)
            }
            MindfulStore.confirm(app, adds, removes)
            android.util.Log.d(TAG, "pending writes flushed (attempt $runAttemptCount)")
            Result.success()
        } catch (e: Exception) {
            android.util.Log.w(TAG, "flush not completed (attempt $runAttemptCount): ${e.javaClass.simpleName}")
            if (runAttemptCount < 30) Result.retry() else Result.failure()
        }
    }

    companion object {
        private const val TAG = "GLP_Sync"
        private const val UNIQUE_NAME = "glp_pending_writes"

        /**
         * Da chiamare dopo una scrittura. REPLACE e non KEEP: waitForPendingWrites
         * copre solo le scritture già in coda al momento della chiamata, quindi
         * un worker già partito non "vedrebbe" quella appena aggiunta.
         */
        fun enqueue(ctx: Context) {
            val request = OneTimeWorkRequestBuilder<PendingWritesWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.LINEAR, 30, TimeUnit.SECONDS)
                .apply {
                    // Lavoro "prioritario": a schermo spento il watch entra in
                    // risparmio energetico (Doze) e blocca la rete ai lavori
                    // normali anche per molto tempo — visto su Pixel Watch 5,
                    // con un annullamento rimasto in coda oltre un minuto. I
                    // lavori prioritari hanno la rete anche in Doze; finita la
                    // quota giornaliera tornano lavori normali. (Sotto Android
                    // 12 servirebbe una notifica: lì resta un lavoro normale.)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                    }
                }
                .build()
            try {
                WorkManager.getInstance(ctx.applicationContext)
                    .enqueueUniqueWork(UNIQUE_NAME, ExistingWorkPolicy.REPLACE, request)
            } catch (e: Exception) {
                android.util.Log.w(TAG, "enqueue failed: ${e.message}")
            }
        }
    }
}
