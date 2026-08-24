package com.flavio.glp.wear

import android.os.Bundle
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
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.input.RemoteInputIntentHelper
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth

// Account dedicato all'app watch (vedi firestore.rules) — separato dall'email
// di login principale (flavio.rossi94@gmail.com, usata via Google Sign-In su
// telefono/web) per evitare la collisione "un account per email" di Firebase
// Auth quando si crea un credential email/password per un'email già legata
// a un provider Google. Stessi dati (users/flavio), solo credenziale diversa.
private const val FIXED_EMAIL = "flavio.rossi95@gmail.com"
private const val PASSWORD_INPUT_KEY = "password_input"

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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

            MaterialTheme {
                if (user == null) {
                    LoginScreen(
                        loading = authLoading,
                        error = authError,
                        onSignInClick = {
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
                    MainPager()
                }
            }
        }
    }
}

// Ordine pagine: Oggi (riepilogo) → Abitudini (il loop più usato quotidiano,
// per esplicita richiesta) → Task → Workout.
private const val PAGE_COUNT = 4

@Composable
private fun MainPager() {
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

    LaunchedEffect(Unit) {
        refreshScore()
        refreshHabits()
        refreshTasks()
        refreshExercises()
    }

    val pagerState = rememberPagerState(initialPage = 1, pageCount = { PAGE_COUNT })

    Box(modifier = Modifier.fillMaxSize()) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
            when (page) {
                0 -> TodayScreen(score = score, loading = scoreLoading)
                1 -> HabitsScreen(
                    habits = habits,
                    loading = habitsLoading,
                    onToggle = { habit ->
                        // Ottimistico: si spunta subito, poi ri-sincronizza in caso di errore
                        val wasDone = habit.done
                        habits = habits.map { if (it.id == habit.id) it.copy(done = !wasDone) else it }
                        GlpRepository.toggleHabit(
                            habitId = habit.id,
                            currentlyDone = wasDone,
                            onDone = { refreshScore() },
                            onError = { refreshHabits() },
                        )
                    },
                )
                2 -> TaskListScreen(
                    tasks = tasks,
                    loading = tasksLoading,
                    onComplete = { task ->
                        // Ottimistico: sparisce subito dalla lista, poi ri-sincronizza in caso di errore
                        tasks = tasks.filter { it.id != task.id }
                        GlpRepository.completeTask(
                            taskId = task.id,
                            reward = task.reward,
                            onDone = { refreshScore() },
                            onError = { refreshTasks() },
                        )
                    },
                )
                3 -> WorkoutScreen(
                    exercises = exercises,
                    recentIds = recentExerciseIds,
                    loading = exercisesLoading,
                    lastLoggedName = lastLoggedName,
                    onLogSet = { exercise, reps, effort ->
                        GlpRepository.logQuickSet(
                            exercise = exercise,
                            reps = reps,
                            effort = effort,
                            onDone = { lastLoggedName = exercise.name; refreshScore(); refreshExercises() },
                            onError = {},
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
