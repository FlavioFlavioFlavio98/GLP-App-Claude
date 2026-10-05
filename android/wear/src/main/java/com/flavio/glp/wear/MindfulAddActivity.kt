package com.flavio.glp.wear

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.delay

// Tocco su complicazione / Tile / hub → questa schermata: registra SUBITO un
// momento di consapevolezza (nessuna conferma da premere), vibra, mostra il
// nuovo conteggio per un paio di secondi e si chiude da sola. "Annulla" serve
// solo per i tocchi accidentali. Activity separata (non una pagina del pager)
// così si apre e si chiude senza toccare lo stato di MainActivity.
class MindfulAddActivity : ComponentActivity() {

    private var addedTime: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (FirebaseApp.getApps(this).isEmpty()) FirebaseApp.initializeApp(this)
        if (FirebaseAuth.getInstance().currentUser == null) {
            // Non loggato: senza login la scrittura verrebbe rifiutata.
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }
        MindfulStore.ensureListening(this)

        if (savedInstanceState == null) {
            addedTime = MindfulStore.add(this)
            if (addedTime != null) {
                val count = MindfulStore.count(this)
                MindfulStore.vibrate(this, reachedGoal = count == MindfulStore.goal(this))
            } else {
                MindfulStore.refreshState(this)
            }
        } else {
            addedTime = savedInstanceState.getString("added")
            MindfulStore.refreshState(this)
        }

        setContent {
            val state by MindfulStore.state.collectAsState()
            var undone by remember { mutableStateOf(false) }

            LaunchedEffect(undone) {
                delay(if (undone) 900 else 2200)
                finish()
            }

            Column(
                modifier = Modifier.fillMaxSize().background(Color.Black),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("🧘", fontSize = 26.sp)
                Text(
                    "${state.count}/${state.goal}",
                    fontSize = 44.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (state.count >= state.goal) Color(0xFF4CAF50) else Color.White,
                )
                Text(
                    when {
                        undone -> "Annullato"
                        addedTime == null -> "Già registrato"
                        state.count == state.goal -> "Obiettivo raggiunto 🎉"
                        else -> "Momento salvato"
                    },
                    style = MaterialTheme.typography.caption1,
                    color = Color(0xFFBBBBBB),
                )
                if (!undone && addedTime != null) {
                    CompactChip(
                        onClick = {
                            addedTime?.let { MindfulStore.remove(this@MindfulAddActivity, it) }
                            undone = true
                        },
                        label = { Text("↩ Annulla") },
                        colors = ChipDefaults.secondaryChipColors(),
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString("added", addedTime)
    }
}
