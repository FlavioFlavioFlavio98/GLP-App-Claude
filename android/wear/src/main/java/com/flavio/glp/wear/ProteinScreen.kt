package com.flavio.glp.wear

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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

// Stesso flusso in 3 passi di WorkoutScreen (main → picker → grammi), stesso
// motivo: registrare un pasto proteico dal polso senza tirare fuori il
// telefono — richiesta esplicita di Flavio, "il watch mi servirà soprattutto
// per comunicare con l'app velocemente".
@Composable
fun ProteinScreen(
    foods: List<WearFood>,
    recentIds: List<String>,
    loading: Boolean,
    lastLoggedText: String?,
    onLogProtein: (WearFood, Int) -> Unit,
) {
    var step by remember { mutableStateOf("main") }
    var selectedFood by remember { mutableStateOf<WearFood?>(null) }
    var grams by remember { mutableIntStateOf(100) }
    // Stessa guardia anti-doppio-tap di WorkoutScreen: senza, un doppio tocco
    // ravvicinato sul Chip "Aggiungi" può registrare due voci duplicate
    // prima che la ricomposizione lo rimuova dallo schermo.
    var submitting by remember { mutableStateOf(false) }

    val recentFoods = recentIds.mapNotNull { id -> foods.find { it.id == id } }

    fun openGrams(food: WearFood) {
        selectedFood = food
        grams = 100
        submitting = false
        step = "grams"
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (step) {
            "grams" -> selectedFood?.let { food ->
                GramsStep(
                    food = food,
                    grams = grams,
                    onGramsChange = { grams = it },
                    onBack = { step = "main" },
                    onConfirm = {
                        if (!submitting) {
                            submitting = true
                            onLogProtein(food, grams)
                            step = "main"
                        }
                    },
                )
            }
            "picker" -> FoodPickerStep(
                foods = foods,
                onBack = { step = "main" },
                onPick = { openGrams(it) },
            )
            else -> {
                val listState = rememberScalingLazyListState()
                Scaffold(
                    timeText = { TimeText() },
                    positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
                ) {
                    ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
                        item { ListHeader { Text("🥩 Proteine") } }
                        item {
                            Chip(
                                onClick = { step = "picker" },
                                label = { Text("+ Aggiungi alimento") },
                                colors = ChipDefaults.primaryChipColors(),
                                modifier = Modifier.padding(vertical = 2.dp),
                            )
                        }
                        if (lastLoggedText != null) {
                            item { Text("✅ $lastLoggedText", style = MaterialTheme.typography.caption2, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
                        }
                        if (recentFoods.isNotEmpty()) {
                            item {
                                Text(
                                    "Ultimi di oggi",
                                    style = MaterialTheme.typography.caption2,
                                    modifier = Modifier.padding(top = 6.dp),
                                )
                            }
                            items(recentFoods) { food ->
                                Chip(
                                    onClick = { openGrams(food) },
                                    label = { Text("${food.emoji} ${food.name}", maxLines = 1) },
                                    colors = ChipDefaults.secondaryChipColors(),
                                    modifier = Modifier.padding(vertical = 2.dp),
                                )
                            }
                        }
                        if (foods.isEmpty() && !loading) {
                            item { Text("Nessun alimento configurato — aprilo prima dall'app") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FoodPickerStep(
    foods: List<WearFood>,
    onBack: () -> Unit,
    onPick: (WearFood) -> Unit,
) {
    val listState = rememberScalingLazyListState()
    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
            item { ListHeader { Text("Scegli alimento") } }
            items(foods) { food ->
                Chip(
                    onClick = { onPick(food) },
                    label = { Text("${food.emoji} ${food.name}", maxLines = 1) },
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
private fun GramsStep(
    food: WearFood,
    grams: Int,
    onGramsChange: (Int) -> Unit,
    onBack: () -> Unit,
    onConfirm: () -> Unit,
) {
    val listState = rememberScalingLazyListState()
    val proteinGrams = Math.round(grams * (food.proteinPer100g / 100) * 10) / 10.0
    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
            item {
                Text("${food.emoji} ${food.name}", textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    CompactChip(onClick = { onGramsChange(maxOf(1, grams - 50)) }, label = { Text("-50") }, modifier = Modifier.padding(2.dp))
                    CompactChip(onClick = { onGramsChange(maxOf(1, grams - 10)) }, label = { Text("-10") }, modifier = Modifier.padding(2.dp))
                    CompactChip(onClick = { onGramsChange(grams + 10) }, label = { Text("+10") }, modifier = Modifier.padding(2.dp))
                    CompactChip(onClick = { onGramsChange(grams + 50) }, label = { Text("+50") }, modifier = Modifier.padding(2.dp))
                }
            }
            item {
                Text(
                    "${grams}g",
                    style = MaterialTheme.typography.display3,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                )
            }
            item {
                Text(
                    "= ${proteinGrams}g proteine",
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
