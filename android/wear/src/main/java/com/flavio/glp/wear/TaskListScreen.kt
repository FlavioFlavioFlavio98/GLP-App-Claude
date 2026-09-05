package com.flavio.glp.wear

import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.itemsIndexed
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.foundation.rotary.RotaryScrollableDefaults
import androidx.wear.compose.foundation.rotary.rotaryScrollable
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import java.util.Locale

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
    onAddTask: (String, String) -> Unit,
) {
    val listState = rememberScalingLazyListState()
    val rotaryFocusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) { rotaryFocusRequester.requestFocus() }
    // Indice della task "a fuoco" al centro dello schermo mentre si scorre
    // con la rotella/corona fisica — 0=ListHeader, 1=Chip "Detta task", poi
    // le task da indice 2 in poi (solo quando l'elenco non è vuoto, unico
    // caso in cui non c'è l'item extra "Nessuna task attiva" di mezzo).
    // Serve per il pulsante ✓ fisso in basso: più comodo di toccare
    // precisamente una riga stretta, richiesta esplicita di Flavio ("posso
    // scorrere con la rotella e selezionare, poi un pulsante grande in
    // basso per completare?").
    val selectedTaskIndex = listState.centerItemIndex - 2
    val selectedTask = tasks.getOrNull(selectedTaskIndex)
    var confirmTask by remember { mutableStateOf<WearTask?>(null) }
    // Titolo+scadenza già interpretati dal comando vocale, in attesa di
    // conferma — non si crea la task finché non tocchi "OK, crea": un
    // errore di trascrizione qui creerebbe una task sbagliata senza che te
    // ne accorga, stessa scelta già fatta sul telefono per lo stesso motivo.
    var pendingTitle by remember { mutableStateOf<String?>(null) }
    var pendingDeadline by remember { mutableStateOf("") }

    // Riconoscimento vocale diretto (schermata di sistema "sto ascoltando")
    // invece del picker generico tastiera/voce/scrittura di
    // RemoteInputIntentHelper — quello va bene per un campo di testo
    // qualsiasi (es. password di login), ma qui l'obiettivo è "un tocco e
    // parlo" senza passaggi in più. Stesso approccio di VoiceAddTaskActivity.
    val voiceLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val spoken = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            ?.firstOrNull()?.trim()
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
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Detta la task...")
        }
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
                modifier = Modifier
                    .fillMaxSize()
                    .focusRequester(rotaryFocusRequester)
                    .focusable()
                    .rotaryScrollable(
                        behavior = RotaryScrollableDefaults.snapBehavior(listState),
                        focusRequester = rotaryFocusRequester,
                    ),
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
                itemsIndexed(tasks) { index, task ->
                    val isSelected = index == selectedTaskIndex
                    Chip(
                        onClick = { confirmTask = task },
                        label = { Text((if (isSelected) "👉 " else "") + task.title, maxLines = 1) },
                        secondaryLabel = { Text("+${task.reward}pt") },
                        colors = ChipDefaults.chipColors(
                            backgroundColor = priorityColor(task.priority).copy(alpha = if (isSelected) 0.55f else 0.25f),
                        ),
                        modifier = Modifier.padding(vertical = 2.dp),
                    )
                }
                // Spazio in fondo per non far restare l'ultima task nascosta
                // dietro il pulsante ✓ fisso qui sotto.
                if (tasks.isNotEmpty()) {
                    item { Box(modifier = Modifier.size(1.dp)) }
                }
            }
        }

        // Pulsante ✓ grande e fisso in basso: completa la task attualmente
        // "a fuoco" al centro (scelta scorrendo con la rotella/corona) invece
        // di dover toccare con precisione una riga stretta — richiesta
        // esplicita di Flavio. Nascosto sopra gli overlay di conferma (sono
        // dichiarati dopo nel Box e coprono tutto lo schermo comunque).
        if (selectedTask != null && confirmTask == null && pendingTitle == null) {
            Button(
                onClick = { confirmTask = selectedTask },
                colors = ButtonDefaults.primaryButtonColors(backgroundColor = Color(0xFF4CAF50)),
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 2.dp)
                    .size(ButtonDefaults.LargeButtonSize),
            ) {
                Text("✓", style = MaterialTheme.typography.title1)
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
