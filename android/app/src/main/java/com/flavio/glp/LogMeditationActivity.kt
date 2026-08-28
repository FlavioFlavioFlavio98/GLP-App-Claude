package com.flavio.glp

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.KeyEvent
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
import java.util.*

// Tap sul widget 1x1 meditazione → dialog con preset rapidi (quasi sempre un
// minuto) più un campo per un valore diverso, stesso stile card di
// AddWillpowerActivity invece della singola barra di testo spoglia di prima.
class LogMeditationActivity : Activity() {

    private val presets = listOf(1, 2, 5, 10)
    private var selectedMinutes: Int = 1
    private lateinit var chipsRow: LinearLayout
    private lateinit var customInput: EditText
    private lateinit var saveBtn: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setFinishOnTouchOutside(true)
        window.setBackgroundDrawable(ColorDrawable(android.graphics.Color.TRANSPARENT))
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN)

        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(20), dp(22), dp(18))
            setBackgroundResource(R.drawable.dialog_bg_gradient)
        }

        val title = TextView(this).apply {
            text = "🧘 Meditazione"
            textSize = 15f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(android.graphics.Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(4))
        }
        root.addView(title)

        val subtitle = TextView(this).apply {
            text = "Quanti minuti?"
            textSize = 12f
            setTextColor(android.graphics.Color.parseColor("#999999"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(14))
        }
        root.addView(subtitle)

        chipsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(12) }
        }
        presets.forEachIndexed { i, minutes ->
            val chip = TextView(this).apply {
                text = minutes.toString()
                textSize = 14f
                setTypeface(null, android.graphics.Typeface.BOLD)
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(0, dp(42), 1f).apply {
                    if (i < presets.size - 1) marginEnd = dp(6)
                }
                setOnClickListener { pickPreset(minutes) }
            }
            chipsRow.addView(chip)
        }
        root.addView(chipsRow)

        customInput = EditText(this).apply {
            hint = "Altro (minuti)..."
            inputType = InputType.TYPE_CLASS_NUMBER
            imeOptions = EditorInfo.IME_ACTION_DONE
            setTextColor(android.graphics.Color.WHITE)
            setHintTextColor(android.graphics.Color.parseColor("#666680"))
            setBackgroundResource(R.drawable.chip_unselected)
            gravity = Gravity.CENTER
            setPadding(dp(14), dp(10), dp(14), dp(10))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(16) }
            addTextChangedListener(object : android.text.TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun afterTextChanged(s: android.text.Editable?) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                    val custom = s.toString().trim().toIntOrNull()
                    if (custom != null && custom > 0) { selectedMinutes = custom; updateChipColors() }
                }
            })
            setOnEditorActionListener { _, actionId, event ->
                if (actionId == EditorInfo.IME_ACTION_DONE ||
                    (event?.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN)) {
                    save(); true
                } else false
            }
        }
        root.addView(customInput)

        saveBtn = TextView(this).apply {
            text = "Registra"
            textSize = 15f
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setTextColor(android.graphics.Color.parseColor("#121212"))
            setBackgroundResource(R.drawable.chip_selected)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(46))
            setOnClickListener { save() }
        }
        root.addView(saveBtn)

        setContentView(root)
        pickPreset(1)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun pickPreset(minutes: Int) {
        selectedMinutes = minutes
        if (customInput.text.toString().trim().toIntOrNull() != minutes) customInput.setText("")
        updateChipColors()
    }

    private fun updateChipColors() {
        for (i in 0 until chipsRow.childCount) {
            val chip = chipsRow.getChildAt(i) as? TextView ?: continue
            val active = presets[i] == selectedMinutes
            chip.setBackgroundResource(if (active) R.drawable.chip_selected else R.drawable.chip_unselected)
            chip.setTextColor(if (active) android.graphics.Color.parseColor("#121212") else android.graphics.Color.parseColor("#C7C7D1"))
        }
    }

    private fun save() {
        val minutes = selectedMinutes.coerceAtLeast(1)
        val rate = 1.0 // vedi DEFAULT_MEDITATION_RATE in meditationStats.js — il tasso
        // personalizzabile vive solo in localStorage della web app.
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val entry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "pts" to rate,
            "minutes" to minutes.toDouble(),
            "time" to SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        )

        val userRef = FirebaseFirestore.getInstance().collection("users").document("flavio")
        userRef.update(
            "meditationLog.$today", FieldValue.arrayUnion(entry),
            "score", FieldValue.increment(rate)
        ).addOnCompleteListener {
            Toast.makeText(this, "🧘 Sessione da $minutes min registrata! +${rate.toInt()}pt", Toast.LENGTH_SHORT).show()
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
