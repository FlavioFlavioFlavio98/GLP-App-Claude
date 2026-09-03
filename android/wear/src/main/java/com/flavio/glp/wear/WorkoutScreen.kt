package com.flavio.glp.wear

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
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

private val EFFORT_LEVELS = listOf(Triple(1, "🟢", "Leggero"), Triple(2, "🟡", "Medio"), Triple(3, "🔴", "Massimo"))

// Icona immagine (stesse 13 di public/exercise-icons/ sul web) con fallback
// all'emoji se l'esercizio non ne ha una — vedi ExerciseIconRes.kt.
@Composable
private fun ExerciseChipIcon(exercise: WearExercise, size: androidx.compose.ui.unit.Dp = 24.dp) {
    val context = LocalContext.current
    val resId = remember(exercise.name) { resolveExerciseIconRes(context, exercise.name) }
    if (resId != null) {
        Image(
            painter = painterResource(id = resId),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.size(size).clip(CircleShape),
        )
    } else {
        Text(exercise.emoji, style = MaterialTheme.typography.title3)
    }
}

// step: 'main' (lista + ultimi usati) → 'picker' (tutti gli esercizi) → 'reps'
// (contatore reps + sforzo) — stesso flusso in 3 passi del modal "Allenamento
// rapido" della web app, invece del log istantaneo a valori fissi di prima.
@Composable
fun WorkoutScreen(
    exercises: List<WearExercise>,
    recentIds: List<String>,
    loading: Boolean,
    lastLoggedName: String?,
    dayPoints: Double = 0.0,
    daySets: Int = 0,
    onLogSet: (WearExercise, Int, Int) -> Unit,
) {
    var step by remember { mutableStateOf("main") }
    var selectedExercise by remember { mutableStateOf<WearExercise?>(null) }
    var reps by remember { mutableIntStateOf(10) }
    var effort by remember { mutableIntStateOf(1) }
    // Il cambio di "step" a "main" nello stesso click che chiama onLogSet
    // smonta subito il Chip "Aggiungi", ma un doppio tap molto ravvicinato
    // può comunque far arrivare entrambi gli eventi prima che la ricomposizione
    // rimuova il Chip dallo schermo — guardia esplicita per evitare due serie
    // duplicate (due arrayUnion con id diversi) dallo stesso tocco.
    var submitting by remember { mutableStateOf(false) }

    val recentExercises = recentIds.mapNotNull { id -> exercises.find { it.id == id } }

    fun openReps(ex: WearExercise) {
        selectedExercise = ex
        reps = 10
        effort = 1
        submitting = false
        step = "reps"
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (step) {
            "reps" -> selectedExercise?.let { ex ->
                RepsStep(
                    exercise = ex,
                    reps = reps,
                    effort = effort,
                    onRepsChange = { reps = it },
                    onEffortChange = { effort = it },
                    onBack = { step = "main" },
                    onConfirm = {
                        if (!submitting) {
                            submitting = true
                            onLogSet(ex, reps, effort)
                            step = "main"
                        }
                    },
                )
            }
            "picker" -> ExercisePickerStep(
                exercises = exercises,
                onBack = { step = "main" },
                onPick = { openReps(it) },
            )
            else -> {
                val listState = rememberScalingLazyListState()
                Scaffold(
                    timeText = { TimeText() },
                    positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
                ) {
                    ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
                        item { ListHeader { Text("💪 Workout") } }
                        if (daySets > 0) {
                            item {
                                Box(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = androidx.compose.ui.Alignment.Center) {
                                    androidx.compose.foundation.layout.Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
                                        Text(
                                            "🏆 ${formatPts(dayPoints)} pt",
                                            style = MaterialTheme.typography.display3,
                                            textAlign = TextAlign.Center,
                                        )
                                        Text(
                                            "$daySets serie oggi",
                                            style = MaterialTheme.typography.caption2,
                                            textAlign = TextAlign.Center,
                                        )
                                    }
                                }
                            }
                        }
                        item {
                            Chip(
                                onClick = { step = "picker" },
                                label = { Text("+ Aggiungi esercizio") },
                                colors = ChipDefaults.primaryChipColors(),
                                modifier = Modifier.padding(vertical = 2.dp),
                            )
                        }
                        if (lastLoggedName != null) {
                            item { Text("✅ $lastLoggedName", style = MaterialTheme.typography.caption2, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
                        }
                        if (recentExercises.isNotEmpty()) {
                            item {
                                Text(
                                    "Ultimi di oggi",
                                    style = MaterialTheme.typography.caption2,
                                    modifier = Modifier.padding(top = 6.dp),
                                )
                            }
                            items(recentExercises) { ex ->
                                Chip(
                                    onClick = { openReps(ex) },
                                    icon = { ExerciseChipIcon(ex) },
                                    label = { Text(ex.name, maxLines = 1) },
                                    colors = ChipDefaults.secondaryChipColors(),
                                    modifier = Modifier.padding(vertical = 2.dp),
                                )
                            }
                        }
                        if (exercises.isEmpty() && !loading) {
                            item { Text("Nessun esercizio configurato") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ExercisePickerStep(
    exercises: List<WearExercise>,
    onBack: () -> Unit,
    onPick: (WearExercise) -> Unit,
) {
    val listState = rememberScalingLazyListState()
    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
            item { ListHeader { Text("Scegli esercizio") } }
            items(exercises) { ex ->
                Chip(
                    onClick = { onPick(ex) },
                    icon = { ExerciseChipIcon(ex) },
                    label = { Text(ex.name, maxLines = 1) },
                    modifier = Modifier.padding(vertical = 2.dp),
                )
            }
            item {
                CompactChip(
                    onClick = onBack,
                    label = { Text("Indietro") },
                    colors = ChipDefaults.secondaryChipColors(),
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun RepsStep(
    exercise: WearExercise,
    reps: Int,
    effort: Int,
    onRepsChange: (Int) -> Unit,
    onEffortChange: (Int) -> Unit,
    onBack: () -> Unit,
    onConfirm: () -> Unit,
) {
    val listState = rememberScalingLazyListState()
    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    ExerciseChipIcon(exercise, size = 32.dp)
                    Text(exercise.name, textAlign = TextAlign.Center, modifier = Modifier.padding(start = 6.dp))
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    CompactChip(onClick = { onRepsChange(maxOf(1, reps - 5)) }, label = { Text("-5") }, modifier = Modifier.padding(2.dp))
                    CompactChip(onClick = { onRepsChange(maxOf(1, reps - 1)) }, label = { Text("-1") }, modifier = Modifier.padding(2.dp))
                    CompactChip(onClick = { onRepsChange(reps + 1) }, label = { Text("+1") }, modifier = Modifier.padding(2.dp))
                    CompactChip(onClick = { onRepsChange(reps + 5) }, label = { Text("+5") }, modifier = Modifier.padding(2.dp))
                }
            }
            item {
                Text(
                    "$reps reps",
                    style = MaterialTheme.typography.display3,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                )
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    EFFORT_LEVELS.forEach { (level, emoji, label) ->
                        val active = effort == level
                        CompactChip(
                            onClick = { onEffortChange(level) },
                            label = { Text("$emoji") },
                            colors = if (active) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                            modifier = Modifier.padding(2.dp),
                        )
                    }
                }
            }
            item {
                Text(
                    EFFORT_LEVELS.first { it.first == effort }.third,
                    style = MaterialTheme.typography.caption2,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                Chip(
                    onClick = onConfirm,
                    label = { Text("Aggiungi") },
                    colors = ChipDefaults.primaryChipColors(),
                    modifier = Modifier.padding(top = 10.dp),
                )
            }
            item {
                CompactChip(
                    onClick = onBack,
                    label = { Text("Annulla") },
                    colors = ChipDefaults.secondaryChipColors(),
                )
            }
        }
    }
}
