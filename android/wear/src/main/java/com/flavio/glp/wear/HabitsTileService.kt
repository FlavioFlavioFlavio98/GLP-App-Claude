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
private const val HABITS_MAX_ROWS = 6

// Tre chiavi di stato per il flusso a due tocchi (riga → conferma a 3 opzioni
// → fatto): stesso schema di TasksTileService, ma col popup che offre
// Completa/Fallisci/Annulla invece del solo Completa/Annulla delle task —
// richiesta esplicita di Flavio.
private val HABIT_PENDING_CONFIRM_KEY = AppDataKey<DynamicBuilders.DynamicString>("pending_confirm_habit_id")
private val HABIT_DONE_KEY = AppDataKey<DynamicBuilders.DynamicString>("done_habit_id")
private val HABIT_FAILED_KEY = AppDataKey<DynamicBuilders.DynamicString>("failed_habit_id")

private val HABIT_WHITE = ColorBuilders.ColorProp.Builder().setArgb(0xFFFFFFFF.toInt()).build()
private val HABIT_GREEN = ColorBuilders.ColorProp.Builder().setArgb(0xFF4CAF50.toInt()).build()
private val HABIT_RED = ColorBuilders.ColorProp.Builder().setArgb(0xFFEB5757.toInt()).build()
private val HABIT_GRAY = ColorBuilders.ColorProp.Builder().setArgb(0xFFAAAAAA.toInt()).build()

