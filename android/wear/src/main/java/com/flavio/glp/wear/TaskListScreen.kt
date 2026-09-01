package com.flavio.glp.wear

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.wear.input.RemoteInputIntentHelper

private fun priorityColor(priority: String): Color = when (priority) {
    "high" -> Color(0xFFEB5757)
    "low" -> Color(0xFF4A90D9)
    else -> Color(0xFFF2994A)
}

private const val VOICE_TASK_INPUT_KEY = "voice_task_input"

@Composable
fun TaskListScreen(
    tasks: List<WearTask>,
    loading: Boolean,
    onComplete: (WearTask) -> Unit,
    onAddTask: (String, String) -> Unit,
) {
    val listState = rememberScalingLazyListState()
    var confirmTask by remember { mutableStateOf<WearTask?>(null) }
    // Titolo+scadenza già interpretati dal comando vocale, in attesa di
    // conferma — non si crea la task finché non tocchi "OK, crea": un
    // errore di trascrizione qui creerebbe una task sbagliata senza che te
    // ne accorga, stessa scelta già fatta sul telefono per lo stesso motivo.
    var pendingTitle by remember { mutableStateOf<String?>(null) }
    var pendingDeadline by remember { mutableStateOf("") }

    // Stesso meccanismo già usato per la password di login in MainActivity:
    // apre il selettore di input di sistema di Wear OS (tastiera/voce/scrittura
    // a mano) — "voce" è già lì di default, non serve il permesso RECORD_AUDIO
    // né un riconoscimento vocale gestito da noi.
    val voiceLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val data = result.data
        val spoken = data?.let { android.app.RemoteInput.getResultsFromIntent(it) }
            ?.getCharSequence(VOICE_TASK_INPUT_KEY)?.toString()
        if (!spoken.isNullOrBlank()) {
            val parsed = VoiceDateParser.parse(spoken)
            if (parsed.title.isNotEmpty()) {
                pendingTitle = parsed.title
                pendingDeadline = parsed.deadline ?: today()
            }
            // Titolo vuoto (es. ha detto solo "domani") → non capito, ignora
            // silenziosamente invece di creare una task fantasma.
        }
    }

    fun launchVoiceInput() {
        val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
        val remoteInputs = listOf(
            android.app.RemoteInput.Builder(VOICE_TASK_INPUT_KEY)
                .setLabel("Detta la task...")
                .build()
        )
        RemoteInputIntentHelper.putRemoteInputsExtra(intent, remoteInputs)
        voiceLauncher.launch(intent)
    }

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
                item {
                    Chip(
                        onClick = { launchVoiceInput() },
                        label = { Text("🎤 Detta task") },
                        colors = ChipDefaults.primaryChipColors(),
                        modifier = Modifier.padding(vertical = 2.dp),
                    )
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

        // Overlay di conferma completamento fatto a mano (niente componente
        // Dialog di Wear Compose Material — non disponibile in questa versione
        // della libreria).
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

        // Overlay di conferma nuova task dettata — stesso schema dell'overlay
        // di completamento qui sopra.
        val title = pendingTitle
        if (title != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.85f)),
            ) {
                ScalingLazyColumn(modifier = Modifier.fillMaxSize()) {
                    item { Text("Nuova task") }
                    item { Text(title, style = MaterialTheme.typography.caption1) }
                    item { Text("📅 ${VoiceDateParser.formatDisplay(pendingDeadline)}", style = MaterialTheme.typography.caption2) }
                    item {
                        Chip(
                            onClick = {
                                onAddTask(title, pendingDeadline)
                                pendingTitle = null
                            },
                            label = { Text("OK, crea") },
                            colors = ChipDefaults.primaryChipColors(),
                        )
                    }
                    item {
                        Chip(
                            onClick = { pendingTitle = null },
                            label = { Text("Annulla") },
                            colors = ChipDefaults.secondaryChipColors(),
                        )
                    }
                }
            }
        }
    }
}
