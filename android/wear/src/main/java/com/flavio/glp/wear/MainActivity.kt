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
import com.google.firebase.auth.FirebaseAuthInvalidUserException

// Unico account ammesso dalle regole Firestore (vedi firestore.rules) — fisso
// qui così sul watch basta digitare/dettare la password, non anche l'email.
private const val FIXED_EMAIL = "flavio.rossi94@gmail.com"
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
                FirebaseAuth.getInstance().signInWithEmailAndPassword(FIXED_EMAIL, password)
                    .addOnSuccessListener {
                        authLoading = false
                        user = FirebaseAuth.getInstance().currentUser
                    }
                    .addOnFailureListener { err ->
                        if (err is FirebaseAuthInvalidUserException) {
                            // Primo utilizzo: nessun account ancora — lo crea con la
                            // password appena inserita (stesso account riusabile ogni volta dopo).
                            FirebaseAuth.getInstance().createUserWithEmailAndPassword(FIXED_EMAIL, password)
                                .addOnSuccessListener {
                                    authLoading = false
                                    user = FirebaseAuth.getInstance().currentUser
                                }
                                .addOnFailureListener {
                                    authLoading = false
                                    authError = it.message ?: "Errore creazione account"
                                }
                        } else {
                            authLoading = false
                            authError = "Password errata"
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

@Composable
private fun MainPager() {
    var tasks by remember { mutableStateOf<List<WearTask>>(emptyList()) }
    var tasksLoading by remember { mutableStateOf(true) }
    var exercises by remember { mutableStateOf<List<WearExercise>>(emptyList()) }
    var exercisesLoading by remember { mutableStateOf(true) }
    var lastLoggedName by remember { mutableStateOf<String?>(null) }

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
            onResult = { exercises = it; exercisesLoading = false },
            onError = { exercisesLoading = false },
        )
    }

    LaunchedEffect(Unit) {
        refreshTasks()
        refreshExercises()
    }

    val pagerState = rememberPagerState(pageCount = { 2 })

    Box(modifier = Modifier.fillMaxSize()) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
            when (page) {
                0 -> TaskListScreen(
                    tasks = tasks,
                    loading = tasksLoading,
                    onComplete = { task ->
                        // Ottimistico: sparisce subito dalla lista, poi ri-sincronizza in caso di errore
                        tasks = tasks.filter { it.id != task.id }
                        GlpRepository.completeTask(
                            taskId = task.id,
                            reward = task.reward,
                            onDone = {},
                            onError = { refreshTasks() },
                        )
                    },
                )
                1 -> WorkoutScreen(
                    exercises = exercises,
                    loading = exercisesLoading,
                    lastLoggedName = lastLoggedName,
                    onLogSet = { exercise ->
                        GlpRepository.logQuickSet(
                            exercise = exercise,
                            onDone = { lastLoggedName = exercise.name },
                            onError = {},
                        )
                    },
                )
            }
        }

        // Puntini di navigazione tra le due pagine
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 2.dp),
        ) {
            repeat(2) { i ->
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
