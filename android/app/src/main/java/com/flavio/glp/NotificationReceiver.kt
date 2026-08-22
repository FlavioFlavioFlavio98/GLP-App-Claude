package com.flavio.glp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class NotificationReceiver : BroadcastReceiver() {

    companion object {
        const val CHANNEL_ID = "glp_reminders"

        fun createChannel(context: Context) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Promemoria GLP",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifiche per abitudini, task e letture"
            }
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        createChannel(context)

        if (intent.getBooleanExtra("custom", false)) {
            showCustomReminder(context, intent)
            return
        }

        val type = intent.getStringExtra("type") ?: return

        val widgetPrefs = context.getSharedPreferences("glp_widget", Context.MODE_PRIVATE)

        val count: Int
        val title: String
        val text: String
        val openTab: String

        when (type) {
            NotificationScheduler.TYPE_HABITS -> {
                count   = widgetPrefs.getInt("notification_habits_pending", 0)
                title   = "Abitudini da completare 💪"
                text    = if (count == 1) "Hai 1 abitudine da completare oggi"
                          else "Hai $count abitudini da completare oggi"
                openTab = "habits"
            }
            NotificationScheduler.TYPE_TASKS -> {
                count   = widgetPrefs.getInt("notification_tasks_today", 0)
                title   = "Task in scadenza oggi 📋"
                text    = if (count == 1) "Hai 1 task in scadenza oggi"
                          else "Hai $count task in scadenza oggi"
                openTab = "tasks"
            }
            NotificationScheduler.TYPE_READINGS -> {
                count   = widgetPrefs.getInt("notification_readings_urgent", 0)
                title   = "Letture da ripassare 📚"
                text    = if (count == 1) "Hai 1 lettura da ripassare"
                          else "Hai $count letture da ripassare"
                openTab = "readings"
            }
            else -> return
        }

        if (count <= 0) {
            android.util.Log.d("GLP_Notif", "Skip $type notification: count=$count")
            return
        }

        // Intent per aprire l'app sulla sezione corretta
        val tapIntent = context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("open_tab", openTab)
            } ?: return

        val tapPi = PendingIntent.getActivity(
            context, openTab.hashCode(), tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notif = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_glp)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(tapPi)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(openTab.hashCode(), notif)
            android.util.Log.d("GLP_Notif", "Showed $type notification: $text")
        } catch (e: SecurityException) {
            android.util.Log.w("GLP_Notif", "POST_NOTIFICATIONS not granted: ${e.message}")
        }
    }

    private fun showCustomReminder(context: Context, intent: Intent) {
        val id = intent.getStringExtra("id") ?: return
        val title = intent.getStringExtra("title") ?: "GLP"
        val message = intent.getStringExtra("message") ?: ""

        val tapIntent = context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP }
            ?: return

        val tapPi = PendingIntent.getActivity(
            context, id.hashCode(), tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notif = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_glp)
            .setContentTitle(title)
            .setContentText(message)
            .setContentIntent(tapPi)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(id.hashCode(), notif)
            android.util.Log.d("GLP_Notif", "Showed custom reminder: $title")
        } catch (e: SecurityException) {
            android.util.Log.w("GLP_Notif", "POST_NOTIFICATIONS not granted: ${e.message}")
        }
    }
}
