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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import androidx.wear.input.RemoteInputIntentHelper
import com.google.firebase.FirebaseApp
import kotlinx.coroutines.delay
import java.util.Locale

private const val AUTO_CONFIRM_SECONDS = 3
private const val KEYBOARD_FALLBACK_INPUT_KEY = "voice_add_task_keyboard_fallback"

// Scorciatoia "Nuova task" (Tile AddTaskTileService): ascolta e salva
// subito. Usa SpeechRecognizer diretto invece di
// RecognizerIntent/RemoteInputIntentHelper — su questo watch entrambi
// risultano gestiti da Gboard (WearRemoteInputActivity, verificato con
// `dumpsys package`), che apre sempre prima la tastiera con un'icona
// microfono da toccare a parte: SpeechRecognizer parla direttamente col
// servizio di riconoscimento vocale di sistema, senza passare da nessuna UI
// di tastiera. Ma la trascrizione vocale stessa usa il servizio cloud di
// Google (a differenza del salvataggio, già offline-safe): senza rete
// fallisce sempre — in quel caso specifico ripieghiamo sulla tastiera
// (RemoteInputIntentHelper), che funziona anche offline, invece di lasciare
// Flavio senza alcun modo di aggiungere una task mentre è fuori senza
// telefono/wifi.
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
            // Messaggio specifico invece di un booleano "notUnderstood"
            // generico: il riconoscimento vocale usa il servizio cloud di
            // Google (a differenza del salvataggio su Firestore, che ora
            // funziona offline) — senza connessione fallisce sempre con
            // ERROR_NETWORK/ERROR_NETWORK_TIMEOUT, un caso ben diverso da
            // "non ha capito cosa hai detto" e che merita un messaggio che
            // dica perché, non lo stesso "riprova" generico.
            var errorMessage by remember { mutableStateOf<String?>(null) }
            var needsKeyboardFallback by remember { mutableStateOf(false) }
            var pendingTitle by remember { mutableStateOf<String?>(null) }
            var pendingDeadline by remember { mutableStateOf("") }
            var submitting by remember { mutableStateOf(false) }

            fun applyRecognizedText(raw: String?) {
                val trimmed = raw?.trim()
                if (trimmed.isNullOrEmpty()) {
                    errorMessage = "Non ho capito, riprova"
                    return
                }
                val parsed = VoiceDateParser.parse(trimmed)
                if (parsed.title.isEmpty()) {
                    errorMessage = "Non ho capito, riprova"
                } else {
                    pendingTitle = parsed.title
                    pendingDeadline = parsed.deadline ?: today()
                }
            }

            val permissionLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.RequestPermission()
            ) { granted ->
                permissionGranted = granted
                if (!granted) permissionDenied = true
            }

            // Fallback tastiera quando manca la rete: funziona offline perché
            // è solo testo digitato, nessuna trascrizione cloud coinvolta.
            val keyboardLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.StartActivityForResult()
            ) { result ->
                val typed = result.data?.let { android.app.RemoteInput.getResultsFromIntent(it) }
                    ?.getCharSequence(KEYBOARD_FALLBACK_INPUT_KEY)?.toString()
                if (typed.isNullOrBlank()) {
                    // Annullato dalla tastiera: nessun errore da mostrare,
                    // l'utente ha scelto lui di non scrivere nulla.
                    finish()
                } else {
                    applyRecognizedText(typed)
                }
            }

            LaunchedEffect(needsKeyboardFallback) {
                if (!needsKeyboardFallback) return@LaunchedEffect
                Toast.makeText(this@VoiceAddTaskActivity, "Manca la rete, scrivila", Toast.LENGTH_SHORT).show()
                val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
                val remoteInputs = listOf(
                    android.app.RemoteInput.Builder(KEYBOARD_FALLBACK_INPUT_KEY)
                        .setLabel("Scrivi la task...")
                        .build()
                )
                RemoteInputIntentHelper.putRemoteInputsExtra(intent, remoteInputs)
                keyboardLauncher.launch(intent)
            }

            LaunchedEffect(Unit) {
                if (!permissionGranted) permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }

            LaunchedEffect(permissionGranted) {
                if (!permissionGranted || pendingTitle != null || errorMessage != null || needsKeyboardFallback || permissionDenied) return@LaunchedEffect
                if (!SpeechRecognizer.isRecognitionAvailable(this@VoiceAddTaskActivity)) {
                    needsKeyboardFallback = true
                    return@LaunchedEffect
                }
                listening = true
                val r = SpeechRecognizer.createSpeechRecognizer(this@VoiceAddTaskActivity)
                recognizer = r
                r.setRecognitionListener(object : RecognitionListener {
                    override fun onResults(results: Bundle) {
                        listening = false
                        val raw = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                        r.destroy()
                        applyRecognizedText(raw)
                    }
                    override fun onError(error: Int) {
                        listening = false
                        r.destroy()
                        // Il riconoscimento vocale usa il servizio cloud di
                        // Google — a differenza del salvataggio task (ora
                        // offline-safe), la trascrizione stessa fallisce
                        // sempre con questi due codici se manca la rete. In
                        // quel caso, tastiera invece di un errore secco: è
                        // l'unico modo per aggiungere una task mentre si è
                        // fuori senza rete, l'obiettivo dichiarato di Flavio.
                        if (error == SpeechRecognizer.ERROR_NETWORK || error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT) {
                            needsKeyboardFallback = true
                        } else {
                            errorMessage = "Non ho capito, riprova"
                        }
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
                    // Preferisci il riconoscimento sul dispositivo se il
                    // watch ha scaricato il pacchetto lingua offline
                    // (Impostazioni → Sistema → Lingue e immissione →
                    // riconoscimento vocale) — è solo una preferenza, non una
                    // garanzia: se il modello offline non è installato per la
                    // lingua corrente ricade comunque sul servizio cloud.
                    putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
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
            val err = errorMessage
            if (err != null) {
                LaunchedEffect(err) {
                    Toast.makeText(this@VoiceAddTaskActivity, err, Toast.LENGTH_LONG).show()
                    finish()
                }
            }

            val title = pendingTitle
            MaterialTheme {
                when {
                    title != null -> {
                        // Stessa scelta del telefono: non salva a occhi chiusi
                        // di default — ma qui il conto alla rovescia di 3s
                        // sul segno di spunta lascia comunque "ascolta e
                        // salva" come comportamento predefinito se non tocchi
                        // nulla, con la X sempre lì per correggere in tempo se
                        // il riconoscimento ha capito male.
                        fun confirm() {
                            if (submitting) return
                            submitting = true
                            // Ottimistico: chiude subito invece di aspettare la
                            // conferma di Firestore (stesso motivo per cui lo fa
                            // già VoiceAddTaskActivity sul telefono) — offline la
                            // scrittura resta comunque in coda e si sincronizza da
                            // sola alla riconnessione, aspettare qui rendeva il
                            // salvataggio percepito come lento.
                            Toast.makeText(this@VoiceAddTaskActivity, "✅ Task creata: $title", Toast.LENGTH_LONG).show()
                            GlpRepository.addTask(
                                title = title,
                                deadline = pendingDeadline,
                                onDone = {},
                                onError = { err ->
                                    Toast.makeText(this@VoiceAddTaskActivity, "Errore: ${err.message}", Toast.LENGTH_LONG).show()
                                },
                            )
                            finish()
                        }

                        var secondsLeft by remember { mutableIntStateOf(AUTO_CONFIRM_SECONDS) }
                        LaunchedEffect(title) {
                            while (secondsLeft > 0) {
                                delay(1000)
                                secondsLeft--
                            }
                            confirm()
                        }

                        val listState = rememberScalingLazyListState()
                        ScalingLazyColumn(modifier = Modifier.fillMaxSize(), state = listState) {
                            item { Text("Nuova task", textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
                            item { Text(title, style = MaterialTheme.typography.caption1, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
                            item { Text("📅 ${VoiceDateParser.formatDisplay(pendingDeadline)}", style = MaterialTheme.typography.caption2, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
                            item {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                                    horizontalArrangement = Arrangement.Center,
                                ) {
                                    CompactChip(
                                        onClick = { confirm() },
                                        label = { Text("✓ $secondsLeft") },
                                        colors = ChipDefaults.primaryChipColors(),
                                        modifier = Modifier.padding(4.dp),
                                    )
                                    CompactChip(
                                        onClick = { finish() },
                                        label = { Text("✗") },
                                        colors = ChipDefaults.secondaryChipColors(),
                                        modifier = Modifier.padding(4.dp),
                                    )
                                }
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
