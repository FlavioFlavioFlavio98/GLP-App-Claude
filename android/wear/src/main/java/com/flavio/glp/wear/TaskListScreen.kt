package com.flavio.glp.wear

import android.content.Context
import android.content.Intent
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
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
import kotlinx.coroutines.delay
import java.util.Locale

private fun priorityColor(priority: String): Color = when (priority) {
    "high" -> Color(0xFFEB5757)
    "low" -> Color(0xFF4A90D9)
    else -> Color(0xFFF2994A)
}

// ─── Timer per task ─────────────────────────────────────────────────────────
// Sessione (task + orario di inizio) persistita in SharedPreferences, non
// solo nello stato del composable — stesso motivo di MealScreen/MealsTab:
// cambiare pagina o chiudere l'app non deve far perdere il cronometro in
// corso. Richiesta esplicita di Flavio: vuole capire quanto tempo passa su
// ogni task, con una schermata dedicata (solo nome + cronometro) e una
// vibrazione ogni 60s per ricordargli di fermarlo se ha cambiato task.
private const val TASK_TIMER_PREFS = "glp_task_timer_session"
private const val KEY_TIMER_TASK_ID = "task_id"
private const val KEY_TIMER_TASK_TITLE = "task_title"
private const val KEY_TIMER_START_MILLIS = "start_millis"
private const val TASK_TIMER_REMINDER_SEC = 60

private fun vibrate(context: Context, ms: Long = 300) {
    try {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            val v = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
        }
    } catch (e: Exception) { /* ignora — il timer funziona comunque senza feedback aptico */ }
}

private data class TaskTimerSession(val taskId: String, val taskTitle: String, val startMillis: Long)

private fun readTaskTimerSession(prefs: android.content.SharedPreferences): TaskTimerSession? {
    val taskId = prefs.getString(KEY_TIMER_TASK_ID, null) ?: return null
    val start = prefs.getLong(KEY_TIMER_START_MILLIS, 0L)
    if (start <= 0L) return null
    val title = prefs.getString(KEY_TIMER_TASK_TITLE, null) ?: ""
    return TaskTimerSession(taskId, title, start)
}

private fun fmtElapsed(totalSeconds: Int): String {
    val m = totalSeconds / 60
    val s = totalSeconds % 60
    return "%02d:%02d".format(m, s)
}