// Tile "Abitudini oggi" — mini-lista fino a HABITS_MAX_ROWS abitudini non
// ancora completate né fallite oggi, stesso schema architetturale di
// TasksTileService (androidx.wear.protolayout.* per il layout/interattività,
// androidx.wear.tiles.* per l'involucro TileService — vedi commento lì per
// il perché). Tocco su una riga → riquadro di conferma con tre opzioni
// (✅ Completa, ❌ Fallisci, ↩ Annulla) invece di completare subito, per non
// rischiare un tocco accidentale — richiesta esplicita di Flavio.
class HabitsTileService : TileService() {

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest
    ): ListenableFuture<TileBuilders.Tile> {
        return CallbackToFutureAdapter.getFuture { completer ->
            val state = requestParams.currentState?.keyToValueMapping
            fun stringState(key: AppDataKey<DynamicBuilders.DynamicString>): String? =
                state?.get(key)?.let { if (it.hasStringValue()) it.stringValue else null }

            val toDone = stringState(HABIT_DONE_KEY)
            val toFail = stringState(HABIT_FAILED_KEY)
            val pendingConfirm = stringState(HABIT_PENDING_CONFIRM_KEY)

            fun loadAndBuild(pendingConfirmId: String?) {
                // preferCache=true: stessa ottimizzazione già fatta per la Tile
                // Task, la Tile restava nera per secondi ad ogni apertura.
                GlpRepository.loadPendingHabits(
                    preferCache = true,
                    onResult = { habits -> completer.set(buildTile(habits, pendingConfirmId)) },
                    onError = { _ -> completer.set(buildTile(null, null)) },
                )
            }

            when {
                // Passo 2: ✅ o ❌ toccato nel riquadro di conferma — applica
                // davvero. setHabitStatus usa una transazione Firestore
                // (necessaria per modificare in sicurezza un elemento
                // esistente dell'array "habits" più due liste di id, stessa
                // lezione della perdita dati del 28/8/2026) — non può essere
                // messa in coda offline: se fallisce (es. niente rete),
                // l'abitudine resta "da fare" invece di un errore silenzioso.
                toDone != null -> GlpRepository.setHabitStatus(
                    habitId = toDone,
                    action = "done",
                    onDone = { loadAndBuild(null) },
                    onError = { loadAndBuild(null) },
                )
                toFail != null -> GlpRepository.setHabitStatus(
                    habitId = toFail,
                    action = "failed",
                    onDone = { loadAndBuild(null) },
                    onError = { loadAndBuild(null) },
                )
                // Passo 1: riga toccata — mostra solo il riquadro di conferma
                // per quella abitudine, senza applicare nulla ancora.
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
                ActionBuilders.AndroidIntExtra.Builder().setValue(1).build(),
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

    private fun buildTile(habits: List<WearHabit>?, pendingConfirmId: String?): TileBuilders.Tile {
        val confirmHabit = pendingConfirmId?.let { id -> habits?.find { it.id == id } }

        val content: LayoutElementBuilders.LayoutElement = if (confirmHabit != null) {
            buildConfirmContent(confirmHabit)
        } else {
            buildListContent(habits)
        }

        // Padding per restare dentro l'area sicura del quadrante tondo —
        // stessi valori di TasksTileService, verificati via screenshot reale.
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

    private fun buildConfirmContent(habit: WearHabit): LayoutElementBuilders.LayoutElement {
        val column = LayoutElementBuilders.Column.Builder()
            .setWidth(DimensionBuilders.wrap())
            .setHeight(DimensionBuilders.wrap())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)

        column.addContent(
            Text.Builder(this, "${habit.emoji} ${habit.name}")
                .setTypography(Typography.TYPOGRAPHY_BODY1)
                .setColor(HABIT_WHITE)
                .setMaxLines(2)
                .setMultilineAlignment(LayoutElementBuilders.TEXT_ALIGN_CENTER)
                .setOverflow(LayoutElementBuilders.TEXT_OVERFLOW_ELLIPSIZE_END)
                .build()
        )
        fun actionText(symbol: String, color: ColorBuilders.ColorProp, id: String, key: AppDataKey<DynamicBuilders.DynamicString>, value: String?) =
            Text.Builder(this, symbol)
                .setTypography(Typography.TYPOGRAPHY_TITLE2)
                .setColor(color)
                .setModifiers(
                    ModifiersBuilders.Modifiers.Builder()
                        .setClickable(loadActionClickable(id, key, value))
                        .setPadding(ModifiersBuilders.Padding.Builder().setStart(DimensionBuilders.dp(10f)).setEnd(DimensionBuilders.dp(10f)).build())
                        .build()
                )
                .build()
        column.addContent(
            LayoutElementBuilders.Row.Builder()
                .addContent(actionText("✅", HABIT_GREEN, "done_${habit.id}", HABIT_DONE_KEY, habit.id))
                .addContent(actionText("❌", HABIT_RED, "fail_${habit.id}", HABIT_FAILED_KEY, habit.id))
                .addContent(actionText("↩", HABIT_GRAY, "cancel_${habit.id}", HABIT_PENDING_CONFIRM_KEY, null))
                .build()
        )
        return column.build()
    }

    private fun buildListContent(habits: List<WearHabit>?): LayoutElementBuilders.LayoutElement {
        // Stesso schema adattivo di TasksTileService: con overflow la colonna
        // riempie tutta l'altezza (header ancorato in alto, "+ altre X" in
        // fondo), altrimenti resta compatta e centrata.
        val hasOverflow = habits != null && habits.size > HABITS_MAX_ROWS
        val column = LayoutElementBuilders.Column.Builder()
            .setWidth(DimensionBuilders.wrap())
            .setHeight(if (hasOverflow) DimensionBuilders.expand() else DimensionBuilders.wrap())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_START)

        column.addContent(
            Text.Builder(this, if (habits == null) "✅ Abitudini" else "✅ Abitudini (${habits.size})")
                .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                .setColor(HABIT_WHITE)
                .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(openAppClickable("open_header")).build())
                .build()
        )

        when {
            habits == null -> column.addContent(
                Text.Builder(this, "Tocca per aprire")
                    .setTypography(Typography.TYPOGRAPHY_BODY2)
                    .setColor(HABIT_WHITE)
                    .build()
            )
            habits.isEmpty() -> column.addContent(
                Text.Builder(this, "🎉 Tutte fatte")
                    .setTypography(Typography.TYPOGRAPHY_BODY2)
                    .setColor(HABIT_WHITE)
                    .build()
            )
            else -> {
                // Tocco sulla riga = chiede conferma (vedi buildConfirmContent),
                // non applica subito — evita un tocco accidentale sulla
                // lista che completi/fallisca un'abitudine per sbaglio.
                habits.take(HABITS_MAX_ROWS).forEach { h ->
                    column.addContent(
                        Text.Builder(this, "${h.emoji} ${h.name}")
                            .setTypography(Typography.TYPOGRAPHY_BODY2)
                            .setColor(HABIT_WHITE)
                            .setMaxLines(1)
                            .setOverflow(LayoutElementBuilders.TEXT_OVERFLOW_ELLIPSIZE_END)
                            .setModifiers(
                                ModifiersBuilders.Modifiers.Builder()
                                    .setClickable(loadActionClickable("pending_${h.id}", HABIT_PENDING_CONFIRM_KEY, h.id))
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
                        Text.Builder(this, "+ altre ${habits!!.size - HABITS_MAX_ROWS}")
                            .setTypography(Typography.TYPOGRAPHY_CAPTION2)
                            .setColor(HABIT_WHITE)
                            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(openAppClickable("open_more")).build())
                            .build()
                    )
                }
            }
        }
        return column.build()
    }
}
