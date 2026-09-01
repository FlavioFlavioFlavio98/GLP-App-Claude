package com.flavio.glp.wear

import androidx.concurrent.futures.CallbackToFutureAdapter
import androidx.wear.tiles.LayoutElementBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.ResourceBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import androidx.wear.tiles.TimelineBuilders
import androidx.wear.tiles.material.Text
import androidx.wear.tiles.material.Typography
import androidx.wear.tiles.material.layouts.PrimaryLayout
import com.google.common.util.concurrent.ListenableFuture

private const val RESOURCES_VERSION = "1"

// Tile "punti di oggi" — raggiungibile scorrendo da destra sul quadrante
// senza aprire l'app, richiesta esplicita di Flavio ("credi sia possibile
// vedere i punti senza aprire l'app watch?"). Preferita a una complicazione
// sul quadrante perché funziona con qualsiasi quadrante installato, senza
// bisogno di configurarla manualmente in uno slot dedicato.
class PointsTileService : TileService() {

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest
    ): ListenableFuture<TileBuilders.Tile> {
        return CallbackToFutureAdapter.getFuture { completer ->
            GlpRepository.loadScore(
                onResult = { score -> completer.set(buildTile(requestParams, score)) },
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

    private fun buildTile(requestParams: RequestBuilders.TileRequest, score: Double?): TileBuilders.Tile {
        val text = if (score != null) "🏆 ${score.toInt()}" else "🏆 …"
        val layout = PrimaryLayout.Builder(requestParams.deviceParameters!!)
            .setContent(
                Text.Builder(this, text)
                    .setTypography(Typography.TYPOGRAPHY_DISPLAY2)
                    .build()
            )
            .setPrimaryLabelTextContent(
                Text.Builder(this, "punti oggi")
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

        // Aggiornamento periodico ogni 15 minuti (stesso intervallo di
        // WidgetUpdateWorker sul telefono) — più un refresh immediato ogni
        // volta che si registra qualcosa dal watch stesso, vedi le chiamate a
        // TileService.getUpdater(context).requestUpdate(...) nelle altre
        // schermate dopo un'azione riuscita.
        return TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setFreshnessIntervalMillis(15 * 60 * 1000L)
            .setTimeline(timeline)
            .build()
    }
}
