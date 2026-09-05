package com.flavio.glp.wear

import androidx.concurrent.futures.CallbackToFutureAdapter
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders
import androidx.wear.protolayout.DimensionBuilders
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.StateBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.protolayout.expression.AppDataKey
import androidx.wear.protolayout.expression.DynamicBuilders
import androidx.wear.protolayout.expression.DynamicDataBuilders
import androidx.wear.protolayout.material.Text
import androidx.wear.protolayout.material.Typography
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.ResourceBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.ListenableFuture

private const val RESOURCES_VERSION = "1"
private const val MAX_ROWS = 6

// Due chiavi di stato per il flusso a due tocchi (riga → conferma → fatto):
// la prima riga tocca solo "chiedi conferma", la seconda (✓ nel riquadro di
// conferma) tocca davvero il completamento — separate per evitare un tocco
// accidentale sulla lista che completi subito una task per sbaglio,
// richiesta esplicita di Flavio.
private val PENDING_CONFIRM_KEY = AppDataKey<DynamicBuilders.DynamicString>("pending_confirm_task_id")
private val COMPLETE_TASK_KEY = AppDataKey<DynamicBuilders.DynamicString>("complete_task_id")

// Bianco pieno invece del colore predefinito (grigio/secondario, poco
// leggibile su nero) degli stili CAPTION di Typography — "poco visibile"
// segnalato da Flavio guardando una foto reale del quadrante.
private val WHITE = ColorBuilders.ColorProp.Builder().setArgb(0xFFFFFFFF.toInt()).build()
private val GREEN = ColorBuilders.ColorProp.Builder().setArgb(0xFF4CAF50.toInt()).build()
private val RED = ColorBuilders.ColorProp.Builder().setArgb(0xFFEB5757.toInt()).build()

