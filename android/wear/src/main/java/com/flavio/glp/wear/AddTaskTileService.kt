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

// Tile "Nuova task" — le App Shortcuts (long-press sull'icona) non sono
// supportate dal launcher di Wear OS (verificato: le shortcut risultano
// registrate correttamente in ShortcutManager via `dumpsys shortcut`, ma
// nessuna UI di sistema le mostra), quindi replichiamo la stessa
// destinazione come Tile, il meccanismo di accesso rapido che Wear OS
// supporta davvero — un tocco apre l'app già con la dettatura vocale
// attiva (stessi extra start_page/auto_action già consumati da
// MainActivity.onNewIntent + TaskListScreen, vedi setupShortcuts).
class AddTaskTileService : TileService() {

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest
    ): ListenableFuture<TileBuilders.Tile> {
        return CallbackToFutureAdapter.getFuture { completer ->
            completer.set(buildTile(requestParams))
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

    private fun openVoiceAddClickable(): ModifiersBuilders.Clickable {
        val activity = ActionBuilders.AndroidActivity.Builder()
            .setPackageName(packageName)
            .setClassName("com.flavio.glp.wear.MainActivity")
            .addKeyToExtraMapping(
                EXTRA_START_PAGE,
                ActionBuilders.AndroidIntExtra.Builder().setValue(2).build(),
            )
            .addKeyToExtraMapping(
                EXTRA_AUTO_ACTION,
                ActionBuilders.AndroidStringExtra.Builder().setValue("add_task_voice").build(),
            )
            .build()
        val action = ActionBuilders.LaunchAction.Builder().setAndroidActivity(activity).build()
        return ModifiersBuilders.Clickable.Builder()
            .setId("open_add_task_voice")
            .setOnClick(action)
            .build()
    }

    private fun buildTile(requestParams: RequestBuilders.TileRequest): TileBuilders.Tile {
        val chip = Chip.Builder(this, openVoiceAddClickable(), requestParams.deviceParameters!!)
            .setPrimaryLabelContent("Detta ora")
            .build()

        val layout = PrimaryLayout.Builder(requestParams.deviceParameters!!)
            .setContent(
                Text.Builder(this, "🎤")
                    .setTypography(Typography.TYPOGRAPHY_DISPLAY2)
                    .build()
            )
            .setPrimaryLabelTextContent(
                Text.Builder(this, "nuova task")
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
            .setFreshnessIntervalMillis(60 * 60 * 1000L)
            .setTimeline(timeline)
            .build()
    }
}
