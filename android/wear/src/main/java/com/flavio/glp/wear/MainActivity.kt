package com.flavio.glp.wear

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.rememberCoroutineScope
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import androidx.wear.ambient.AmbientLifecycleObserver
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.input.RemoteInputIntentHelper
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// Login primario: Google Sign-In con l'account principale
// (flavio.rossi94@gmail.com, stesso usato su telefono/web) — vedi
// LoginScreen.kt. Web client id preso da google-services.json
// (oauth_client, client_type: 3), richiesto da requestIdToken per ottenere
// un idToken scambiabile con Firebase Auth via GoogleAuthProvider.
private const val WEB_CLIENT_ID = "925252547674-db1u97mup8gekoo6tsgclhfokc4qk0e7.apps.googleusercontent.com"

// Account dedicato all'app watch (vedi firestore.rules), fallback se il
// login Google dovesse bloccarsi — separato dall'email di login principale
// per evitare la collisione "un account per email" di Firebase Auth quando
// si crea un credential email/password per un'email già legata a un
// provider Google. Stessi dati (users/flavio), solo credenziale diversa.
private const val FIXED_EMAIL = "flavio.rossi95@gmail.com"
private const val PASSWORD_INPUT_KEY = "password_input"

class MainActivity : ComponentActivity() {

    // Stato ambient letto dai timer (MealScreen/MeditationScreen): quando il
    // sistema passa in ambient (basso consumo, polso abbassato o timeout)
    // invece di forzare sempre lo schermo acceso a piena luminosità si mostra
    // una vista minimale statica — vedi AmbientLifecycleObserver più sotto.
    private var isAmbient by mutableStateOf(false)

