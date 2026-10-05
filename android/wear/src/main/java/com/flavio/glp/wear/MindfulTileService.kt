package com.flavio.glp.wear

import androidx.concurrent.futures.CallbackToFutureAdapter
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders
import androidx.wear.protolayout.DimensionBuilders
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.protolayout.material.Text
import androidx.wear.protolayout.material.Typography
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.ResourceBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.ListenableFuture

private const val RESOURCES_VERSION = "1"

private val MINDFUL_WHITE = ColorBuilders.ColorProp.Builder().setArgb(0xFFFFFFFF.toInt()).build()
private val MINDFUL_GREEN = ColorBuilders.ColorProp.Builder().setArgb(0xFF4CAF50.toInt()).build()
private val MINDFUL_GRAY = ColorBuilders.ColorProp.Builder().setArgb(0xFFAAAAAA.toInt()).build()
private val MINDFUL_ACCENT = ColorBuilders.ColorProp.Builder().setArgb(0xFFFFCA28.toInt()).build()

// Tile "Consapevolezza" — alternativa alla complicazione per i quadranti senza
// slot liberi: scorrendo dal quadrante mostra "1/3" in grande; un tocco in
// qualunque punto registra un momento (stessa MindfulAddActivity della
// complicazione). Conteggio dalla copia locale di MindfulStore, quindi la Tile
// si disegna subito senza leggere Firestore.
class MindfulTileService : TileService() {

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest
    ): ListenableFuture<TileBuilders.Tile> {
        return CallbackToFutureAdapter.getFuture { completer ->
            // Riallinea al server in sottofondo (momenti aggiunti da telefono/web):
            // se cambia qualcosa MindfulStore richiede un nuovo disegno della Tile.
            MindfulStore.ensureListening(this)
            completer.set(buildTile(MindfulStore.count(this), MindfulStore.goal(this)))
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

    private fun addClickable(): ModifiersBuilders.Clickable {
        val activity = ActionBuilders.AndroidActivity.Builder()
            .setPackageName(packageName)
            .setClassName("com.flavio.glp.wear.MindfulAddActivity")
            .build()
        return ModifiersBuilders.Clickable.Builder()
            .setId("mindful_add")
            .setOnClick(ActionBuilders.LaunchAction.Builder().setAndroidActivity(activity).build())
            .build()
    }

    private fun buildTile(count: Int, goal: Int): TileBuilders.Tile {
        val reached = count >= goal
        val column = LayoutElementBuilders.Column.Builder()
            .setWidth(DimensionBuilders.wrap())
            .setHeight(DimensionBuilders.wrap())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(
                Text.Builder(this, "🧘 Consapevolezza")
                    .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                    .setColor(MINDFUL_GRAY)
                    .build()
            )
            .addContent(
                Text.Builder(this, "$count/$goal")
                    .setTypography(Typography.TYPOGRAPHY_DISPLAY1)
                    .setColor(if (reached) MINDFUL_GREEN else MINDFUL_WHITE)
                    .build()
            )
            .addContent(
                Text.Builder(this, if (reached) "Obiettivo raggiunto · tocca per +1" else "Tocca per aggiungere")
                    .setTypography(Typography.TYPOGRAPHY_CAPTION2)
                    .setColor(MINDFUL_ACCENT)
                    .build()
            )
            .build()

        // Tutta la Tile è il pulsante: nessun bersaglio piccolo da centrare.
        val box = LayoutElementBuilders.Box.Builder()
            .setWidth(DimensionBuilders.expand())
            .setHeight(DimensionBuilders.expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(addClickable()).build())
            .addContent(column)

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
