package com.flavio.glp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.Calendar

// Le task passano da "attiva" a "scaduta" a mezzanotte lato server, ma il
// widget lista task mostra solo la sua cache locale (SharedPreferences),
// aggiornata da WidgetUpdateWorker ogni ~15 minuti — un intervallo che
// Android allunga parecchio durante il Doze notturno. Risultato: la mattina
// il widget può restare fermo alla situazione di ieri sera finché non si
// riapre l'app (bug reale segnalato da Flavio: una task scaduta durante la
// notte non compariva nel widget). Questo allarme forza un refresh appena
// dopo mezzanotte con setAndAllowWhileIdle, che ha buone probabilità di
// eseguire comunque durante la prossima finestra di manutenzione del Doze
// invece di aspettare la prossima apertura manuale dell'app.
object WidgetRefreshScheduler {
    private const val REQUEST_CODE = 3001

    fun scheduleNext(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, WidgetRefreshReceiver::class.java)
        val pi = PendingIntent.getBroadcast(
            context, REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 5)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
        }
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pi)
    }
}

class WidgetRefreshReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        android.util.Log.d("GLPWidget", "Midnight widget refresh alarm fired")
        val work = OneTimeWorkRequestBuilder<WidgetUpdateWorker>().build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "widget_midnight_refresh",
            ExistingWorkPolicy.REPLACE,
            work
        )
        // Si riprogramma da sola per la notte successiva — setAndAllowWhileIdle
        // non è ripetuto automaticamente come setInexactRepeating.
        WidgetRefreshScheduler.scheduleNext(context)
    }
}
