package com.flavio.glp.wear

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.input.RemoteInputIntentHelper

private const val WILLPOWER_TEXT_INPUT_KEY = "willpower_text_input"

// Log rapido: cosa dovevi fare/resistere (dettato, stesso meccanismo del
// "detta task" in TaskListScreen) → riuscito o no → quanti punti — stesso
// flusso in 3 domande di AddWillpowerActivity.kt sul telefono.
@Composable
fun WillpowerScreen(
    lastLoggedText: String?,
    onLogWillpower: (String, Boolean, Int, (Double) -> Unit) -> Unit,
) {
    var text by remember { mutableStateOf("") }
    var succeeded by remember { mutableStateOf<Boolean?>(null) }
    var points by remember { mutableIntStateOf(0) }
    var submitting by remember { mutableStateOf(false) }

    val voiceLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val data = result.data
        val spoken = data?.let { android.app.RemoteInput.getResultsFromIntent(it) }
            ?.getCharSequence(WILLPOWER_TEXT_INPUT_KEY)?.toString()
        if (!spoken.isNullOrBlank()) text = spoken.trim()
    }

    fun launchVoiceInput() {
        val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
        val remoteInputs = listOf(
            android.app.RemoteInput.Builder(WILLPOWER_TEXT_INPUT_KEY)
                .setLabel("Cosa dovevi fare/resistere?")
                .build()
        )
        RemoteInputIntentHelper.putRemoteInputsExtra(intent, remoteInputs)
        voiceLauncher.launch(intent)
    }

    fun reset() {
        text = ""; succeeded = null; points = 0; submitting = false
    }

    val listState = rememberScalingLazyListState()
    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
            item { ListHeader { Text("🔥 Willpower") } }
            if (lastLoggedText != null) {
                item { Text("✅ $lastLoggedText", style = MaterialTheme.typography.caption2, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
            }
            item {
                Chip(
                    onClick = { launchVoiceInput() },
                    label = { Text(if (text.isEmpty()) "🎤 Detta cosa è successo" else text, maxLines = 2) },
                    colors = if (text.isEmpty()) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                    modifier = Modifier.padding(vertical = 2.dp),
                )
            }
            if (text.isNotEmpty()) {
                item {
                    Row(modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
                        CompactChip(
                            onClick = { succeeded = true },
                            label = { Text("✅ Fatto") },
                            colors = if (succeeded == true) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                            modifier = Modifier.padding(2.dp),
                        )
                        CompactChip(
                            onClick = { succeeded = false },
                            label = { Text("❌ Non fatto") },
                            colors = if (succeeded == false) ChipDefaults.chipColors(backgroundColor = Color(0xFFE53935)) else ChipDefaults.secondaryChipColors(),
                            modifier = Modifier.padding(2.dp),
                        )
                    }
                }
            }
            if (succeeded != null) {
                item {
                    Row(modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
                        (1..5).forEach { v ->
                            CompactChip(
                                onClick = { points = v },
                                label = { Text("$v") },
                                colors = if (points == v) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                                modifier = Modifier.padding(1.dp),
                            )
                        }
                    }
                }
                item {
                    Chip(
                        onClick = {
                            val outcome = succeeded
                            if (!submitting && outcome != null && points > 0 && text.isNotBlank()) {
                                submitting = true
                                onLogWillpower(text, outcome, points) { reset() }
                            }
                        },
                        label = { Text("Salva") },
                        colors = ChipDefaults.primaryChipColors(),
                        modifier = Modifier.padding(top = 10.dp),
                    )
                }
            }
        }
    }
}
