package com.flavio.glp.wear

import androidx.concurrent.futures.CallbackToFutureAdapter
import androidx.wear.tiles.ActionBuilders
import androidx.wear.tiles.LayoutElementBuilders
import androidx.wear.tiles.ModifiersBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.ResourceBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import androidx.wear.tiles.TimelineBuilders
import androidx.wear.tiles.material.Chip
import androidx.wear.tiles.material.Text
import androidx.wear.tiles.material.Typography
import androidx.wear.tiles.material.layouts.PrimaryLayout
import com.google.common.util.concurrent.ListenableFuture

private const val RESOURCES_VERSION = "1"

// Tile "Task oggi" — stesso raggiungimento a swipe della Tile punti
// (PointsTileService), ma qui il tocco apre l'app direttamente sulla pagina
// Task (MainActivity, extra start_page=2) invece della pagina Abitudini di
// default: risposta a "vedere con pochissimi click le task in scadenza
// oggi" — swipe sul quadrante + un tocco, senza dover scorrere le pagine.
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

    private fun buildTile(requestParams: RequestBuilders.TileRequest, tasks: List<WearTask>?): TileBuilders.Tile {
        val count = tasks?.size ?: 0
        val countText = if (tasks == null) "…" else "$count"
        val firstTitle = tasks?.firstOrNull()?.title

        val chip = Chip.Builder(this, openAppClickable(), requestParams.deviceParameters!!)
            .setPrimaryLabelContent(if (firstTitle != null) firstTitle else "Apri task")
            .apply { if (firstTitle != null && count > 1) setSecondaryLabelContent("+ altre ${count - 1}") }
            .build()

        val layout = PrimaryLayout.Builder(requestParams.deviceParameters!!)
            .setContent(
                Text.Builder(this, countText)
                    .setTypography(Typography.TYPOGRAPHY_DISPLAY2)
                    .build()
            )
            .setPrimaryLabelTextContent(
                Text.Builder(this, "📋 task oggi")
                    .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                    .build()
            )
            .setPrimaryChipContent(chip)
            .build()

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
