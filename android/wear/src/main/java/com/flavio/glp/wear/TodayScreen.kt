package com.flavio.glp.wear

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText

@Composable
fun TodayScreen(score: Double, loading: Boolean) {
    Scaffold(
        timeText = { TimeText() },
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
                text = if (loading) "..." else score.toInt().toString(),
                style = MaterialTheme.typography.display1,
                modifier = Modifier.padding(top = 6.dp),
            )
            Text(
                text = "punti totali",
                style = MaterialTheme.typography.caption2,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}