// Tile "Task oggi" — mini-lista fino a MAX_ROWS task con pallino colore
// priorità, raggiungibile a swipe dal quadrante. Usa androidx.wear.protolayout.*
// direttamente (non androidx.wear.tiles.material come le altre Tile
// dell'app): solo lì lo State/LoadAction ha metodi reali per portare dati
// (l'involucro androidx.wear.tiles.StateBuilders.State è uno stub vuoto) —
// necessario per completare una task toccando la sua riga senza aprire
// l'app, richiesta esplicita di Flavio. Flusso a due passi (tocca riga →
// conferma inline → tocca ✓) invece di completare al primo tocco, per non
// rischiare un tocco accidentale sulla lista: la Tile stessa non supporta
// popup/dialog, quindi la "conferma" è semplicemente un secondo contenuto
// mostrato al posto della lista, con lo stesso meccanismo LoadAction+State.
// TileService/TileBuilders/RequestBuilders/ResourceBuilders restano dal
// pacchetto tiles (la classe base e l'involucro Tile finale accettano
// entrambi un Timeline protolayout via setTileTimeline, verificato via
// javap prima di scrivere questo file).
class TasksTileService : TileService() {

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest
    ): ListenableFuture<TileBuilders.Tile> {
        return CallbackToFutureAdapter.getFuture { completer ->
            val state = requestParams.currentState?.keyToValueMapping
            fun stringState(key: AppDataKey<DynamicBuilders.DynamicString>): String? =
                state?.get(key)?.let { if (it.hasStringValue()) it.stringValue else null }

            val toComplete = stringState(COMPLETE_TASK_KEY)
            val pendingConfirm = stringState(PENDING_CONFIRM_KEY)

            fun loadAndBuild(pendingConfirmId: String?) {
                GlpRepository.loadActiveTasks(
                    onResult = { tasks -> completer.set(buildTile(requestParams, tasks, pendingConfirmId)) },
                    onError = { _ -> completer.set(buildTile(requestParams, null, null)) },
                )
            }

            when {
                // Passo 2: ✓ toccato nel riquadro di conferma — completa
                // davvero. completeTask usa una transazione Firestore
                // (necessaria per modificare in sicurezza un elemento
                // esistente dell'array "tasks", stessa lezione della
                // perdita dati del 28/8/2026) — non può essere messa in coda
                // offline: se fallisce (es. niente rete), la task ancora
                // attiva ricompare nella lista invece di un errore silenzioso.
                toComplete != null -> GlpRepository.completeTask(
                    taskId = toComplete,
                    onDone = { loadAndBuild(null) },
                    onError = { loadAndBuild(null) },
                )
                // Passo 1: riga toccata — mostra solo il riquadro di conferma
                // per quella task, senza completare nulla ancora.
                pendingConfirm != null -> loadAndBuild(pendingConfirm)
                else -> loadAndBuild(null)
            }
            "onTileRequest"
        }
    }

    override fun onResourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest
    ): ListenableFuture<ResourceBuilders.Resources> {
        return CallbackToFutureAdapter.getFuture { completer ->
            completer.set(ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build())
            "onResourcesRequest"
        }
    }

    private fun openAppClickable(id: String): ModifiersBuilders.Clickable {
        val activity = ActionBuilders.AndroidActivity.Builder()
            .setPackageName(packageName)
            .setClassName("com.flavio.glp.wear.MainActivity")
            .addKeyToExtraMapping(
                EXTRA_START_PAGE,
                ActionBuilders.AndroidIntExtra.Builder().setValue(2).build(),
            )
            .build()
        val action = ActionBuilders.LaunchAction.Builder().setAndroidActivity(activity).build()
        return ModifiersBuilders.Clickable.Builder()
            .setId(id)
            .setOnClick(action)
            .build()
    }

    private fun loadActionClickable(id: String, key: AppDataKey<DynamicBuilders.DynamicString>, value: String?): ModifiersBuilders.Clickable {
        val stateBuilder = StateBuilders.State.Builder()
        if (value != null) {
            stateBuilder.addKeyToValueMapping(key, DynamicDataBuilders.DynamicDataValue.fromString(value))
        }
        val action = ActionBuilders.LoadAction.Builder().setRequestState(stateBuilder.build()).build()
        return ModifiersBuilders.Clickable.Builder()
            .setId(id)
            .setOnClick(action)
            .build()
    }

    private fun priorityDot(priority: String): String = when (priority) {
        "high" -> "🔴"
        "low" -> "🔵"
        else -> "🟠"
    }

    private fun buildTile(requestParams: RequestBuilders.TileRequest, tasks: List<WearTask>?, pendingConfirmId: String?): TileBuilders.Tile {
        val confirmTask = pendingConfirmId?.let { id -> tasks?.find { it.id == id } }

        val content: LayoutElementBuilders.LayoutElement = if (confirmTask != null) {
            buildConfirmContent(confirmTask)
        } else {
            buildListContent(tasks)
        }

        // Padding per restare dentro l'area sicura del quadrante tondo. Meno
        // margine orizzontale di prima (26→20dp): con più righe (MAX_ROWS=6)
        // il contenuto arriva più vicino ai poli del cerchio, dove la
        // larghezza utile si restringe — verificato via screenshot reale sul
        // watch, non solo a calcolo.
        val padding = ModifiersBuilders.Padding.Builder()
            .setStart(DimensionBuilders.dp(20f))
            .setEnd(DimensionBuilders.dp(20f))
            .setTop(DimensionBuilders.dp(2f))
            .setBottom(DimensionBuilders.dp(2f))
            .build()
        val box = LayoutElementBuilders.Box.Builder()
            .setWidth(DimensionBuilders.expand())
            .setHeight(DimensionBuilders.expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(ModifiersBuilders.Modifiers.Builder().setPadding(padding).build())
            .addContent(content)

        val timeline = TimelineBuilders.Timeline.Builder()
            .addTimelineEntry(
                TimelineBuilders.TimelineEntry.Builder()
                    .setLayout(LayoutElementBuilders.Layout.Builder().setRoot(box.build()).build())
                    .build()
            )
            .build()

        return TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setFreshnessIntervalMillis(15 * 60 * 1000L)
            .setTileTimeline(timeline)
            .build()
    }

    private fun buildConfirmContent(task: WearTask): LayoutElementBuilders.LayoutElement {
        val column = LayoutElementBuilders.Column.Builder()
            .setWidth(DimensionBuilders.wrap())
            .setHeight(DimensionBuilders.wrap())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)

        column.addContent(
            Text.Builder(this, "Completare?")
                .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                .setColor(WHITE)
                .build()
        )
        column.addContent(
            Text.Builder(this, task.title)
                .setTypography(Typography.TYPOGRAPHY_BODY1)
                .setColor(WHITE)
                .setMaxLines(2)
                .setMultilineAlignment(LayoutElementBuilders.TEXT_ALIGN_CENTER)
                .setOverflow(LayoutElementBuilders.TEXT_OVERFLOW_ELLIPSIZE_END)
                .build()
        )
        column.addContent(
            LayoutElementBuilders.Row.Builder()
                .addContent(
                    Text.Builder(this, "✓")
                        .setTypography(Typography.TYPOGRAPHY_TITLE2)
                        .setColor(GREEN)
                        .setModifiers(
                            ModifiersBuilders.Modifiers.Builder()
                                .setClickable(loadActionClickable("confirm_${task.id}", COMPLETE_TASK_KEY, task.id))
                                .setPadding(ModifiersBuilders.Padding.Builder().setStart(DimensionBuilders.dp(16f)).setEnd(DimensionBuilders.dp(16f)).build())
                                .build()
                        )
                        .build()
                )
                .addContent(
                    Text.Builder(this, "✗")
                        .setTypography(Typography.TYPOGRAPHY_TITLE2)
                        .setColor(RED)
                        .setModifiers(
                            ModifiersBuilders.Modifiers.Builder()
                                .setClickable(loadActionClickable("cancel_${task.id}", PENDING_CONFIRM_KEY, null))
                                .setPadding(ModifiersBuilders.Padding.Builder().setStart(DimensionBuilders.dp(16f)).setEnd(DimensionBuilders.dp(16f)).build())
                                .build()
                        )
                        .build()
                )
                .build()
        )
        return column.build()
    }

    private fun buildListContent(tasks: List<WearTask>?): LayoutElementBuilders.LayoutElement {
        // Con overflow (più di MAX_ROWS task) la colonna riempie tutta
        // l'altezza del quadrante (invece di restare centrata come blocco
        // unico) così l'header può stare ancorato in alto e "+ altre X" in
        // fondo, guadagnando spazio per più righe nel mezzo — richiesta
        // esplicita di Flavio ("l'header più in alto per risparmiare spazio
        // in basso, +altre centrato in basso per avere altre 2 righe").
        // Senza overflow non serve: il contenuto resta compatto e centrato
        // nel Box esterno come prima.
        val hasOverflow = tasks != null && tasks.size > MAX_ROWS
        val column = LayoutElementBuilders.Column.Builder()
            .setWidth(DimensionBuilders.wrap())
            .setHeight(if (hasOverflow) DimensionBuilders.expand() else DimensionBuilders.wrap())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_START)

        column.addContent(
            Text.Builder(this, if (tasks == null) "📋 Task oggi" else "📋 Task oggi (${tasks.size})")
                .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                .setColor(WHITE)
                .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(openAppClickable("open_header")).build())
                .build()
        )

        when {
            tasks == null -> column.addContent(
                Text.Builder(this, "Tocca per aprire")
                    .setTypography(Typography.TYPOGRAPHY_BODY2)
                    .setColor(WHITE)
                    .build()
            )
            tasks.isEmpty() -> column.addContent(
                Text.Builder(this, "🎉 Niente in scadenza")
                    .setTypography(Typography.TYPOGRAPHY_BODY2)
                    .setColor(WHITE)
                    .build()
            )
            else -> {
                // Tocco sulla riga = chiede conferma (vedi buildConfirmContent),
                // non completa subito — evita un tocco accidentale sulla
                // lista che completi una task per sbaglio.
                tasks.take(MAX_ROWS).forEach { t ->
                    column.addContent(
                        Text.Builder(this, "${priorityDot(t.priority)} ${t.title}")
                            .setTypography(Typography.TYPOGRAPHY_BODY2)
                            .setColor(WHITE)
                            .setMaxLines(1)
                            .setOverflow(LayoutElementBuilders.TEXT_OVERFLOW_ELLIPSIZE_END)
                            .setModifiers(
                                ModifiersBuilders.Modifiers.Builder()
                                    .setClickable(loadActionClickable("pending_${t.id}", PENDING_CONFIRM_KEY, t.id))
                                    .build()
                            )
                            .build()
                    )
                }
                if (hasOverflow) {
                    column.addContent(
                        LayoutElementBuilders.Spacer.Builder()
                            .setHeight(DimensionBuilders.expand())
                            .build()
                    )
                    column.addContent(
                        Text.Builder(this, "+ altre ${tasks!!.size - MAX_ROWS}")
                            .setTypography(Typography.TYPOGRAPHY_CAPTION2)
                            .setColor(WHITE)
                            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(openAppClickable("open_more")).build())
                            .build()
                    )
                }
            }
        }
        return column.build()
    }
}
