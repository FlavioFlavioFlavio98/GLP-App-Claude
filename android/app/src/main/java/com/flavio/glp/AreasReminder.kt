package com.flavio.glp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

/**
 * Promemoria serale della tab Aree: ogni giorno all'orario scelto (default 19:45,
 * fuso Europe/Sofia = ora Bulgaria, indipendente dal fuso del telefono) controlla
 * su Firestore quali aree non hanno ancora nessuna voce oggi e, se ne manca
 * almeno una, mostra una notifica che apre la tab Aree.
 *
 * Allarme singolo (non ripetuto) riprogrammato a ogni scatto: setExactAndAllowWhileIdle
 * quando il permesso di allarme esatto c'è (USE_EXACT_ALARM / SCHEDULE_EXACT_ALARM),
 * altrimenti setWindow con finestra di 10 minuti — mai setInexactRepeating, che può
 * ritardare anche di ore.
 */
object AreasReminder {

    const val TYPE = "areas"
    private const val REQ_DAILY = 2004
    private const val REQ_TEST = 2005
    private const val PREFS = "glp_notifications"
    private const val TAG = "GLP_Notif"
    val ZONE: ZoneId = ZoneId.of("Europe/Sofia")

    const val DEFAULT_HOUR = 19
    const val DEFAULT_MINUTE = 45

    fun isEnabled(ctx: Context) = prefs(ctx).getBoolean("areas_enabled", true)
    fun hour(ctx: Context) = prefs(ctx).getInt("areas_hour", DEFAULT_HOUR)
    fun minute(ctx: Context) = prefs(ctx).getInt("areas_minute", DEFAULT_MINUTE)
    fun nextTrigger(ctx: Context) = prefs(ctx).getLong("areas_next", 0L)

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun save(ctx: Context, enabled: Boolean, hour: Int, minute: Int) {
        prefs(ctx).edit()
            .putBoolean("areas_enabled", enabled)
            .putInt("areas_hour", hour.coerceIn(0, 23))
            .putInt("areas_minute", minute.coerceIn(0, 59))
            .apply()
        schedule(ctx)
    }

    fun canExact(ctx: Context): Boolean {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
    }

    private fun pendingIntent(ctx: Context, test: Boolean, flags: Int): PendingIntent? {
        val intent = Intent(ctx, NotificationReceiver::class.java).apply {
            putExtra("type", TYPE)
            putExtra("test", test)
        }
        return PendingIntent.getBroadcast(ctx, if (test) REQ_TEST else REQ_DAILY, intent, flags or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun setPrecise(ctx: Context, at: Long, pi: PendingIntent) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (canExact(ctx)) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        } else {
            am.setWindow(AlarmManager.RTC_WAKEUP, at, 10 * 60 * 1000L, pi)
        }
    }

    /** Prossimo orario hh:mm in ora bulgara, almeno qualche secondo nel futuro. */
    fun computeNext(hour: Int, minute: Int, now: ZonedDateTime = ZonedDateTime.now(ZONE)): Long {
        var t = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
        if (!t.isAfter(now.plusSeconds(5))) t = t.plusDays(1)
        return t.toInstant().toEpochMilli()
    }

