package com.flavio.glp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            android.util.Log.d("GLP_Notif", "Boot completed — rescheduling notification alarms")
            NotificationScheduler.scheduleAll(context)
        }
    }
}
