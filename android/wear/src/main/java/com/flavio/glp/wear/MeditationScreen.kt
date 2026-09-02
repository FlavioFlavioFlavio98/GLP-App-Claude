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

private val TARGET_OPTIONS = listOf(1, 3, 5, 10)
// Cadenza più ravvicinata e delicata del timer pasto (60s): qui la vibrazione
// è un cenno di respiro/pacing durante la sessione, non un "rallenta" —
// stessa logica ma un ritmo diverso, coerente con lo scopo diverso.
private const val BREATH_CUE_INTERVAL_SEC = 30

private fun vibrateSoft(context: Context) {
    try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator.vibrate(VibrationEffect.createOneShot(150, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            val v = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            v.vibrate(VibrationEffect.createOneShot(150, VibrationEffect.DEFAULT_AMPLITUDE))
        }
    } catch (e: Exception) { /* ignora — la sessione funziona comunque senza feedback aptico */ }
}

// Timer guidato per la meditazione — stesso principio del timer pasto
// (MealScreen) ma senza autovalutazione finale: "se tocchi Fine è perché
// l'hai fatto", stessa filosofia di logMeditation in store.jsx sul web.
@Composable
fun MeditationScreen(
    isAmbient: Boolean = false,
    lastLoggedText: String?,
    onLogMeditation: (Int, (Double) -> Unit) -> Unit,
) {
    val context = LocalContext.current
    var step by remember { mutableStateOf("main") }
    var target by remember { mutableIntStateOf(3) }
    var elapsedSec by remember { mutableIntStateOf(0) }
    var submitting by remember { mutableStateOf(false) }

    val view = LocalView.current
    DisposableEffect(step) {
        view.keepScreenOn = step == "active"
        onDispose { view.keepScreenOn = false }
    }

    LaunchedEffect(step) {
        if (step != "active") return@LaunchedEffect
        while (true) {
            delay(1000)
            elapsedSec++
            if (elapsedSec % BREATH_CUE_INTERVAL_SEC == 0) vibrateSoft(context)
        }
    }

    fun endSession() {
        if (submitting) return
        submitting = true
        val minutes = maxOf(1, Math.round(elapsedSec / 60.0).toInt())
        onLogMeditation(minutes) {
            submitting = false
            elapsedSec = 0
            step = "main"
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (step == "active" && isAmbient) {
            AmbientMeditationStep(elapsedSec = elapsedSec, targetMin = target)
        } else if (step == "active") {
            val listState = rememberScalingLazyListState()
            val mm = elapsedSec / 60
            val ss = elapsedSec % 60
            val progress = (elapsedSec.toFloat() / (target * 60).coerceAtLeast(1)).coerceIn(0f, 1f)
            Scaffold(
                timeText = { TimeText() },
                positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
            ) {
                ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(progress = progress, modifier = Modifier.size(90.dp))
                            Text("%02d:%02d".format(mm, ss), style = MaterialTheme.typography.title3, textAlign = TextAlign.Center)
                        }
                    }
                    item {
                        Text("🧘 respira con calma", style = MaterialTheme.typography.caption2, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
                    }
                    item {
                        Chip(
                            onClick = { endSession() },
                            label = { Text("Fine") },
                            colors = ChipDefaults.primaryChipColors(),
                            modifier = Modifier.padding(top = 10.dp),
                        )
                    }
                }
            }
        } else {
            val listState = rememberScalingLazyListState()
            Scaffold(
                timeText = { TimeText() },
                positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
            ) {
                ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
                    item { ListHeader { Text("🧘 Meditazione") } }
                    if (lastLoggedText != null) {
                        item { Text("✅ $lastLoggedText", style = MaterialTheme.typography.caption2, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
                    }
                    item { Text("Durata", style = MaterialTheme.typography.caption2, modifier = Modifier.padding(top = 6.dp)) }
                    item {
                        Row(modifier = Modifier.fillMaxWidth()) {
                            TARGET_OPTIONS.forEach { min ->
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
                            onClick = { elapsedSec = 0; step = "active" },
                            label = { Text("Inizia") },
                            colors = ChipDefaults.primaryChipColors(),
                            modifier = Modifier.padding(top = 10.dp),
                        )
                    }
                }
            }
        }
    }
}

// Vista ambient statica, stessa filosofia di AmbientActiveStep in
// MealScreen.kt (sfondo nero, niente animazioni/aree bianche estese).
@Composable
private fun AmbientMeditationStep(elapsedSec: Int, targetMin: Int) {
    val mm = elapsedSec / 60
    val ss = elapsedSec % 60
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(androidx.compose.ui.graphics.Color.Black),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.layout.Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("🧘", style = MaterialTheme.typography.title2)
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
