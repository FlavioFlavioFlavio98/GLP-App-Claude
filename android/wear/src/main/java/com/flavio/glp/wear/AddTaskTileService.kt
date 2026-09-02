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
import androidx.wear.tiles.material.Button
import androidx.wear.tiles.material.ButtonColors
import androidx.wear.tiles.material.ButtonDefaults
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
// supporta davvero. Il tocco apre VoiceAddTaskActivity (non MainActivity):
// ascolta subito col riconoscimento vocale diretto invece di passare dalla
// UI completa dell'app o dal picker generico tastiera/voce — vedi
// VoiceAddTaskActivity.kt.
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
            .setClassName("com.flavio.glp.wear.VoiceAddTaskActivity")
            .build()
        val action = ActionBuilders.LaunchAction.Builder().setAndroidActivity(activity).build()
        return ModifiersBuilders.Clickable.Builder()
            .setId("open_add_task_voice")
            .setOnClick(action)
            .build()
    }

    private fun buildTile(requestParams: RequestBuilders.TileRequest): TileBuilders.Tile {
        // Button circolare invece di Chip (una pillola rettangolare, che
        // taglia lo schermo tondo in modo poco naturale) — sfondo blu pieno
        // per dare all'emoji microfono un contrasto netto invece di
        // galleggiare sottile sul nero, richiesta esplicita di Flavio.
        val micButton = Button.Builder(this, openVoiceAddClickable())
            .setButtonColors(ButtonColors(0xFF4A90D9.toInt(), 0xFFFFFFFF.toInt()))
            .setSize(ButtonDefaults.LARGE_SIZE)
            .setTextContent("🎤", Typography.TYPOGRAPHY_TITLE1)
            .build()

        val layout = PrimaryLayout.Builder(requestParams.deviceParameters!!)
            .setContent(micButton)
            .setPrimaryLabelTextContent(
                Text.Builder(this, "nuova task")
                    .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                    .build()
            )
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
