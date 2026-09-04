package com.flavio.glp.wear

import androidx.concurrent.futures.CallbackToFutureAdapter
import androidx.wear.tiles.ActionBuilders
import androidx.wear.tiles.DimensionBuilders
import androidx.wear.tiles.LayoutElementBuilders
import androidx.wear.tiles.ModifiersBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.ResourceBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import androidx.wear.tiles.TimelineBuilders
import androidx.wear.tiles.material.Text
import androidx.wear.tiles.material.Typography
import com.google.common.util.concurrent.ListenableFuture

private const val RESOURCES_VERSION = "1"

// Tile "Task oggi" — raggiungibile a swipe dal quadrante come le altre Tile.
// A differenza della prima versione (solo conteggio + prima task in un
// Chip), mostra una vera mini-lista fino a 3 task con pallino colore
// priorità, per vedere cosa c'è da fare senza nemmeno dover toccare —
// richiesta esplicita di Flavio ("accesso rapido... alla lista delle task
// di oggi"). Il tocco su tutta la Tile apre comunque l'app sulla pagina
// Task (extra start_page=2) per completarle/vederle tutte.
class TasksTileService : TileService() {

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest
    ): ListenableFuture<TileBuilders.Tile> {
        return CallbackToFutureAdapter.getFuture { completer ->
            GlpRepository.loadActiveTasks(
                onResult = { tasks -> completer.set(buildTile(requestParams, tasks)) },
                onError = { _ -> completer.set(buildTile(requestParams, null)) },
            )
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

    private fun openAppClickable(): ModifiersBuilders.Clickable {
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
            .setId("open_tasks")
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
                .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                .build()
        )

        when {
            tasks == null -> column.addContent(
                Text.Builder(this, "Tocca per aprire")
                    .setTypography(Typography.TYPOGRAPHY_CAPTION2)
                    .build()
            )
            tasks.isEmpty() -> column.addContent(
                Text.Builder(this, "🎉 Niente in scadenza")
                    .setTypography(Typography.TYPOGRAPHY_CAPTION2)
                    .build()
            )
            else -> {
                tasks.take(3).forEach { t ->
                    column.addContent(
                        Text.Builder(this, "${priorityDot(t.priority)} ${t.title}")
                            .setTypography(Typography.TYPOGRAPHY_CAPTION2)
                            .setMaxLines(1)
                            .setOverflow(LayoutElementBuilders.TEXT_OVERFLOW_ELLIPSIZE_END)
                            .build()
                    )
                }
                if (tasks.size > 3) {
                    column.addContent(
                        Text.Builder(this, "+ altre ${tasks.size - 3}")
                            .setTypography(Typography.TYPOGRAPHY_CAPTION3)
                            .build()
                    )
                }
            }
        }

        // Padding per restare dentro l'area sicura del quadrante tondo, e
        // tocco su tutta l'area (non solo il testo) per aprire l'app —
        // stesso ID/azione della versione precedente basata su Chip.
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
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setClickable(openAppClickable())
                    .setPadding(padding)
                    .build()
            )
            .addContent(column.build())

        val layout = box.build()

        val timeline = TimelineBuilders.Timeline.Builder()
            .addTimelineEntry(
                TimelineBuilders.TimelineEntry.Builder()
                    .setLayout(
                        LayoutElementBuilders.Layout.Builder()
                            .setRoot(layout)
                            .build()
                    )
                    .build()
            )
            .build()

        return TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setFreshnessIntervalMillis(15 * 60 * 1000L)
            .setTimeline(timeline)
            .build()
    }
}