@Composable
fun TaskListScreen(
    tasks: List<WearTask>,
    loading: Boolean,
    onComplete: (WearTask) -> Unit,
    onAddTask: (String, String) -> Unit,
    onAddTaskTime: (WearTask, Int) -> Unit,
) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(TASK_TIMER_PREFS, Context.MODE_PRIVATE) }

    val listState = rememberScalingLazyListState()
    var confirmTask by remember { mutableStateOf<WearTask?>(null) }
    // Titolo+scadenza già interpretati dal comando vocale, in attesa di
    // conferma — non si crea la task finché non tocchi "OK, crea": un
    // errore di trascrizione qui creerebbe una task sbagliata senza che te
    // ne accorga, stessa scelta già fatta sul telefono per lo stesso motivo.
    var pendingTitle by remember { mutableStateOf<String?>(null) }
    var pendingDeadline by remember { mutableStateOf("") }

    // Timer per task: sessione ripristinata da SharedPreferences al mount,
    // elapsed sempre ricalcolato da (adesso - inizio) invece di un contatore
    // incrementale — stesso principio di MealScreen, sopravvive a schermo
    // spento/ambient.
    var timerSession by remember { mutableStateOf<TaskTimerSession?>(null) }
    var elapsed by remember { mutableIntStateOf(0) }
    var tick by remember { mutableIntStateOf(0) }

    @Suppress("UNUSED_EXPRESSION") tick

    LaunchedEffect(Unit) {
        timerSession = readTaskTimerSession(prefs)
    }

    LaunchedEffect(timerSession?.startMillis) {
        val session = timerSession ?: return@LaunchedEffect
        while (true) {
            val now = ((System.currentTimeMillis() - session.startMillis) / 1000).toInt().coerceAtLeast(0)
            elapsed = now
            if (now > 0 && now % TASK_TIMER_REMINDER_SEC == 0) vibrate(context)
            delay(1000)
        }
    }

    // Senza questo, Wear OS considera l'assenza di tocchi sullo schermo
    // (normale: qui c'è solo un cronometro da guardare) come inattività e
    // dopo un po' spegne lo schermo/torna al quadrante — richiesta esplicita
    // di Flavio: il timer deve restare in primo piano finché non lo fermi.
    // Stesso pattern già usato per il timer del pasto in MealScreen.
    val view = LocalView.current
    DisposableEffect(timerSession != null) {
        view.keepScreenOn = timerSession != null
        onDispose { view.keepScreenOn = false }
    }

    fun startTimer(task: WearTask) {
        val start = System.currentTimeMillis()
        prefs.edit()
            .putString(KEY_TIMER_TASK_ID, task.id)
            .putString(KEY_TIMER_TASK_TITLE, task.title)
            .putLong(KEY_TIMER_START_MILLIS, start)
            .apply()
        timerSession = TaskTimerSession(task.id, task.title, start)
        elapsed = 0
    }

    fun clearTimer() {
        prefs.edit().clear().apply()
        timerSession = null
        elapsed = 0
    }

    fun finishTimer() {
        val session = timerSession ?: return
        val finalElapsed = ((System.currentTimeMillis() - session.startMillis) / 1000).toInt().coerceAtLeast(0)
        val task = tasks.find { it.id == session.taskId }
        clearTimer()
        if (task != null && finalElapsed > 0) onAddTaskTime(task, finalElapsed)
    }

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
                val timeLabel = if (task.timeSpentSec > 0) " · ⏱️${task.timeSpentSec / 60}m" else ""
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Chip(
                        onClick = { confirmTask = task },
                        label = { Text(task.title, maxLines = 1) },
                        secondaryLabel = { Text("+${task.reward}pt$timeLabel") },
                        colors = ChipDefaults.chipColors(backgroundColor = priorityColor(task.priority).copy(alpha = 0.25f)),
                        modifier = Modifier.weight(1f),
                    )
                    // Il pulsante avvia subito il timer per questa task —
                    // finché un timer è attivo l'overlay a schermo intero più
                    // sotto copre sempre la lista, quindi qui non serve
                    // gestire "un altro timer è già in corso": semplicemente
                    // non è possibile vedere questa riga in quel caso.
                    Box(
                        modifier = Modifier
                            .padding(start = 4.dp)
                            .size(32.dp)
                            .background(Color.White.copy(alpha = 0.08f), androidx.compose.foundation.shape.CircleShape)
                            .clickable { startTimer(task) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("▶", style = MaterialTheme.typography.caption1)
                    }
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

        // Overlay a schermo intero del timer attivo — SOLO nome task e
        // cronometro, richiesta esplicita di Flavio ("una pagina soltanto
        // dove c'è il nome della task e il timer che sta scorrendo").
        val session = timerSession
        if (session != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black),
                contentAlignment = Alignment.Center,
            ) {
                androidx.compose.foundation.layout.Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        session.taskTitle,
                        style = MaterialTheme.typography.title3,
                        textAlign = TextAlign.Center,
                        maxLines = 2,
                        modifier = Modifier.padding(horizontal = 24.dp),
                    )
                    Text(
                        fmtElapsed(elapsed),
                        style = MaterialTheme.typography.display1,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(vertical = 10.dp),
                    )
                    Row(horizontalArrangement = Arrangement.Center) {
                        Chip(
                            onClick = { finishTimer() },
                            label = { Text("⏹ Fine") },
                            colors = ChipDefaults.primaryChipColors(),
                            modifier = Modifier.padding(end = 6.dp),
                        )
                        CompactChip(
                            onClick = { clearTimer() },
                            label = { Text("Annulla") },
                            colors = ChipDefaults.secondaryChipColors(),
                        )
                    }
                }
            }
        }
    }
}
