package com.flavio.glp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.Calendar

data class CustomReminder(
    val id: String,
    val title: String,
    val message: String,
    val hour: Int,
    val minute: Int,
    val enabled: Boolean
)

object NotificationScheduler {

    const val TYPE_HABITS   = "habits"
    const val TYPE_TASKS    = "tasks"
    const val TYPE_READINGS = "readings"

    private const val REQ_HABITS   = 2001
    private const val REQ_TASKS    = 2002
    private const val REQ_READINGS = 2003
    // Le richieste custom usano un range separato (id.hashCode() poteva collidere
    // con quelli fissi sopra, ma AlarmManager tratta i requestCode come Int liberi
    // — coerceIn evita comunque collisioni con i 3 fissi qui sopra).
    private const val CUSTOM_REQ_BASE = 10000

    private const val PREFS_NAME = "glp_notifications"
    private const val CUSTOM_REMINDERS_KEY = "custom_reminders"

    /** Legge le impostazioni da SharedPreferences e (ri)programma tutti gli allarmi. */
    fun scheduleAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        scheduleOne(context, TYPE_HABITS,   REQ_HABITS,
            prefs.getBoolean("habits_enabled",   false),
            prefs.getInt("habits_hour",   20),
            prefs.getInt("habits_minute", 0))
        scheduleOne(context, TYPE_TASKS,    REQ_TASKS,
            prefs.getBoolean("tasks_enabled",    false),
            prefs.getInt("tasks_hour",    18),
            prefs.getInt("tasks_minute",  0))
        scheduleOne(context, TYPE_READINGS, REQ_READINGS,
            prefs.getBoolean("readings_enabled", false),
            prefs.getInt("readings_hour",  9),
            prefs.getInt("readings_minute",0))
        scheduleCustomReminders(context, getCustomReminders(context))
    }

    /** Salva le impostazioni ricevute dal plugin JS e ri-schedula. */
    fun saveAndSchedule(context: Context, settings: Map<String, Any>) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
        for ((type, raw) in settings) {
            @Suppress("UNCHECKED_CAST")
            val s = raw as? Map<String, Any> ?: continue
            val enabled = s["enabled"] as? Boolean ?: false
            val hour    = (s["hour"]   as? Number)?.toInt() ?: defaultHourFor(type)
            val minute  = (s["minute"] as? Number)?.toInt() ?: 0
            prefs.putBoolean("${type}_enabled", enabled)
            prefs.putInt("${type}_hour",   hour)
            prefs.putInt("${type}_minute", minute)
        }
        prefs.apply()
        scheduleAll(context)
    }

    fun defaultHourFor(type: String) = when (type) {
        TYPE_HABITS   -> 20
        TYPE_TASKS    -> 18
        TYPE_READINGS -> 9
        else          -> 9
    }

    // ─── Reminder custom con testo libero ──────────────────────────────────────
    // A differenza di habits/tasks/readings (condizionati a un conteggio pendente
    // letto da glp_widget prefs), un reminder custom scatta sempre all'orario
    // impostato col titolo/testo scelti dall'utente — non dipende da alcun dato.

    fun getCustomReminders(context: Context): List<CustomReminder> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(CUSTOM_REMINDERS_KEY, "[]") ?: "[]"
        val type = object : TypeToken<List<CustomReminder>>() {}.type
        return try { Gson().fromJson(json, type) ?: emptyList() } catch (e: Exception) { emptyList() }
    }

    fun saveCustomReminders(context: Context, reminders: List<CustomReminder>) {
        // Cancella prima tutti gli allarmi precedenti (anche quelli rimossi
        // nell'edit corrente), poi rischedula solo quelli attuali abilitati.
        val previous = getCustomReminders(context)
        previous.forEach { cancelCustomReminder(context, it.id) }

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(CUSTOM_REMINDERS_KEY, Gson().toJson(reminders)).apply()

        scheduleCustomReminders(context, reminders)
    }

    private fun scheduleCustomReminders(context: Context, reminders: List<CustomReminder>) {
        reminders.forEach { r ->
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, NotificationReceiver::class.java).apply {
                putExtra("custom", true)
                putExtra("id", r.id)
                putExtra("title", r.title)
                putExtra("message", r.message)
            }
            val requestCode = CUSTOM_REQ_BASE + (r.id.hashCode() and 0x0FFFFFFF)
            val pi = PendingIntent.getBroadcast(
                context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            if (!r.enabled) { am.cancel(pi); return@forEach }

            val cal = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, r.hour)
                set(Calendar.MINUTE, r.minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
            }
            am.setInexactRepeating(AlarmManager.RTC_WAKEUP, cal.timeInMillis, AlarmManager.INTERVAL_DAY, pi)
        }
    }

    private fun cancelCustomReminder(context: Context, id: String) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, NotificationReceiver::class.java)
        val requestCode = CUSTOM_REQ_BASE + (id.hashCode() and 0x0FFFFFFF)
        val pi = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am.cancel(pi)
    }

    private fun scheduleOne(
        context: Context, type: String, requestCode: Int,
        enabled: Boolean, hour: Int, minute: Int
    ) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, NotificationReceiver::class.java).apply {
            putExtra("type", type)
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pi = PendingIntent.getBroadcast(context, requestCode, intent, flags)

        if (!enabled) {
            am.cancel(pi)
            return
        }

        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            // Se l'orario è già passato oggi, programma per domani
            if (timeInMillis <= System.currentTimeMillis()) {
                add(Calendar.DAY_OF_YEAR, 1)
            }
        }

        // setInexactRepeating: non richiede permessi speciali, si ripete ogni giorno
        am.setInexactRepeating(
            AlarmManager.RTC_WAKEUP,
            cal.timeInMillis,
            AlarmManager.INTERVAL_DAY,
            pi
        )
        android.util.Log.d("GLP_Notif", "Scheduled $type at $hour:$minute (next: ${cal.time})")
    }
}