    /** (Ri)programma il promemoria giornaliero. */
    fun schedule(ctx: Context) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pendingIntent(ctx, false, PendingIntent.FLAG_UPDATE_CURRENT)!!
        am.cancel(pi)
        if (!isEnabled(ctx)) {
            pi.cancel()
            prefs(ctx).edit().putLong("areas_next", 0L).apply()
            android.util.Log.d(TAG, "Areas reminder disabled")
            return
        }
        val at = computeNext(hour(ctx), minute(ctx))
        setPrecise(ctx, at, pi)
        prefs(ctx).edit().putLong("areas_next", at).apply()
        android.util.Log.d(TAG, "Areas reminder scheduled at ${java.util.Date(at)} (exact=${canExact(ctx)})")
    }

    /**
     * Chiamato all'avvio app/boot: riprogramma solo se serve. Se l'ultimo orario
     * programmato è ancora futuro (o passato da meno di 30 min, cioè l'allarme
     * potrebbe essere in consegna) lo lascia stare, così aprire l'app alle 19:45:03
     * non sposta a domani un promemoria che deve ancora arrivare.
     */
    fun ensureScheduled(ctx: Context) {
        if (!isEnabled(ctx)) return
        val exists = pendingIntent(ctx, false, PendingIntent.FLAG_NO_CREATE) != null
        val stored = nextTrigger(ctx)
        val now = System.currentTimeMillis()
        // Riprogrammare fuori da questa finestra dà lo stesso orario (o rimette
        // l'allarme se il sistema l'ha cancellato, es. dopo un "forza arresto").
        if (exists && now in (stored - 60_000L)..(stored + 30 * 60_000L)) return
        schedule(ctx)
    }

    /** Notifica di prova tra [delaySeconds] secondi, stesso percorso del promemoria vero. */
    fun scheduleTest(ctx: Context, delaySeconds: Int): Long {
        val at = System.currentTimeMillis() + delaySeconds.coerceIn(1, 3600) * 1000L
        val pi = pendingIntent(ctx, true, PendingIntent.FLAG_UPDATE_CURRENT)!!
        setPrecise(ctx, at, pi)
        android.util.Log.d(TAG, "Areas test reminder scheduled at ${java.util.Date(at)}")
        return at
    }

    /** Gestisce lo scatto dell'allarme (chiamato da NotificationReceiver). */
    fun onAlarm(ctx: Context, intent: Intent, receiver: BroadcastReceiver) {
        val isTest = intent.getBooleanExtra("test", false)
        // Prima di tutto riprogramma domani: anche se qualcosa sotto fallisce,
        // il promemoria di domani resta in piedi.
        if (!isTest) schedule(ctx)
        val pending = receiver.goAsync()
        Thread {
            try {
                val missing = fetchMissingAreas(ctx)
                android.util.Log.d(TAG, "Areas check (test=$isTest): missing=$missing")
                if (missing != null && missing.isEmpty() && !isTest) return@Thread
                val (title, text) = when {
                    missing == null -> "🌱 Aree della vita" to "Scrivi cosa hai fatto oggi in ogni area"
                    missing.isEmpty() -> "🌱 Test notifica Aree" to "Funziona! Oggi hai già compilato tutte le aree ✅"
                    else -> "🌱 Aree della vita" to "Cosa hai fatto oggi? Mancano: ${missing.joinToString(", ")}"
                }
                show(ctx, if (isTest && missing?.isNotEmpty() == true) "$title (test)" else title, text)
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Areas reminder error: ${e.message}")
            } finally {
                pending.finish()
            }
        }.start()
    }

    /**
     * Nomi delle aree attive senza voci oggi (note o sessioni — stesso criterio di
     * isAreaFilled in src/lib/lifeAreaWeek.js). null = dati non disponibili
     * (non loggato / nessuna rete e nessuna cache): in quel caso si notifica
     * comunque, meglio un promemoria in più che uno perso.
     */
    private fun fetchMissingAreas(ctx: Context): List<String>? {
        if (FirebaseApp.getApps(ctx).isEmpty()) FirebaseApp.initializeApp(ctx)
        if (FirebaseAuth.getInstance().currentUser == null) return null
        val ref = FirebaseFirestore.getInstance().collection("users").document("flavio")
        val snap = try {
            Tasks.await(ref.get(), 8, TimeUnit.SECONDS)
        } catch (e: Exception) {
            android.util.Log.w(TAG, "Areas: server read failed (${e.message}), trying cache")
            try { Tasks.await(ref.get(Source.CACHE), 3, TimeUnit.SECONDS) } catch (e2: Exception) { null }
        } ?: return null
        if (!snap.exists()) return null

        val today = LocalDate.now().toString() // stessa data locale usata dalla web app
        @Suppress("UNCHECKED_CAST")
        val areas = (snap.get("lifeAreas") as? List<Map<String, Any?>>).orEmpty()
            .filter { it["active"] != false }
        @Suppress("UNCHECKED_CAST")
        val notes = ((snap.get("lifeAreaNotes") as? Map<String, Any?>)?.get(today) as? List<Map<String, Any?>>).orEmpty()
        @Suppress("UNCHECKED_CAST")
        val sessions = ((snap.get("lifeAreaLog") as? Map<String, Any?>)?.get(today) as? List<Map<String, Any?>>).orEmpty()
        val filled = (notes + sessions).mapNotNull { it["areaId"]?.toString() }.toSet()
        return areas.filter { it["id"]?.toString() !in filled }.map { it["name"]?.toString() ?: "?" }
    }

    private fun show(ctx: Context, title: String, text: String) {
        NotificationReceiver.createChannel(ctx)
        val tapIntent = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("open_tab", "aree")
        } ?: return
        val tapPi = PendingIntent.getActivity(
            ctx, REQ_DAILY, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notif = NotificationCompat.Builder(ctx, NotificationReceiver.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_glp)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(tapPi)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        try {
            NotificationManagerCompat.from(ctx).notify(REQ_DAILY, notif)
            android.util.Log.d(TAG, "Showed areas notification: $text")
        } catch (e: SecurityException) {
            android.util.Log.w(TAG, "POST_NOTIFICATIONS not granted: ${e.message}")
        }
    }
}