    // launchMode="singleTask" (vedi manifest) fa sì che un rilancio (es. dal
    // tocco sulla Tile "Task oggi" mentre l'app è già aperta) riusi questa
    // stessa istanza invece di impilarne una nuova sopra — senza, si
    // perdevano sessionPoints/stato e si accumulavano istanze duplicate nel
    // back-stack. onNewIntent aggiorna la pagina richiesta sull'istanza già
    // viva; senza singleTask + questo override, l'extra "start_page" veniva
    // letto solo alla prima creazione e ignorato sui rilanci successivi.
    private var requestedPage by mutableStateOf(1)

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        requestedPage = intent.getIntExtra(EXTRA_START_PAGE, 1)
    }

    private fun setupShortcuts() {
        // Lasciate registrate anche se il launcher di Wear OS non mostra la
        // UI "tieni premuto → scorciatoie" (verificato con `dumpsys
        // shortcut`: risultano correttamente registrate lato sistema, solo
        // nessuna superficie di sistema le espone) — innocue da avere, e
        // l'accesso rapido vero passa dalle Tile (vedi AddTaskTileService,
        // VoiceAddTaskActivity).
        fun shortcutIntent(page: Int) = Intent(this, MainActivity::class.java).apply {
            this.action = Intent.ACTION_VIEW
            putExtra(EXTRA_START_PAGE, page)
        }
        // getIdentifier invece della classe R generata: il namespace del
        // modulo (com.flavio.glp) differisce dal package Kotlin di questo
        // file (com.flavio.glp.wear), stesso motivo per cui
        // ExerciseIconRes.kt fa lo stesso.
        val icon = IconCompat.createWithResource(this, resources.getIdentifier("ic_launcher", "mipmap", packageName))
        val shortcuts = listOf(
            ShortcutInfoCompat.Builder(this, "quick_add_task")
                .setShortLabel("Nuova task")
                .setLongLabel("🎤 Nuova task a voce")
                .setIcon(icon)
                .setIntent(Intent(this, VoiceAddTaskActivity::class.java).apply { action = Intent.ACTION_VIEW })
                .build(),
            ShortcutInfoCompat.Builder(this, "quick_workout")
                .setShortLabel("Workout")
                .setLongLabel("💪 Vai a Workout")
                .setIcon(icon)
                .setIntent(shortcutIntent(3))
                .build(),
            ShortcutInfoCompat.Builder(this, "quick_meal")
                .setShortLabel("Pasto")
                .setLongLabel("🍽️ Inizia timer pasto")
                .setIcon(icon)
                .setIntent(shortcutIntent(5))
                .build(),
        )
        try {
            ShortcutManagerCompat.setDynamicShortcuts(this, shortcuts)
        } catch (e: Exception) { /* non bloccare l'avvio se il sistema rifiuta le shortcut */ }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedPage = intent.getIntExtra(EXTRA_START_PAGE, 1)
        setupShortcuts()

        val ambientObserver = AmbientLifecycleObserver(
            this,
            object : AmbientLifecycleObserver.AmbientLifecycleCallback {
                override fun onEnterAmbient(ambientDetails: AmbientLifecycleObserver.AmbientDetails) {
                    isAmbient = true
                }
                override fun onExitAmbient() {
                    isAmbient = false
                }
            },
        )
        lifecycle.addObserver(ambientObserver)

        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this)
        }

        setContent {
            var user by remember { mutableStateOf(FirebaseAuth.getInstance().currentUser) }
            var authLoading by remember { mutableStateOf(false) }
            var authError by remember { mutableStateOf<String?>(null) }

            fun signIn(password: String) {
                // Non distinguiamo il tipo di eccezione (utente inesistente vs
                // password sbagliata): con la protezione anti-enumerazione di
                // Firebase Auth entrambi i casi arrivano come lo stesso errore
                // generico, quindi proviamo sempre a creare l'account su
                // qualunque fallimento del login — se l'account esiste già con
                // un'altra password, createUser fallirà a sua volta con un
                // errore chiaro ("email-already-in-use").
                FirebaseAuth.getInstance().signInWithEmailAndPassword(FIXED_EMAIL, password)
                    .addOnSuccessListener {
                        authLoading = false
                        user = FirebaseAuth.getInstance().currentUser
                    }
                    .addOnFailureListener {
                        FirebaseAuth.getInstance().createUserWithEmailAndPassword(FIXED_EMAIL, password)
                            .addOnSuccessListener {
                                authLoading = false
                                user = FirebaseAuth.getInstance().currentUser
                            }
                            .addOnFailureListener { err2 ->
                                authLoading = false
                                authError = if (err2.message?.contains("already in use") == true)
                                    "Password errata" else (err2.message ?: "Errore login")
                            }
                    }
            }

            val passwordLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.StartActivityForResult()
            ) { result ->
                val data = result.data
                val password = data?.let { android.app.RemoteInput.getResultsFromIntent(it) }
                    ?.getCharSequence(PASSWORD_INPUT_KEY)?.toString()
                if (password.isNullOrBlank()) {
                    authLoading = false
                } else {
                    signIn(password)
                }
            }

            val googleSignInClient = remember {
                val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestIdToken(WEB_CLIENT_ID)
                    .requestEmail()
                    .build()
                GoogleSignIn.getClient(this, gso)
            }

            val googleSignInLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.StartActivityForResult()
            ) { result ->
                val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
                try {
                    val account = task.getResult(ApiException::class.java)
                    val idToken = account.idToken
                    if (idToken == null) {
                        authLoading = false
                        authError = "Login Google fallito (nessun token)"
                        return@rememberLauncherForActivityResult
                    }
                    val credential = GoogleAuthProvider.getCredential(idToken, null)
                    FirebaseAuth.getInstance().signInWithCredential(credential)
                        .addOnSuccessListener {
                            authLoading = false
                            user = FirebaseAuth.getInstance().currentUser
                        }
                        .addOnFailureListener { err ->
                            authLoading = false
                            authError = err.message ?: "Errore login Google"
                        }
                } catch (e: ApiException) {
                    authLoading = false
                    authError = "Login Google annullato o fallito (${e.statusCode})"
                }
            }

            MaterialTheme {
                if (user == null) {
                    LoginScreen(
                        loading = authLoading,
                        error = authError,
                        onGoogleSignInClick = {
                            authLoading = true
                            authError = null
                            googleSignInLauncher.launch(googleSignInClient.signInIntent)
                        },
                        onPasswordSignInClick = {
                            authLoading = true
                            authError = null
                            val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
                            val remoteInputs = listOf(
                                android.app.RemoteInput.Builder(PASSWORD_INPUT_KEY)
                                    .setLabel("Password")
                                    .build()
                            )
                            RemoteInputIntentHelper.putRemoteInputsExtra(intent, remoteInputs)
                            passwordLauncher.launch(intent)
                        },
                    )
                } else {
                    // La Tile "Task oggi" (TasksTileService) imposta l'extra
                    // a 2 per aprire l'app direttamente sulla pagina Task,
                    // senza dover scorrere manualmente dalle Abitudini —
                    // requestedPage si aggiorna anche a istanza già viva
                    // (vedi onNewIntent sopra).
                    MainPager(
                        startPage = requestedPage,
                        isAmbient = isAmbient,
                    )
                }
            }
        }
    }
}

