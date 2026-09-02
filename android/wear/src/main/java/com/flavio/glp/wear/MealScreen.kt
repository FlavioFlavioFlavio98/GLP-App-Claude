package com.flavio.glp.wear

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.foundation.background
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import kotlinx.coroutines.delay

private val TARGET_OPTIONS = listOf(5, 10, 15, 20, 25, 30)
private const val REMINDER_INTERVAL_SEC = 60

private const val MEAL_PREFS = "glp_meal_session"
private const val KEY_START_MILLIS = "start_millis"
private const val KEY_TARGET_MIN = "target_min"
// Sessione dimenticata (es. il giorno prima, mai chiusa) → non riproporla
// come se fosse ancora in corso.
private const val MAX_SESSION_AGE_MS = 6 * 60 * 60 * 1000L

// Trick brevi (schermo piccolo, niente testi lunghi come sulla web app) —
// stesso principio dei "trick durante il pasto" della web app, mostrati a
// rotazione insieme alla vibrazione periodica.
private val MEAL_TIPS = listOf(
    "🍴 Posa le posate",
    "🌬️ Fai un respiro",
    "🦷 Mastica bene",
    "💧 Bevi un sorso",
    "🐢 Rallenta il ritmo",
    "🧘 Rilassa le spalle",
)

private val MEAL_LEVELS = listOf(Triple(1, "🔴", "Veloce"), Triple(2, "🟡", "Normale"), Triple(3, "🟢", "Con calma"))

private fun vibrate(context: Context, ms: Long = 300) {
    try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            val v = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
        }
    } catch (e: Exception) { /* ignora — la sessione funziona comunque senza feedback aptico */ }
}

