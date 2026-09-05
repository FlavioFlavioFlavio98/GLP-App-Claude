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

// Chiave di stato per il tocco su una riga task: portata dal Clickable
// (LoadAction) fino al prossimo onTileRequest, dove viene letta per capire
// quale task completare — vedi il commento esteso sulla classe più sotto.
private val COMPLETE_TASK_KEY = AppDataKey<DynamicBuilders.DynamicString>("complete_task_id")

// Bianco pieno invece del colore predefinito (grigio/secondario, poco
// leggibile su nero) degli stili CAPTION di Typography — "poco visibile"
// segnalato da Flavio guardando una foto reale del quadrante.
private val WHITE = ColorBuilders.ColorProp.Builder().setArgb(0xFFFFFFFF.toInt()).build()

// Tile "Task oggi" — mini-lista fino a 2 task con pallino colore priorità,
// raggiungibile a swipe dal quadrante. A differenza delle altre Tile
// dell'app (che usano ancora androidx.wear.tiles.material per Chip/Text),
// questa usa androidx.wear.protolayout.* direttamente: solo lì lo
// State/LoadAction ha metodi reali per portare dati (l'involucro
// androidx.wear.tiles.StateBuilders.State è uno stub vuoto, senza modo di
// impostare coppie chiave/valore) — necessario per completare una task
// toccando la sua riga senza aprire l'app, richiesta esplicita di Flavio.
// Il tocco sulla riga usa LoadAction (ricarica la Tile passando l'id della
// task completata in State), il tocco sull'intestazione/riga "+altre" apre
// ancora l'app (LaunchAction) per vedere/gestire la lista completa.
// TileService/TileBuilders/RequestBuilders/ResourceBuilders restano dal
// pacchetto tiles (la classe base e l'involucro Tile finale accettano
// entrambi un Timeline protolayout via setTileTimeline, verificato via
// javap prima di scrivere questo file).
class TasksTileService : TileService() {

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest
    ): ListenableFuture<TileBuilders.Tile> {
        return CallbackToFutureAdapter.getFuture { completer ->
            val clickedTaskId = requestParams.currentState
                ?.keyToValueMapping
                ?.get(COMPLETE_TASK_KEY)
                ?.let { if (it.hasStringValue()) it.stringValue else null }

            fun loadAndBuild() {
                GlpRepository.loadActiveTasks(
                    onResult = { tasks -> completer.set(buildTile(requestParams, tasks)) },
                    onError = { _ -> completer.set(buildTile(requestParams, null)) },
                )
            }

            if (clickedTaskId != null) {
                // completeTask usa una transazione Firestore (necessaria per
                // modificare in sicurezza un elemento esistente dell'array
                // "tasks", stessa lezione della perdita dati del 28/8/2026)
                // — non può essere messa in coda offline: se fallisce (es.
                // niente rete), loadAndBuild() ricarica comunque la task
                // ancora attiva, quindi semplicemente non sparisce dalla
                // Tile invece di un errore silenzioso a metà.
                GlpRepository.completeTask(
                    taskId = clickedTaskId,
                    onDone = { loadAndBuild() },
                    onError = { loadAndBuild() },
                )
            } else {
                loadAndBuild()
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

    private fun completeTaskClickable(taskId: String): ModifiersBuilders.Clickable {
        val state = StateBuilders.State.Builder()
            .addKeyToValueMapping(COMPLETE_TASK_KEY, DynamicDataBuilders.DynamicDataValue.fromString(taskId))
            .build()
        val action = ActionBuilders.LoadAction.Builder().setRequestState(state).build()
        return ModifiersBuilders.Clickable.Builder()
            .setId("complete_$taskId")
            .setOnClick(action)
            .build()
    }

    private fun priorityDot(priority: String): String = when (priority) {
        "high" -> "🔴"
        "low" -> "🔵"
        else -> "🟠"
    }

    private fun buildTile(requestParams: RequestBuilders.TileRequest, tasks: List<WearTask>?): TileBuilders.Tile {
        val column = LayoutElementBuilders.Column.Builder()
            .setWidth(DimensionBuilders.wrap())
            .setHeight(DimensionBuilders.wrap())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_START)

        column.addContent(
            Text.Builder(this, if (tasks == null) "📋 Task oggi" else "📋 Task oggi (${tasks.size})")
                .setTypography(Typography.TYPOGRAPHY_TITLE3)
                .setColor(WHITE)
                .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(openAppClickable("open_header")).build())
                .build()
        )

        when {
            tasks == null -> column.addContent(
                Text.Builder(this, "Tocca per aprire")
                    .setTypography(Typography.TYPOGRAPHY_BODY1)
                    .setColor(WHITE)
                    .build()
            )
            tasks.isEmpty() -> column.addContent(
                Text.Builder(this, "🎉 Niente in scadenza")
                    .setTypography(Typography.TYPOGRAPHY_BODY1)
                    .setColor(WHITE)
                    .build()
            )
            else -> {
                // Solo 2 invece di 3: testo più grande e leggibile conta più
                // di farcene stare di più — richiesta esplicita di Flavio.
                // Tocco sulla riga = completa direttamente (LoadAction),
                // senza aprire l'app.
                tasks.take(2).forEach { t ->
                    column.addContent(
                        Text.Builder(this, "${priorityDot(t.priority)} ${t.title}")
                            .setTypography(Typography.TYPOGRAPHY_BODY1)
                            .setColor(WHITE)
                            .setMaxLines(1)
                            .setOverflow(LayoutElementBuilders.TEXT_OVERFLOW_ELLIPSIZE_END)
                            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(completeTaskClickable(t.id)).build())
                            .build()
                    )
                }
                if (tasks.size > 2) {
                    column.addContent(
                        Text.Builder(this, "+ altre ${tasks.size - 2}")
                            .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                            .setColor(WHITE)
                            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(openAppClickable("open_more")).build())
                            .build()
                    )
                }
            }
        }

        // Padding per restare dentro l'area sicura del quadrante tondo.
        val padding = ModifiersBuilders.Padding.Builder()
            .setStart(DimensionBuilders.dp(28f))
            .setEnd(DimensionBuilders.dp(28f))
            .setTop(DimensionBuilders.dp(8f))
            .setBottom(DimensionBuilders.dp(8f))
            .build()
        val box = LayoutElementBuilders.Box.Builder()
            .setWidth(DimensionBuilders.expand())
            .setHeight(DimensionBuilders.expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(ModifiersBuilders.Modifiers.Builder().setPadding(padding).build())
            .addContent(column.build())

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
}
