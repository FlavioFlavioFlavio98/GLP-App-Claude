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
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this)
        }

        // "default_web_client_id" viene generato dal plugin google-services a
        // partire dallo stesso google-services.json del telefono — stesso
        // progetto Firebase, stesso client OAuth, nessuna config aggiuntiva.
        val webClientId = getString(resources.getIdentifier("default_web_client_id", "string", packageName))
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(webClientId)
            .requestEmail()
            .build()
        val googleClient = GoogleSignIn.getClient(this, gso)

        setContent {
            var user by remember { mutableStateOf(FirebaseAuth.getInstance().currentUser) }
            var authLoading by remember { mutableStateOf(false) }
            var authError by remember { mutableStateOf<String?>(null) }

            val signInLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.StartActivityForResult()
            ) { result ->
                val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
                try {
                    val account = task.getResult(ApiException::class.java)
                    val idToken = account?.idToken
                    if (idToken == null) {
                        authLoading = false
                        authError = "Login fallito"
                    } else {
                        val credential = GoogleAuthProvider.getCredential(idToken, null)
                        FirebaseAuth.getInstance().signInWithCredential(credential)
                            .addOnSuccessListener {
                                authLoading = false
                                user = FirebaseAuth.getInstance().currentUser
                            }
                            .addOnFailureListener {
                                authLoading = false
                                authError = "Accesso negato"
                            }
                    }
                } catch (e: Exception) {
                    authLoading = false
                    authError = "Login annullato"
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
                            signInLauncher.launch(googleClient.signInIntent)
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
