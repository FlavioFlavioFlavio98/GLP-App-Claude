package com.flavio.glp

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "NotificationPlugin",
    permissions = [
        Permission(
            strings = [Manifest.permission.POST_NOTIFICATIONS],
            alias = "postNotifications"
        )
    ]
)
class NotificationPlugin : Plugin() {

    /**
     * Chiamato da JS quando l'utente cambia le impostazioni notifiche.
     * settings = { habits: {enabled, hour, minute}, tasks: {...}, readings: {...} }
     */
    @PluginMethod
    fun scheduleAll(call: PluginCall) {
        val settingsObj = call.getObject("settings") ?: run {
            call.reject("Missing 'settings' parameter")
            return
        }

        val settingsMap = mutableMapOf<String, Map<String, Any>>()
        for (type in listOf("habits", "tasks", "readings")) {
            val typeObj = settingsObj.optJSONObject(type) ?: continue
            settingsMap[type] = mapOf(
                "enabled" to typeObj.optBoolean("enabled", false),
                "hour"    to typeObj.optInt("hour",   NotificationScheduler.defaultHourFor(type)),
                "minute"  to typeObj.optInt("minute", 0)
            )
        }

        NotificationScheduler.saveAndSchedule(context, settingsMap)

        // Crea subito il notification channel
        NotificationReceiver.createChannel(context)

        call.resolve(JSObject().apply { put("scheduled", true) })
    }

    /**
     * Reminder custom con testo libero — sostituisce il vecchio meccanismo push
     * web (FCM), rimosso: le notifiche locali programmate qui sono più
     * affidabili perché non dipendono da server/token/rete al momento dello
     * scatto, solo da AlarmManager sul dispositivo.
     * reminders = [{ id, title, message, hour, minute, enabled }, ...]
     */
    @PluginMethod
    fun saveCustomReminders(call: PluginCall) {
        val arr = call.getArray("reminders") ?: run {
            call.reject("Missing 'reminders' parameter")
            return
        }
        val list = mutableListOf<CustomReminder>()
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            list.add(CustomReminder(
                id = obj.optString("id", System.currentTimeMillis().toString()),
                title = obj.optString("title", "GLP"),
                message = obj.optString("message", ""),
                hour = obj.optInt("hour", 9),
                minute = obj.optInt("minute", 0),
                enabled = obj.optBoolean("enabled", true)
            ))
        }
        NotificationScheduler.saveCustomReminders(context, list)
        NotificationReceiver.createChannel(context)
        call.resolve(JSObject().apply { put("saved", true) })
    }

    @PluginMethod
    fun getCustomReminders(call: PluginCall) {
        val reminders = NotificationScheduler.getCustomReminders(context)
        val result = com.getcapacitor.JSArray()
        reminders.forEach { r ->
            result.put(JSObject().apply {
                put("id", r.id)
                put("title", r.title)
                put("message", r.message)
                put("hour", r.hour)
                put("minute", r.minute)
                put("enabled", r.enabled)
            })
        }
        call.resolve(JSObject().apply { put("reminders", result) })
    }

    // ─── Promemoria serale Aree (AreasReminder.kt) ─────────────────────────────

    private fun areasStatus(): JSObject {
        val ctx = context
        return JSObject().apply {
            put("enabled", AreasReminder.isEnabled(ctx))
            put("hour", AreasReminder.hour(ctx))
            put("minute", AreasReminder.minute(ctx))
            put("timeZone", AreasReminder.ZONE.id)
            put("nextTrigger", AreasReminder.nextTrigger(ctx))
            put("exactAllowed", AreasReminder.canExact(ctx))
            put("notificationsEnabled", androidx.core.app.NotificationManagerCompat.from(ctx).areNotificationsEnabled())
        }
    }

    @PluginMethod
    fun getAreasReminderStatus(call: PluginCall) {
        AreasReminder.ensureScheduled(context)
        call.resolve(areasStatus())
    }

    /** { enabled, hour, minute } — orario in ora bulgara (Europe/Sofia). */
    @PluginMethod
    fun setAreasReminder(call: PluginCall) {
        AreasReminder.save(
            context,
            call.getBoolean("enabled", true) ?: true,
            call.getInt("hour", AreasReminder.DEFAULT_HOUR) ?: AreasReminder.DEFAULT_HOUR,
            call.getInt("minute", AreasReminder.DEFAULT_MINUTE) ?: AreasReminder.DEFAULT_MINUTE
        )
        NotificationReceiver.createChannel(context)
        call.resolve(areasStatus())
    }

    /** Notifica di prova tra { delaySeconds } secondi, stesso percorso del promemoria vero. */
    @PluginMethod
    fun testAreasReminder(call: PluginCall) {
        NotificationReceiver.createChannel(context)
        val at = AreasReminder.scheduleTest(context, call.getInt("delaySeconds", 60) ?: 60)
        call.resolve(JSObject().apply { put("at", at) })
    }

    /**
     * Controlla e richiede POST_NOTIFICATIONS (richiesto da Android 13+).
     * Restituisce { status: "granted" | "denied" | "prompt" }
     */
    @PluginMethod
    fun checkPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            // Android < 13: POST_NOTIFICATIONS non richiesto
            call.resolve(JSObject().apply { put("status", "granted") })
            return
        }
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED

        if (granted) {
            call.resolve(JSObject().apply { put("status", "granted") })
        } else {
            call.resolve(JSObject().apply { put("status", "prompt") })
        }
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            call.resolve(JSObject().apply { put("status", "granted") })
            return
        }
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED

        if (granted) {
            call.resolve(JSObject().apply { put("status", "granted") })
        } else {
            requestPermissionForAlias("postNotifications", call, "permissionResult")
        }
    }

    @PermissionCallback
    private fun permissionResult(call: PluginCall) {
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        call.resolve(JSObject().apply {
            put("status", if (granted) "granted" else "denied")
        })
    }
}
