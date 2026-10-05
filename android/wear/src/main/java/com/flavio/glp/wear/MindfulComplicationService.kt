package com.flavio.glp.wear

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.RangedValueComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationDataTimeline
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingTimelineComplicationDataSourceService
import androidx.wear.watchface.complications.datasource.TimeInterval
import androidx.wear.watchface.complications.datasource.TimelineEntry
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneId

// Complicazione "Consapevolezza" sul quadrante: mostra i momenti di oggi
// sull'obiettivo ("1/3", con arco di avanzamento negli slot che lo supportano)
// e a un tocco ne registra uno nuovo (apre MindfulAddActivity, che salva
// subito e si chiude da sola). Conteggio letto dalla copia locale di
// MindfulStore: nessuna lettura Firestore qui, quindi risposta immediata.
// Timeline: da mezzanotte il quadrante torna da solo a "0/3", senza aspettare
// il prossimo aggiornamento periodico.
class MindfulComplicationService : SuspendingTimelineComplicationDataSourceService() {

    private fun tapAction(): PendingIntent {
        val intent = Intent(this, MindfulAddActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        // requestCode distinto dalle altre complicazioni (0, 3, 5) — vedi
        // commento in WorkoutComplicationService.
        return PendingIntent.getActivity(
            this, 8, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun data(type: ComplicationType, count: Int, goal: Int): ComplicationData? {
        val text = PlainComplicationText.Builder("$count/$goal").build()
        val title = PlainComplicationText.Builder("🧘").build()
        val description = PlainComplicationText.Builder("Momenti di consapevolezza: $count su $goal. Tocca per aggiungerne uno").build()
        return when (type) {
            ComplicationType.SHORT_TEXT ->
                ShortTextComplicationData.Builder(text = text, contentDescription = description)
                    .setTitle(title)
                    .setTapAction(tapAction())
                    .build()
            ComplicationType.RANGED_VALUE ->
                RangedValueComplicationData.Builder(
                    value = count.coerceAtMost(goal).toFloat(),
                    min = 0f,
                    max = goal.toFloat(),
                    contentDescription = description,
                )
                    .setText(text)
                    .setTitle(title)
                    .setTapAction(tapAction())
                    .build()
            else -> null
        }
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationDataTimeline? {
        val goal = MindfulStore.goal(this)
        // Aggiornamento periodico (ogni 30 min): se c'è ancora qualcosa di non
        // confermato dal server, rimette in coda la spedizione.
        if (MindfulStore.isDirty(this)) PendingWritesWorker.enqueue(this)
        val now = data(request.complicationType, MindfulStore.count(this), goal) ?: return null
        val zero = data(request.complicationType, 0, goal) ?: return null
        val midnight = LocalDate.now().plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant()
        return ComplicationDataTimeline(
            now,
            listOf(TimelineEntry(TimeInterval(midnight, midnight.plus(Duration.ofDays(1))), zero)),
        )
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? = data(type, 1, MindfulStore.DEFAULT_GOAL)
}
