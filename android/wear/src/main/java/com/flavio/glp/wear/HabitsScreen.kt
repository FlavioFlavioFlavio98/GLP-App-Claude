package com.flavio.glp.wear

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
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
fun HabitsScreen(
    habits: List<WearHabit>,
    loading: Boolean,
    onToggle: (WearHabit) -> Unit,
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
                ListHeader { Text("🔁 Abitudini") }
            }
            if (habits.isEmpty() && !loading) {
                item { Text("Nessuna abitudine") }
            }
            items(habits) { habit ->
                Chip(
                    onClick = { onToggle(habit) },
                    label = {
                        Text(
                            "${habit.emoji} ${habit.name}",
                            maxLines = 1,
                            textDecoration = if (habit.done) TextDecoration.LineThrough else TextDecoration.None,
                        )
                    },
                    colors = if (habit.done) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                    modifier = Modifier.padding(vertical = 2.dp),
                )
            }
        }
    }
}