// Timer basato sull'orario reale di inizio (System.currentTimeMillis()),
// non su un contatore incrementato da una coroutine: quando lo schermo del
// watch si spegne del tutto per risparmio batteria (non solo l'ambient
// dimmerato — capita se l'always-on display è disattivato), l'Activity si
// ferma e con lei la coroutine del vecchio timer "elapsedSec++" ogni
// secondo, congelando il conteggio finché non si riaccende lo schermo. Ora
// il tempo trascorso si ricalcola sempre da inizio-sessione↔adesso ad ogni
// ricomposizione, quindi torna corretto automaticamente non appena l'utente
// riguarda il watch, indipendentemente da quanto lo schermo sia rimasto
// nero. sessionStartMillis è anche salvato in SharedPreferences così la
// sessione sopravvive pure a un riavvio dell'app (stesso principio del
// glp_meal_session su web).
@Composable
fun MealScreen(
    isAmbient: Boolean = false,
    lastLoggedText: String?,
    onLogMeal: (Int, Int, (Double) -> Unit) -> Unit,
) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(MEAL_PREFS, Context.MODE_PRIVATE) }
    var sessionStartMillis by remember {
        mutableStateOf(
            prefs.getLong(KEY_START_MILLIS, 0L)
                .takeIf { it > 0 && System.currentTimeMillis() - it < MAX_SESSION_AGE_MS }
        )
    }
    var step by remember { mutableStateOf(if (sessionStartMillis != null) "active" else "main") }
    var target by remember { mutableIntStateOf(prefs.getInt(KEY_TARGET_MIN, 15)) }
    // Incrementato ogni secondo solo per forzare la ricomposizione (far
    // "vedere" il countdown aggiornarsi) — il valore in sé non viene mai
    // letto, il tempo trascorso vero viene sempre dal confronto con
    // sessionStartMillis qui sotto.
    var tick by remember { mutableIntStateOf(0) }
    var pendingMinutes by remember { mutableIntStateOf(0) }
    var submitting by remember { mutableStateOf(false) }

    val elapsedSec = sessionStartMillis?.let {
        ((System.currentTimeMillis() - it) / 1000).toInt().coerceAtLeast(0)
    } ?: 0

    // DisposableEffect (non LaunchedEffect): se l'utente scorre il pager su
    // un'altra pagina mentre il pasto è attivo, questa composable viene
    // smontata e la coroutine di LaunchedEffect cancellata — ma senza
    // onDispose il flag keepScreenOn restava true per sempre (nessuno lo
    // rimetteva a false), tenendo lo schermo del watch acceso a tempo
    // indeterminato anche a sessione abbandonata.
    val view = LocalView.current
    DisposableEffect(step) {
        view.keepScreenOn = step == "active"
        onDispose { view.keepScreenOn = false }
    }

    LaunchedEffect(step) {
        if (step != "active") return@LaunchedEffect
        while (true) {
            delay(1000)
            tick++
            val sec = sessionStartMillis?.let { ((System.currentTimeMillis() - it) / 1000).toInt() } ?: 0
            if (sec > 0 && sec % REMINDER_INTERVAL_SEC == 0) vibrate(context)
        }
    }

    fun startSession() {
        val now = System.currentTimeMillis()
        sessionStartMillis = now
        prefs.edit().putLong(KEY_START_MILLIS, now).putInt(KEY_TARGET_MIN, target).apply()
        step = "active"
    }

    fun endSession() {
        pendingMinutes = maxOf(1, Math.round(elapsedSec / 60.0).toInt())
        step = "level"
    }

    fun clearSession() {
        sessionStartMillis = null
        prefs.edit().remove(KEY_START_MILLIS).remove(KEY_TARGET_MIN).apply()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when {
            step == "active" && isAmbient -> AmbientActiveStep(elapsedSec = elapsedSec, targetMin = target, emoji = "🍽️")
            step == "active" -> ActiveStep(
                elapsedSec = elapsedSec,
                targetMin = target,
                tip = MEAL_TIPS[(elapsedSec / REMINDER_INTERVAL_SEC) % MEAL_TIPS.size],
                onEnd = { endSession() },
            )
            step == "level" -> LevelStep(
                minutes = pendingMinutes,
                submitting = submitting,
                onPick = { level ->
                    if (!submitting) {
                        submitting = true
                        onLogMeal(pendingMinutes, level) {
                            submitting = false
                            clearSession()
                            step = "main"
                        }
                    }
                },
            )
            else -> {
                val listState = rememberScalingLazyListState()
                Scaffold(
                    timeText = { TimeText() },
                    positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
                ) {
                    ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
                        item { ListHeader { Text("🍽️ Pasto") } }
                        if (lastLoggedText != null) {
                            item { Text("✅ $lastLoggedText", style = MaterialTheme.typography.caption2, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
                        }
                        item {
                            Text(
                                "Obiettivo",
                                style = MaterialTheme.typography.caption2,
                                modifier = Modifier.padding(top = 6.dp),
                            )
                        }
                        item {
                            Row(modifier = Modifier.fillMaxWidth()) {
                                TARGET_OPTIONS.take(3).forEach { min ->
                                    CompactChip(
                                        onClick = { target = min },
                                        label = { Text("${min}m") },
                                        colors = if (target == min) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                                        modifier = Modifier.padding(2.dp),
                                    )
                                }
                            }
                        }
                        item {
                            Row(modifier = Modifier.fillMaxWidth()) {
                                TARGET_OPTIONS.drop(3).forEach { min ->
                                    CompactChip(
                                        onClick = { target = min },
                                        label = { Text("${min}m") },
                                        colors = if (target == min) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                                        modifier = Modifier.padding(2.dp),
                                    )
                                }
                            }
                        }
                        item {
                            Chip(
                                onClick = { startSession() },
                                label = { Text("Inizia pasto") },
                                colors = ChipDefaults.primaryChipColors(),
                                modifier = Modifier.padding(top = 10.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

// Vista ambient: sfondo nero, testo statico grigio chiaro senza animazioni né
// aree bianche estese, come richiesto dalle linee guida always-on di Wear OS
// per limitare il rischio di burn-in — niente CircularProgressIndicator (si
// anima) né Chip cliccabili (non interagibili in ambient).
@Composable
private fun AmbientActiveStep(elapsedSec: Int, targetMin: Int, emoji: String) {
    val mm = elapsedSec / 60
    val ss = elapsedSec % 60
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(androidx.compose.ui.graphics.Color.Black),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.layout.Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(emoji, style = MaterialTheme.typography.title2)
            Text(
                "%02d:%02d".format(mm, ss),
                style = MaterialTheme.typography.display2,
                color = androidx.compose.ui.graphics.Color(0xFFAAAAAA),
                textAlign = TextAlign.Center,
            )
            Text(
                "su $targetMin min",
                style = MaterialTheme.typography.caption2,
                color = androidx.compose.ui.graphics.Color(0xFF888888),
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun ActiveStep(elapsedSec: Int, targetMin: Int, tip: String, onEnd: () -> Unit) {
    val listState = rememberScalingLazyListState()
    val mm = elapsedSec / 60
    val ss = elapsedSec % 60
    val progress = (elapsedSec.toFloat() / (targetMin * 60).coerceAtLeast(1)).coerceIn(0f, 1f)
    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(
                        progress = progress,
                        modifier = Modifier.size(90.dp),
                    )
                    Text(
                        "%02d:%02d".format(mm, ss),
                        style = MaterialTheme.typography.title3,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            item {
                Text(
                    "su $targetMin min",
                    style = MaterialTheme.typography.caption2,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                Text(
                    tip,
                    style = MaterialTheme.typography.caption1,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
            }
            item {
                Chip(
                    onClick = onEnd,
                    label = { Text("Fine pasto") },
                    colors = ChipDefaults.primaryChipColors(),
                    modifier = Modifier.padding(top = 10.dp),
                )
            }
        }
    }
}

@Composable
private fun LevelStep(minutes: Int, submitting: Boolean, onPick: (Int) -> Unit) {
    val listState = rememberScalingLazyListState()
    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
            item {
                Text(
                    "$minutes min — quanto calmo?",
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            items(MEAL_LEVELS) { (level, emoji, label) ->
                Chip(
                    onClick = { if (!submitting) onPick(level) },
                    label = { Text("$emoji $label") },
                    modifier = Modifier.padding(vertical = 2.dp),
                )
            }
        }
    }
}
