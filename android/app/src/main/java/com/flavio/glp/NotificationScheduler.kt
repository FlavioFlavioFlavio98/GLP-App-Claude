package com.flavio.glp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

object NotificationScheduler {

    const val TYPE_HABITS   = "habits"
    const val TYPE_TASKS    = "tasks"
    const val TYPE_READINGS = "readings"

    private const val REQ_HABITS   = 2001
    private const val REQ_TASKS    = 2002
    private const val REQ_READINGS = 2003

    private const val PREFS_NAME = "glp_notifications"

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
