package com.flavio.glp.wear

import android.content.ComponentName
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class MindfulState(val count: Int, val goal: Int)

/**
 * Momenti di consapevolezza: un tocco = un momento registrato oggi, con un
 * obiettivo giornaliero (default 3) mostrato come "1/3" su quadrante, Tile e hub.
 *
 * Dati su Firestore (users/flavio), stessi letti dalla web app (src/lib/mindful.js):
 *   mindfulLog.{YYYY-MM-DD} = ["HH:mm:ss", ...]   mindfulGoal = numero
 *
 * Il conteggio mostrato viene da una copia locale (SharedPreferences), NON da
 * una lettura Firestore: leggere users/flavio costa ~3 s di deserializzazione
 * anche dalla cache (vedi commento in GlpRepository), troppo per una
 * complicazione. La copia locale si aggiorna subito a ogni tocco e viene
 * riallineata al server da un listener quando l'app, la Tile o la schermata di
 * conferma sono attive (così entrano anche i momenti aggiunti da telefono/web).
 *
 * Offline (modalità aereo): il tocco funziona uguale, perché conteggio e
 * quadrante usano solo la copia locale. La scrittura resta nella coda su disco
 * di Firestore e PendingWritesWorker la spedisce da solo al ritorno della rete.
 */
object MindfulStore {

    const val DEFAULT_GOAL = 3
    private const val PREFS = "glp_mindful"

    private val _state = MutableStateFlow(MindfulState(0, DEFAULT_GOAL))
    val state: StateFlow<MindfulState> = _state

    @Volatile private var listener: ListenerRegistration? = null
    @Volatile private var lastAddAt = 0L

    private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun userRef() = FirebaseFirestore.getInstance().collection("users").document("flavio")

    fun times(ctx: Context): List<String> {
        val p = prefs(ctx)
        if (p.getString("date", "") != today()) return emptyList()
        return (p.getString("times", "") ?: "").split(',').filter { it.isNotBlank() }
    }

    fun count(ctx: Context) = times(ctx).size
    fun goal(ctx: Context) = prefs(ctx).getInt("goal", DEFAULT_GOAL).coerceAtLeast(1)

    // ─── Modifiche locali non ancora confermate dal server ────────────────────
    // Servono a due cose: (1) sapere se c'è qualcosa da spedire, (2) non farsi
    // sovrascrivere il tocco appena fatto da una lettura "vecchia" del
    // documento. Caso reale visto su Pixel Watch 5: il listener appena
    // agganciato consegna prima una fotografia calcolata PRIMA del tocco, e
    // senza questa lista il conteggio tornava indietro per qualche secondo
    // (3 → 2 → 3). Restano salvate su disco finché il server non conferma,
    // quindi sopravvivono anche alla chiusura del processo in modalità aereo.

    private fun pendingList(ctx: Context, key: String): List<String> {
        val p = prefs(ctx)
        if (p.getString("date", "") != today()) return emptyList()
        return (p.getString(key, "") ?: "").split(',').filter { it.isNotBlank() }
    }

    fun pendingAdds(ctx: Context) = pendingList(ctx, "pendingAdd")
    fun pendingRemoves(ctx: Context) = pendingList(ctx, "pendingRemove")

    private fun setPending(ctx: Context, adds: List<String>, removes: List<String>, localChange: Boolean = false) {
        prefs(ctx).edit()
            .apply { if (localChange) putLong("lastLocalChangeAt", System.currentTimeMillis()) }
            .putString("pendingAdd", adds.distinct().joinToString(","))
            .putString("pendingRemove", removes.distinct().joinToString(","))
            .putBoolean("dirty", adds.isNotEmpty() || removes.isNotEmpty())
            .apply()
    }

    /** true finché c'è almeno una modifica locale non ancora confermata dal server. */
    fun isDirty(ctx: Context) = pendingAdds(ctx).isNotEmpty() || pendingRemoves(ctx).isNotEmpty()

    /** Il server ha confermato (o rifiutato) queste modifiche: non sono più "in sospeso". */
    @Synchronized
    fun confirm(ctx: Context, adds: Collection<String> = emptyList(), removes: Collection<String> = emptyList()) {
        setPending(ctx, pendingAdds(ctx) - adds.toSet(), pendingRemoves(ctx) - removes.toSet())
    }

    fun isOnline(ctx: Context): Boolean {
        val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork ?: return false) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /** Allinea lo StateFlow (per Compose) alla copia locale, senza toccare le superfici. */
    fun refreshState(ctx: Context) {
        _state.value = MindfulState(count(ctx), goal(ctx))
    }

    private fun save(ctx: Context, list: List<String>, goal: Int? = null) {
        val newDay = prefs(ctx).getString("date", "") != today()
        prefs(ctx).edit().apply {
            putString("date", today())
            putString("times", list.distinct().sorted().joinToString(","))
            if (goal != null) putInt("goal", goal)
            // Giorno nuovo: le modifiche in sospeso di ieri non riguardano più
            // il conteggio di oggi (la loro scrittura resta comunque in coda).
            if (newDay) { putString("pendingAdd", ""); putString("pendingRemove", ""); putBoolean("dirty", false) }
        }.apply()
        refreshState(ctx)
        notifySurfaces(ctx)
    }

