package com.flavio.glp

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class MeditationWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_meditation)

            val prefs = context.getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
            val count = prefs.getInt("meditation_count_today", 0)
            views.setTextViewText(R.id.widget_meditation_count, "$count oggi")

            // Tap ovunque sul widget → logga subito un momento, nessuna schermata
            // intermedia (vedi MeditationActionService).
            val logIntent = Intent(context, MeditationActionService::class.java)
            val logPi = PendingIntent.getService(
                context, appWidgetId, logIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_meditation_root, logPi)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
