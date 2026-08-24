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
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
        )
        Button(onClick = onSignInClick, enabled = !loading) {
            Text(if (loading) "..." else "Accedi")
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