    /**
     * Registra un momento adesso. Ritorna l'orario salvato, o null se ignorato
     * (secondo tocco entro 1 s = doppio tocco accidentale).
     */
    @Synchronized
    fun add(ctx: Context): String? {
        val now = System.currentTimeMillis()
        if (now - lastAddAt < 1000) return null
        lastAddAt = now
        val time = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date())
        val list = times(ctx)
        if (time in list) return null
        save(ctx, list + time)
        setPending(ctx, pendingAdds(ctx) + time, pendingRemoves(ctx) - time, localChange = true)
        PendingWritesWorker.enqueue(ctx)
        val app = ctx.applicationContext
        // Offline la scrittura resta in coda (su disco) e parte da sola alla
        // riconnessione: nessuno dei due listener scatta finché il server non
        // risponde. Il rifiuto vero (es. non loggato) toglie il momento.
        userRef().update("mindfulLog.${today()}", FieldValue.arrayUnion(time))
            .addOnSuccessListener { confirm(app, adds = listOf(time)) }
            .addOnFailureListener { e ->
                android.util.Log.e("GLP_Mindful", "add failed: ${e.message}")
                confirm(app, adds = listOf(time))
                save(app, times(app) - time)
            }
        return time
    }

    @Synchronized
    fun remove(ctx: Context, time: String) {
        save(ctx, times(ctx) - time)
        setPending(ctx, pendingAdds(ctx) - time, pendingRemoves(ctx) + time, localChange = true)
        PendingWritesWorker.enqueue(ctx)
        val app = ctx.applicationContext
        userRef().update("mindfulLog.${today()}", FieldValue.arrayRemove(time))
            .addOnSuccessListener { confirm(app, removes = listOf(time)) }
            .addOnFailureListener { e ->
                android.util.Log.e("GLP_Mindful", "remove failed: ${e.message}")
                confirm(app, removes = listOf(time))
            }
    }

    @Synchronized
    private fun syncFromDoc(ctx: Context, doc: DocumentSnapshot) {
        val fromDoc = ((doc.get("mindfulLog") as? Map<*, *>)?.get(today()) as? List<*>)
            ?.map { it.toString() } ?: emptyList()
        // Il documento vale come base, ma i tocchi locali non ancora confermati
        // restano: aggiunte in più, rimozioni in meno.
        val merged = ((fromDoc + pendingAdds(ctx)).distinct() - pendingRemoves(ctx).toSet()).sorted()
        val goal = ((doc.get("mindfulGoal") as? Number)?.toInt() ?: DEFAULT_GOAL).coerceAtLeast(1)
        if (merged != times(ctx) || goal != goal(ctx)) save(ctx, merged, goal)

        // Conferma alternativa a quella del worker: se Firestore dice che per
        // questo documento non ha più scritture locali in attesa, tutto ciò
        // che era in sospeso è stato spedito (capita quando il processo è
        // stato chiuso prima della conferma e la coda si è svuotata dopo).
        // Si aspetta qualche secondo dall'ultimo tocco perché la prima
        // fotografia dopo un tocco può essere stata calcolata prima di esso.
        val quiet = System.currentTimeMillis() - prefs(ctx).getLong("lastLocalChangeAt", 0L) > 10_000
        if (quiet && !doc.metadata.hasPendingWrites() && isDirty(ctx)) setPending(ctx, emptyList(), emptyList())
    }

    /** Listener persistente (uno per processo) che riallinea la copia locale al server. */
    fun ensureListening(ctx: Context) {
        if (listener != null) return
        val app = ctx.applicationContext
        if (FirebaseApp.getApps(app).isEmpty()) FirebaseApp.initializeApp(app)
        if (FirebaseAuth.getInstance().currentUser == null) return
        listener = userRef().addSnapshotListener { doc, error ->
            if (error != null || doc == null || !doc.exists()) return@addSnapshotListener
            syncFromDoc(app, doc)
        }
    }

    /** Chiede a quadrante (complicazione) e Tile di ridisegnarsi col nuovo conteggio. */
    fun notifySurfaces(ctx: Context) {
        val app = ctx.applicationContext
        try {
            ComplicationDataSourceUpdateRequester
                .create(app, ComponentName(app, MindfulComplicationService::class.java))
                .requestUpdateAll()
        } catch (e: Exception) { android.util.Log.w("GLP_Mindful", "complication update: ${e.message}") }
        try {
            TileService.getUpdater(app).requestUpdate(MindfulTileService::class.java)
        } catch (e: Exception) { android.util.Log.w("GLP_Mindful", "tile update: ${e.message}") }
    }

    /** Vibrazione di conferma: un colpo per ogni momento, tre quando si raggiunge l'obiettivo. */
    fun vibrate(ctx: Context, reachedGoal: Boolean) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        val effect = if (reachedGoal) {
            VibrationEffect.createWaveform(longArrayOf(0, 70, 90, 70, 90, 140), -1)
        } else {
            VibrationEffect.createOneShot(70, VibrationEffect.DEFAULT_AMPLITUDE)
        }
        try { vibrator.vibrate(effect) } catch (e: Exception) { /* vibrazione non disponibile */ }
    }
}
