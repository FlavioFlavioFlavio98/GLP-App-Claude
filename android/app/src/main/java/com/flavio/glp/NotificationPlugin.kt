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
