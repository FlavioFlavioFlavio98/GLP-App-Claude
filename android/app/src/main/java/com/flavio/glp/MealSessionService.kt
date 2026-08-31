package com.flavio.glp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

// Notifica persistente con timer live durante un pasto tracciato, più un
// promemoria periodico (beep + vibrazione) — richiesta esplicita di Flavio:
// "a volte inizio a mangiare lentamente ma dopo un po' mi scordo e
// accelero", soprattutto quando è su un'altra app (es. guarda un video). Un
// setInterval lato JS nella webview non basta: viene rallentato o sospeso
// quando il browser/l'app va in background — un vero Service Android in
// foreground è l'unico modo affidabile per farlo funzionare anche mentre si
// usa un'altra app. setUsesChronometer(true) fa aggiornare il tempo nella
// notifica da solo lato sistema, senza bisogno di ripostarla ogni secondo.
class MealSessionService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var startTime = 0L
    private var reminderRunnable: Runnable? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startTime = intent?.getLongExtra(EXTRA_START_TIME, System.currentTimeMillis())
            ?: System.currentTimeMillis()
        startForeground(NOTIFICATION_ID, buildNotification())
        scheduleReminders()
        return START_NOT_STICKY
    }

    private fun buildNotification(): Notification {
        createChannel()
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentPi = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🍽️ Pasto in corso")
            .setContentText("Mangia con calma, mastica bene")
            .setSmallIcon(R.drawable.ic_stat_glp)
            .setUsesChronometer(true)
            .setWhen(startTime)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(contentPi)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    // Beep + vibrazione ogni 60 secondi finché il Service è vivo — un
    // Handler.postDelayed che si riprogramma da solo è affidabile qui perché
    // gira dentro un foreground service (priorità protetta dal sistema),
    // niente a che vedere con i timer di una webview in background.
    private fun scheduleReminders() {
        reminderRunnable?.let { handler.removeCallbacks(it) }
        val runnable = object : Runnable {
            override fun run() {
                beepAndVibrate()
                handler.postDelayed(this, REMINDER_INTERVAL_MS)
            }
        }
        reminderRunnable = runnable
        handler.postDelayed(runnable, REMINDER_INTERVAL_MS)
    }

    private fun beepAndVibrate() {
        try {
            val tg = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 70)
            tg.startTone(ToneGenerator.TONE_PROP_BEEP, 200)
            handler.postDelayed({ try { tg.release() } catch (e: Exception) { /* ignore */ } }, 300)
        } catch (e: Exception) { /* dispositivo in silenzioso o audio non disponibile — non bloccante */ }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator.vibrate(VibrationEffect.createOneShot(300, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                v.vibrate(VibrationEffect.createOneShot(300, VibrationEffect.DEFAULT_AMPLITUDE))
            }
        } catch (e: Exception) { /* ignore */ }
    }

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Pasto in corso", NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Timer live durante un pasto tracciato"
            setShowBadge(false)
        }
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    override fun onDestroy() {
        reminderRunnable?.let { handler.removeCallbacks(it) }
        super.onDestroy()
    }

    companion object {
        const val EXTRA_START_TIME = "start_time"
        const val CHANNEL_ID = "glp_meal_session"
        const val NOTIFICATION_ID = 7001
        const val REMINDER_INTERVAL_MS = 60_000L
    }
}
