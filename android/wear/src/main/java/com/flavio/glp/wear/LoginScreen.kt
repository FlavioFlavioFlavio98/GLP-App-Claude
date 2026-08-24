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

// Login email/password (non Google Sign-In): il picker di sistema per
// aggiungere un account Google su Wear OS richiede un telefono associato
// ("Add from phone") anche per un'app che fa il proprio OAuth — su un
// emulatore standalone senza telefono associato resta bloccato lì. Password
// inserita via RemoteInput (tastiera/voce del sistema, vedi MainActivity).
@Composable
fun LoginScreen(loading: Boolean, error: String?, onSignInClick: () -> Unit) {
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
        Text(
            text = "flavio.rossi95@gmail.com",
            style = MaterialTheme.typography.caption2,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(bottom = 12.dp),
        )
        Button(onClick = onSignInClick, enabled = !loading) {
            Text(if (loading) "..." else "Password")
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
