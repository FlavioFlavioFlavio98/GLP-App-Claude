package com.flavio.glp

import android.content.Intent
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

// Ponte JS → Service nativo per la notifica persistente con timer live
// durante un pasto tracciato (vedi MealSessionService per il motivo per cui
// serve un vero Service e non un timer lato JS). Disponibile solo
// nell'app Android nativa — sulla web app in browser questi metodi
// semplicemente non esistono e MealsTab.jsx lo gestisce con un controllo
// opzionale (window.Capacitor?.Plugins?.MealSessionPlugin).
@CapacitorPlugin(name = "MealSessionPlugin")
class MealSessionPlugin : Plugin() {

    @PluginMethod
    fun start(call: PluginCall) {
        val startTime = call.getDouble("startTime")?.toLong() ?: System.currentTimeMillis()
        val intent = Intent(context, MealSessionService::class.java).apply {
            putExtra(MealSessionService.EXTRA_START_TIME, startTime)
        }
        ContextCompat.startForegroundService(context, intent)
        call.resolve(JSObject().apply { put("started", true) })
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        context.stopService(Intent(context, MealSessionService::class.java))
        call.resolve(JSObject().apply { put("stopped", true) })
    }
}
