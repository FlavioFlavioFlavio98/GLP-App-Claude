package com.flavio.glp

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.KeyEvent
import android.view.Window
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.Toast
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
import java.util.*

// Tap sul widget 1x1 meditazione → chiede solo i minuti (default 1, quasi
// sempre così), invio per confermare — stesso pattern minimale di
// QuickAddTaskActivity, nessun altro campo da compilare.
class LogMeditationActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.setBackgroundDrawable(ColorDrawable(android.graphics.Color.TRANSPARENT))
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
        setFinishOnTouchOutside(true)

        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        val input = EditText(this).apply {
            hint = "Minuti (default 1)"
            inputType = InputType.TYPE_CLASS_NUMBER
            imeOptions = EditorInfo.IME_ACTION_DONE
            setText("1")
            setTextColor(android.graphics.Color.WHITE)
            setHintTextColor(android.graphics.Color.parseColor("#666680"))
            setBackgroundResource(R.drawable.dialog_bg_gradient)
            setPadding(dp(18), dp(16), dp(18), dp(16))
            setOnEditorActionListener { _, actionId, event ->
                if (actionId == EditorInfo.IME_ACTION_DONE ||
                    (event?.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN)) {
                    submit(text.toString())
                    true
                } else false
            }
        }
        setContentView(input)
        input.requestFocus()
        input.selectAll()
        Handler(Looper.getMainLooper()).postDelayed({
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(input, InputMethodManager.SHOW_FORCED)
        }, 150)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun submit(raw: String) {
        val minutes = raw.trim().toDoubleOrNull()?.coerceAtLeast(1.0) ?: 1.0
        val rate = 1.0 // vedi DEFAULT_MEDITATION_RATE in meditationStats.js — il tasso
        // personalizzabile vive solo in localStorage della web app.
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val entry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "pts" to rate,
            "minutes" to minutes,
            "time" to SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        )

        val userRef = FirebaseFirestore.getInstance().collection("users").document("flavio")
        userRef.update(
            "meditationLog.$today", FieldValue.arrayUnion(entry),
            "score", FieldValue.increment(rate)
        ).addOnCompleteListener {
            Toast.makeText(this, "🧘 Sessione da ${minutes.toInt()} min registrata! +${rate.toInt()}pt", Toast.LENGTH_SHORT).show()
            refreshWidgetCount(today)
        }.addOnFailureListener {
            Toast.makeText(this, "Errore, riprova", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private fun refreshWidgetCount(today: String) {
        FirebaseFirestore.getInstance().collection("users").document("flavio").get()
            .addOnSuccessListener { doc ->
                @Suppress("UNCHECKED_CAST")
                val meditationLog = doc.get("meditationLog") as? Map<String, Any> ?: emptyMap()
                val todayEntries = meditationLog[today] as? List<*> ?: emptyList<Any>()

                getSharedPreferences("glp_widget", Context.MODE_PRIVATE).edit()
                    .putInt("meditation_count_today", todayEntries.size)
                    .apply()

                val manager = AppWidgetManager.getInstance(this)
                val ids = manager.getAppWidgetIds(ComponentName(this, MeditationWidgetProvider::class.java))
                ids.forEach { MeditationWidgetProvider.updateWidget(this, manager, it) }
            }
            .addOnCompleteListener { finish() }
    }
}
