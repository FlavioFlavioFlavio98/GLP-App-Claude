package com.flavio.glp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON" ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            android.util.Log.d("GLP_Notif", "${intent.action} — rescheduling notification alarms")
            NotificationScheduler.scheduleAll(context)
            // Dopo riavvio/aggiornamento gli allarmi possono essere stati azzerati:
            // il promemoria Aree va riprogrammato sempre, senza scorciatoie.
            AreasReminder.schedule(context)
            WidgetRefreshScheduler.scheduleNext(context)
        }
    }
}
