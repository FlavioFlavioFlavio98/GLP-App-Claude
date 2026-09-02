package com.flavio.glp.wear

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText

// (pagina di destinazione, emoji, etichetta) — stesso ordine delle pagine in
// MainActivity.kt (0 è questa hub, quindi non compare in lista).
private val QUICK_JUMP_DESTINATIONS = listOf(
    Triple(1, "✅", "Abitudini"),
    Triple(2, "📋", "Task"),
    Triple(3, "💪", "Workout"),
    Triple(4, "🥩", "Proteine"),
    Triple(5, "🍽️", "Pasto"),
    Triple(6, "🔥", "Willpower"),
    Triple(7, "🧘", "Meditazione"),
)

// Hub: punteggio di oggi + accesso diretto a ogni sezione in un tap, invece
// di dover scorrere in orizzontale pagina per pagina per raggiungere le
// ultime (richiesta esplicita di Flavio: "se devo arrivare all'ultima devo
// scrollare tante volte").
@Composable
fun TodayScreen(score: Double, loading: Boolean, onNavigate: (Int) -> Unit = {}) {
    val listState = rememberScalingLazyListState()
    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
            item {
                Text(text = "🏆", style = MaterialTheme.typography.display2, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }
            item {
                Text(
                    text = if (loading) "..." else score.toInt().toString(),
                    style = MaterialTheme.typography.display1,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                )
            }
            item {
                Text(
                    text = "punti oggi",
                    style = MaterialTheme.typography.caption2,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
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