const val EXTRA_START_PAGE = "start_page"

fun formatPts(pts: Double): String =
    if (pts == pts.toLong().toDouble()) pts.toLong().toString() else "%.1f".format(pts)

// Ordine pagine: Oggi (riepilogo) → Abitudini (il loop più usato quotidiano,
// per esplicita richiesta) → Task → Workout → Proteine → Pasto → Willpower → Meditazione.
private const val PAGE_COUNT = 8

@Composable
private fun MainPager(
    startPage: Int = 1,
    isAmbient: Boolean = false,
) {
    val context = LocalContext.current
    var score by remember { mutableStateOf(0.0) }
    var scoreLoading by remember { mutableStateOf(true) }
    var habits by remember { mutableStateOf<List<WearHabit>>(emptyList()) }
    var habitsLoading by remember { mutableStateOf(true) }
    var tasks by remember { mutableStateOf<List<WearTask>>(emptyList()) }
    var tasksLoading by remember { mutableStateOf(true) }
    var exercises by remember { mutableStateOf<List<WearExercise>>(emptyList()) }
    var recentExerciseIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var exercisesLoading by remember { mutableStateOf(true) }
    var lastLoggedName by remember { mutableStateOf<String?>(null) }
    // Punti guadagnati dall'apertura dell'app in questa sessione di
    // allenamento — permette un workout intero dal watch senza telefono,
    // sapendo quanto si sta guadagnando serie dopo serie. sessionDay traccia
    // la giornata a cui si riferisce il conteggio: senza un reset esplicito
    // legato alla data, un'app rimasta aperta/in memoria da un giorno
    // all'altro (facile su un watch che si porta al polso tutto il giorno,
    // a differenza di un telefono che si chiude più spesso) sommava le serie
    // di ieri con quelle di oggi all'infinito — bug reale segnalato da
    // Flavio.
    var sessionPoints by remember { mutableStateOf(0.0) }
    var setsThisSession by remember { mutableStateOf(0) }
    var sessionDay by remember { mutableStateOf(today()) }

    fun resetSessionIfNewDay() {
        val current = today()
        if (current != sessionDay) {
            sessionDay = current
            sessionPoints = 0.0
            setsThisSession = 0
        }
    }

    // Controllo passivo ogni minuto: fa scattare il reset anche se il watch
    // resta aperto sulla schermata Workout attraverso la mezzanotte senza
    // che venga registrata nessuna nuova serie (altrimenti il numero
    // visualizzato resterebbe quello di ieri finché non arriva un nuovo log
    // a triggerare il controllo).
    LaunchedEffect(Unit) {
        while (true) {
            resetSessionIfNewDay()
            delay(60_000)
        }
    }
    var foods by remember { mutableStateOf<List<WearFood>>(emptyList()) }
    var recentFoodIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var foodsLoading by remember { mutableStateOf(true) }
    var lastLoggedFoodText by remember { mutableStateOf<String?>(null) }
    var lastLoggedMealText by remember { mutableStateOf<String?>(null) }
    var lastLoggedWillpowerText by remember { mutableStateOf<String?>(null) }
    var lastLoggedMeditationText by remember { mutableStateOf<String?>(null) }

    fun refreshScore() {
        scoreLoading = true
        GlpRepository.loadScore(
            onResult = { score = it; scoreLoading = false },
            onError = { scoreLoading = false },
        )
    }

    fun refreshHabits() {
        habitsLoading = true
        GlpRepository.loadHabits(
            onResult = { habits = it; habitsLoading = false },
            onError = { habitsLoading = false },
        )
    }

    fun refreshTasks() {
        tasksLoading = true
        GlpRepository.loadActiveTasks(
            onResult = { tasks = it; tasksLoading = false },
            onError = { tasksLoading = false },
        )
    }

    fun refreshExercises() {
        exercisesLoading = true
        GlpRepository.loadExercises(
            onResult = { all, recentIds -> exercises = all; recentExerciseIds = recentIds; exercisesLoading = false },
            onError = { exercisesLoading = false },
        )
    }

    fun refreshFoods() {
        foodsLoading = true
        GlpRepository.loadFoods(
            onResult = { all, recentIds -> foods = all; recentFoodIds = recentIds; foodsLoading = false },
            onError = { foodsLoading = false },
        )
    }

    LaunchedEffect(Unit) {
        refreshScore()
        refreshHabits()
        refreshTasks()
        refreshExercises()
        refreshFoods()
    }

    val pagerState = rememberPagerState(initialPage = startPage.coerceIn(0, PAGE_COUNT - 1), pageCount = { PAGE_COUNT })
    val pagerScope = rememberCoroutineScope()

    // Reagisce anche ai cambi di startPage DOPO la prima composizione (es.
    // tocco sulla Tile mentre l'app è già aperta, con singleTask +
    // onNewIntent che aggiorna requestedPage in MainActivity) — initialPage
    // di rememberPagerState viene letto solo alla creazione dello stato.
    LaunchedEffect(startPage) {
        pagerState.scrollToPage(startPage.coerceIn(0, PAGE_COUNT - 1))
    }

    Box(modifier = Modifier.fillMaxSize()) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
            when (page) {
                0 -> TodayScreen(
                    onNavigate = { targetPage -> pagerScope.launch { pagerState.animateScrollToPage(targetPage) } },
                )
                1 -> HabitsScreen(
                    habits = habits,
                    loading = habitsLoading,
                    onToggle = { habit ->
                        // Ottimistico: si spunta subito, poi ri-sincronizza in caso di errore.
                        // toggleHabit usa una transazione Firestore (necessaria per modificare
                        // in sicurezza un elemento esistente dell'array "habits" senza rischiare
                        // la stessa perdita dati del 28/8/2026) — a differenza delle scritture
                        // arrayUnion (aggiungi task, log allenamento/pasto/proteine/ecc, tutte
                        // offline-safe), le transazioni Firestore NON possono essere messe in
                        // coda offline: falliscono e basta se non c'è rete, quindi qui lo spunta
                        // torna indietro invece di restare — messaggio esplicito per non
                        // lasciarlo sembrare un bug muto.
                        val wasDone = habit.done
                        habits = habits.map { if (it.id == habit.id) it.copy(done = !wasDone) else it }
                        GlpRepository.toggleHabit(
                            habitId = habit.id,
                            currentlyDone = wasDone,
                            onDone = { refreshScore() },
                            onError = {
                                Toast.makeText(context, "Serve connessione per le abitudini, riprova online", Toast.LENGTH_SHORT).show()
                                refreshHabits()
                            },
                        )
                    },
                )
                2 -> TaskListScreen(
                    tasks = tasks,
                    loading = tasksLoading,
                    onComplete = { task ->
                        // Ottimistico: sparisce subito dalla lista, poi ri-sincronizza in caso di
                        // errore — stessa limitazione di toggleHabit qui sopra (transazione, non
                        // in coda offline).
                        tasks = tasks.filter { it.id != task.id }
                        GlpRepository.completeTask(
                            taskId = task.id,
                            onDone = { refreshScore() },
                            onError = {
                                Toast.makeText(context, "Serve connessione per completare task, riprova online", Toast.LENGTH_SHORT).show()
                                refreshTasks()
                            },
                        )
                    },
                    onAddTask = { title, deadline ->
                        GlpRepository.addTask(
                            title = title,
                            deadline = deadline,
                            onDone = { refreshTasks() },
                            onError = {},
                        )
                    },
                )
                3 -> WorkoutScreen(
                    exercises = exercises,
                    recentIds = recentExerciseIds,
                    loading = exercisesLoading,
                    lastLoggedName = lastLoggedName,
                    sessionPoints = sessionPoints,
                    setsThisSession = setsThisSession,
                    onLogSet = { exercise, reps, effort ->
                        GlpRepository.logQuickSet(
                            exercise = exercise,
                            reps = reps,
                            effort = effort,
                            onDone = { pts ->
                                resetSessionIfNewDay()
                                lastLoggedName = "${exercise.name} +${formatPts(pts)}pt"
                                sessionPoints += pts
                                setsThisSession += 1
                                refreshScore()
                                refreshExercises()
                            },
                            onError = {},
                        )
                    },
                )
                4 -> ProteinScreen(
                    foods = foods,
                    recentIds = recentFoodIds,
                    loading = foodsLoading,
                    lastLoggedText = lastLoggedFoodText,
                    onLogProtein = { food, grams ->
                        GlpRepository.logProtein(
                            food = food,
                            grams = grams,
                            onDone = { proteinGrams -> lastLoggedFoodText = "${food.name}: ${proteinGrams}g proteine"; refreshScore(); refreshFoods() },
                            onError = {},
                        )
                    },
                )
                5 -> MealScreen(
                    isAmbient = isAmbient,
                    lastLoggedText = lastLoggedMealText,
                    onLogMeal = { minutes, level, onComplete ->
                        GlpRepository.logMeal(
                            durationMin = minutes,
                            level = level,
                            onDone = { pts ->
                                lastLoggedMealText = "$minutes min — +${pts}pt"
                                refreshScore()
                                onComplete(pts)
                            },
                            onError = { onComplete(0.0) },
                        )
                    },
                )
                6 -> WillpowerScreen(
                    lastLoggedText = lastLoggedWillpowerText,
                    onLogWillpower = { text, succeeded, points, onComplete ->
                        GlpRepository.logWillpower(
                            text = text,
                            succeeded = succeeded,
                            points = points,
                            onDone = { pts ->
                                lastLoggedWillpowerText = "$text — ${if (pts >= 0) "+" else ""}${pts}pt"
                                refreshScore()
                                onComplete(pts)
                            },
                            onError = { onComplete(0.0) },
                        )
                    },
                )
                7 -> MeditationScreen(
                    isAmbient = isAmbient,
                    lastLoggedText = lastLoggedMeditationText,
                    onLogMeditation = { minutes, onComplete ->
                        GlpRepository.logMeditation(
                            minutes = minutes,
                            onDone = { pts ->
                                lastLoggedMeditationText = "$minutes min — +${pts}pt"
                                refreshScore()
                                onComplete(pts)
                            },
                            onError = { onComplete(0.0) },
                        )
                    },
                )
            }
        }

        // Puntini di navigazione tra le pagine
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 2.dp),
        ) {
            repeat(PAGE_COUNT) { i ->
                Box(
                    modifier = Modifier
                        .padding(2.dp)
                        .size(if (pagerState.currentPage == i) 6.dp else 4.dp)
                        .background(
                            color = if (pagerState.currentPage == i) Color.White else Color(0x66FFFFFF),
                            shape = CircleShape,
                        ),
                )
            }
        }
    }
}
