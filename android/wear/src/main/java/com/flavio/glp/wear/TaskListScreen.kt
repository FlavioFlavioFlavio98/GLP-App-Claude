package com.flavio.glp.wear

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText

private fun priorityColor(priority: String): Color = when (priority) {
    "high" -> Color(0xFFEB5757)
    "low" -> Color(0xFF4A90D9)
    else -> Color(0xFFF2994A)
}

@Composable
fun TaskListScreen(
    tasks: List<WearTask>,
    loading: Boolean,
    onComplete: (WearTask) -> Unit,
) {
    val listState = rememberScalingLazyListState()
    var confirmTask by remember { mutableStateOf<WearTask?>(null) }

    // Tutto dentro un unico Box esterno (invece di due composable "fratelli"
    // allo stesso livello) — con due nodi separati lo stato dell'overlay di
    // conferma non arrivava mai a schermo dentro lo slot pagina di HorizontalPager.
    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            timeText = { TimeText() },
            positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
        ) {
            ScalingLazyColumn(
                modifier = Modifier.fillMaxSize(),
                state = listState,
            ) {
                item {
                    ListHeader { Text("✅ Task") }
                }
                if (tasks.isEmpty() && !loading) {
                    item { Text("Nessuna task attiva 🎉") }
                }
                items(tasks) { task ->
                    Chip(
                        onClick = { confirmTask = task },
                        label = { Text(task.title, maxLines = 1) },
                        secondaryLabel = { Text("+${task.reward}pt") },
                        colors = ChipDefaults.chipColors(backgroundColor = priorityColor(task.priority).copy(alpha = 0.25f)),
                        modifier = Modifier.padding(vertical = 2.dp),
                    )
                }
            }
        }

        // Overlay di conferma fatto a mano (niente componente Dialog di Wear
        // Compose Material — non disponibile in questa versione della libreria).
        val taskToConfirm = confirmTask
        if (taskToConfirm != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.85f)),
            ) {
                ScalingLazyColumn(modifier = Modifier.fillMaxSize()) {
                    item { Text("Completata?") }
                    item { Text(taskToConfirm.title, style = MaterialTheme.typography.caption1) }
                    item {
                        Chip(
                            onClick = {
                                onComplete(taskToConfirm)
                                confirmTask = null
                            },
                            label = { Text("Sì, completata!") },
                            colors = ChipDefaults.primaryChipColors(),
                        )
                    }
                    item {
                        Chip(
                            onClick = { confirmTask = null },
                            label = { Text("Annulla") },
                            colors = ChipDefaults.secondaryChipColors(),
                        )
                    }
                }
            }
        }
    }
}
