package com.flavio.glp.wear

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text

// Login primario: Google Sign-In con l'account principale
// (flavio.rossi94@gmail.com, stesso usato su telefono/web). Il blocco su
// "Aggiungi da telefono" si verificava solo su emulatore senza telefono
// associato — su un watch reale già accoppiato il picker propone
// direttamente l'account Google già presente sul dispositivo.
// Fallback: login email/password sull'account dedicato watch
// (flavio.rossi95@gmail.com), password inserita via RemoteInput.
@Composable
fun LoginScreen(
    loading: Boolean,
    error: String?,
    onGoogleSignInClick: () -> Unit,
    onPasswordSignInClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = "🏆", style = MaterialTheme.typography.display2)
        Text(
            text = "GLP",
            style = MaterialTheme.typography.title3,
            modifier = Modifier.padding(top = 4.dp, bottom = 4.dp),
        )
        Button(onClick = onGoogleSignInClick, enabled = !loading) {
            Text(if (loading) "..." else "Accedi con Google")
        }
        Button(
            onClick = onPasswordSignInClick,
            enabled = !loading,
            modifier = Modifier.padding(top = 8.dp),
        ) {
            Text("Password (account watch)")
        }
        if (error != null) {
            Text(
                text = error,
                style = MaterialTheme.typography.caption2,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}
