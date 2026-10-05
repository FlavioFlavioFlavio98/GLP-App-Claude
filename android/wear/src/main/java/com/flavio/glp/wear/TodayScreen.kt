package com.flavio.glp.wear

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
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
    val context = LocalContext.current
    // Momenti di consapevolezza: primo elemento dell'hub, un tocco ne registra
    // uno (stessa schermata di conferma di complicazione e Tile) — richiesta
    // esplicita di Flavio: "0/3 in homepage, se clicco ne aggiungo 1".
    val mindful by MindfulStore.state.collectAsState()
    LaunchedEffect(Unit) {
        MindfulStore.refreshState(context)
        MindfulStore.ensureListening(context)
    }
    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
            item {
                Chip(
                    onClick = { context.startActivity(Intent(context, MindfulAddActivity::class.java)) },
                    label = { Text("🧘 Consapevolezza") },
                    secondaryLabel = { Text("${mindful.count}/${mindful.goal} oggi · tocca per +1") },
                    colors = if (mindful.count >= mindful.goal) ChipDefaults.secondaryChipColors() else ChipDefaults.primaryChipColors(),
                    modifier = Modifier.padding(vertical = 2.dp),
                )
            }
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
