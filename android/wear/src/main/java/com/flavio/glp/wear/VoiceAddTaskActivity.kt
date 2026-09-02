package com.flavio.glp.wear

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.core.content.ContextCompat
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.google.firebase.FirebaseApp
import java.util.Locale

// Scorciatoia "Nuova task" (Tile AddTaskTileService): ascolta e salva
// subito. Usa SpeechRecognizer diretto invece di
// RecognizerIntent/RemoteInputIntentHelper — su questo watch entrambi
// risultano gestiti da Gboard (WearRemoteInputActivity, verificato con
// `dumpsys package`), che apre sempre prima la tastiera con un'icona
// microfono da toccare a parte: SpeechRecognizer parla direttamente col
// servizio di riconoscimento vocale di sistema, senza passare da nessuna UI
// di tastiera.
class VoiceAddTaskActivity : ComponentActivity() {

    private var recognizer: SpeechRecognizer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this)
        }

        setContent {
            var permissionGranted by remember {
                mutableStateOf(
                    ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                )
            }
            var permissionDenied by remember { mutableStateOf(false) }
            var listening by remember { mutableStateOf(false) }
            var notUnderstood by remember { mutableStateOf(false) }
            var pendingTitle by remember { mutableStateOf<String?>(null) }
            var pendingDeadline by remember { mutableStateOf("") }
            var submitting by remember { mutableStateOf(false) }

            val permissionLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.RequestPermission()
            ) { granted ->
                permissionGranted = granted
                if (!granted) permissionDenied = true
            }

            LaunchedEffect(Unit) {
                if (!permissionGranted) permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }

            LaunchedEffect(permissionGranted) {
                if (!permissionGranted || pendingTitle != null || notUnderstood || permissionDenied) return@LaunchedEffect
                if (!SpeechRecognizer.isRecognitionAvailable(this@VoiceAddTaskActivity)) {
                    notUnderstood = true
                    return@LaunchedEffect
                }
                listening = true
                val r = SpeechRecognizer.createSpeechRecognizer(this@VoiceAddTaskActivity)
                recognizer = r
                r.setRecognitionListener(object : RecognitionListener {
                    override fun onResults(results: Bundle) {
                        listening = false
                        val raw = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            ?.firstOrNull()?.trim()
                        r.destroy()
                        if (raw.isNullOrEmpty()) {
                            notUnderstood = true
                            return
                        }
                        val parsed = VoiceDateParser.parse(raw)
                        if (parsed.title.isEmpty()) {
                            notUnderstood = true
                        } else {
                            pendingTitle = parsed.title
                            pendingDeadline = parsed.deadline ?: today()
                        }
                    }
                    override fun onError(error: Int) {
                        listening = false
                        r.destroy()
                        notUnderstood = true
                    }
                    override fun onReadyForSpeech(params: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    override fun onPartialResults(partialResults: Bundle?) {}
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
                val speechIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                }
                r.startListening(speechIntent)
            }

            // Se l'utente lascia l'activity mentre sta ancora ascoltando
            // (es. preme indietro), evita che il riconoscimento resti agganciato
            // al microfono in background.
            DisposableEffect(Unit) {
                onDispose { recognizer?.destroy() }
            }

            if (permissionDenied) {
                LaunchedEffect(Unit) {
                    Toast.makeText(this@VoiceAddTaskActivity, "Serve il permesso microfono per dettare", Toast.LENGTH_LONG).show()
                    finish()
                }
            }
            if (notUnderstood) {
                LaunchedEffect(Unit) {
                    Toast.makeText(this@VoiceAddTaskActivity, "Non ho capito, riprova", Toast.LENGTH_SHORT).show()
                    finish()
                }
            }

            val title = pendingTitle
            MaterialTheme {
                when {
                    title != null -> {
                        // Stessa scelta del telefono: non salva a occhi chiusi,
                        // un errore di trascrizione qui creerebbe una task
                        // sbagliata senza che te ne accorga finché non la
                        // rivedi nell'app — resta comunque un solo tocco in più
                        // rispetto ad "ascolta e salva", non l'intera UI
                        // dell'app.
                        val listState = rememberScalingLazyListState()
                        ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
                            item { Text("Nuova task", textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
                            item { Text(title, style = MaterialTheme.typography.caption1, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
                            item { Text("📅 ${VoiceDateParser.formatDisplay(pendingDeadline)}", style = MaterialTheme.typography.caption2, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
                            item {
                                Chip(
                                    onClick = {
                                        if (!submitting) {
                                            submitting = true
                                            GlpRepository.addTask(
                                                title = title,
                                                deadline = pendingDeadline,
                                                onDone = {
                                                    Toast.makeText(this@VoiceAddTaskActivity, "✅ Task creata: $title", Toast.LENGTH_LONG).show()
                                                    finish()
                                                },
                                                onError = { err ->
                                                    Toast.makeText(this@VoiceAddTaskActivity, "Errore: ${err.message}", Toast.LENGTH_LONG).show()
                                                    finish()
                                                },
                                            )
                                        }
                                    },
                                    label = { Text("OK, crea") },
                                    colors = ChipDefaults.primaryChipColors(),
                                )
                            }
                            item {
                                Chip(
                                    onClick = { finish() },
                                    label = { Text("Annulla") },
                                    colors = ChipDefaults.secondaryChipColors(),
                                )
                            }
                        }
                    }
                    listening -> {
                        Text(
                            "🎤 Ascolto...",
                            style = MaterialTheme.typography.title2,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        recognizer?.destroy()
    }
}
