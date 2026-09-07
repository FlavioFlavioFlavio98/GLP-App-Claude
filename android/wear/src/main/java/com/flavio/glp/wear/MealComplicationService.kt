package com.flavio.glp.wear

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService

// Complicazione sul quadrante — stesso schema di AddTaskComplicationService,
// ma apre direttamente la pagina Pasto (indice 5 del pager) invece della
// dettatura vocale. Richiesta esplicita di Flavio per un accesso a un tocco
// alla schermata che usa più spesso, senza passare dal riepilogo "Oggi".
class MealComplicationService : SuspendingComplicationDataSourceService() {

    private fun complicationData(): ShortTextComplicationData {
        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            putExtra(EXTRA_START_PAGE, 5)
        }
        // requestCode diverso da 0 (usato da AddTaskComplicationService) e
        // dalla complicazione Workout — vedi commento in
        // WorkoutComplicationService per il perché è necessario.
        val pendingIntent = PendingIntent.getActivity(
            this,
            5,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        // Solo emoji, niente testo accanto — richiesta esplicita di Flavio
        // per un'icona più pulita sul quadrante.
        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder("🍽️").build(),
            contentDescription = PlainComplicationText.Builder("Apri Pasto").build(),
        )
            .setTapAction(pendingIntent)
            .build()
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        return when (request.complicationType) {
            ComplicationType.SHORT_TEXT -> complicationData()
            else -> null
        }
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        return when (type) {
            ComplicationType.SHORT_TEXT -> complicationData()
            else -> null
        }
    }
}
