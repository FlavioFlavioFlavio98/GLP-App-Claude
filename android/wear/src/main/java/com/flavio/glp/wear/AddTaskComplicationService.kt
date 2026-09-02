package com.flavio.glp.wear

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService

// Complicazione sul quadrante — a differenza della Tile "Nuova task" (che
// richiede tenere premuto il quadrante e scorrere fino ai widget), un tocco
// diretto sullo slot del quadrante apre subito la dettatura vocale, stessa
// destinazione (VoiceAddTaskActivity) della Tile. Richiesta esplicita di
// Flavio dopo aver verificato che il suo quadrante supporta complicazioni
// di terze parti con slot liberi — a differenza della Tile, l'assegnazione
// allo slot resta comunque manuale (personalizza quadrante → scegli GLP),
// nessuna API permette di farlo in automatico dall'app.
class AddTaskComplicationService : SuspendingComplicationDataSourceService() {

    private fun taskComplicationData(): ShortTextComplicationData {
        val intent = Intent(this, VoiceAddTaskActivity::class.java).apply {
            action = Intent.ACTION_VIEW
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder("🎤 Task").build(),
            contentDescription = PlainComplicationText.Builder("Nuova task a voce").build(),
        )
            .setTapAction(pendingIntent)
            .build()
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        return when (request.complicationType) {
            ComplicationType.SHORT_TEXT -> taskComplicationData()
            else -> null
        }
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        return when (type) {
            ComplicationType.SHORT_TEXT -> taskComplicationData()
            else -> null
        }
    }
}
