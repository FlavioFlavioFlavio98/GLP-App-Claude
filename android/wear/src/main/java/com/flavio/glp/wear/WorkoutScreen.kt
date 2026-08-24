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
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText

@Composable
fun WorkoutScreen(
    exercises: List<WearExercise>,
    loading: Boolean,
    lastLoggedName: String?,
    onLogSet: (WearExercise) -> Unit,
) {
    val listState = rememberScalingLazyListState()

    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(
            modifier = Modifier.fillMaxSize(),
            state = listState,
        ) {
            item {
                ListHeader { Text("💪 Workout") }
            }
            if (lastLoggedName != null) {
                item { Text("✅ +10 $lastLoggedName") }
            }
            if (exercises.isEmpty() && !loading) {
                item { Text("Nessun esercizio configurato") }
            }
            items(exercises) { exercise ->
                Chip(
                    onClick = { onLogSet(exercise) },
                    label = { Text("${exercise.emoji} ${exercise.name}", maxLines = 1) },
                    secondaryLabel = { Text("+10 reps rapido") },
                    colors = ChipDefaults.secondaryChipColors(),
                    modifier = Modifier.padding(vertical = 2.dp),
                )
            }
        }
    }
}
