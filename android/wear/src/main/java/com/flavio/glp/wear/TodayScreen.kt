package com.flavio.glp.wear

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText

// (pagina di destinazione, emoji, etichetta) — Workout e Pasto in cima
// (le sezioni usate più spesso in movimento), Task in fondo perché già
// raggiungibile con una sola swipe a destra dalla pagina di apertura
// (Abitudini) — richiesta esplicita di Flavio.
private val QUICK_JUMP_DESTINATIONS = listOf(
    Triple(3, "💪", "Workout"),
    Triple(5, "🍽️", "Pasto"),
    Triple(1, "✅", "Abitudini"),
    Triple(4, "🥩", "Proteine"),
    Triple(6, "🔥", "Willpower"),
    Triple(7, "🧘", "Meditazione"),
    Triple(2, "📋", "Task"),
)

// Hub: accesso diretto a ogni sezione in un tap, invece di dover scorrere in
// orizzontale pagina per pagina per raggiungere le ultime (richiesta
// esplicita di Flavio: "se devo arrivare all'ultima devo scrollare tante
// volte"). Niente più punti/trofeo in cima (già visibili nella Tile
// dedicata) — così le scorciatoie iniziano subito, senza dover scrollare per
// vederle tutte.
@Composable
fun TodayScreen(onNavigate: (Int) -> Unit = {}) {
    val listState = rememberScalingLazyListState()
    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
            items(QUICK_JUMP_DESTINATIONS) { (page, emoji, label) ->
                Chip(
                    onClick = { onNavigate(page) },
                    label = { Text("$emoji $label") },
                    colors = ChipDefaults.secondaryChipColors(),
                    modifier = Modifier.padding(vertical = 2.dp),
                )
            }
        }
    }
}
