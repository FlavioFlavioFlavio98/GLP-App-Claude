package com.flavio.glp

import android.app.Activity
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.WindowManager
import android.widget.*
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
import java.util.*

class AddWillpowerActivity : Activity() {

    private var succeeded: Boolean? = null
    private var points: Int = 0

    private lateinit var textInput: EditText
    private lateinit var pointsRow: LinearLayout
    private lateinit var successBtn: TextView
    private lateinit var failBtn: TextView
    private lateinit var saveBtn: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setFinishOnTouchOutside(true)
        window.setBackgroundDrawable(ColorDrawable(android.graphics.Color.TRANSPARENT))
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE)

        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(20), dp(22), dp(18))
            setBackgroundResource(R.drawable.dialog_bg_gradient)
        }

        val title = TextView(this).apply {
            text = "🔥 Willpower"
            textSize = 15f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(android.graphics.Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(14))
        }
        root.addView(title)

        textInput = EditText(this).apply {
            hint = "Cosa dovevi fare?"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            setTextColor(android.graphics.Color.WHITE)
            setHintTextColor(android.graphics.Color.parseColor("#666680"))
            setBackgroundResource(R.drawable.chip_unselected)
            setPadding(dp(14), dp(12), dp(14), dp(12))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(12) }
            addTextChangedListener(object : android.text.TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                override fun afterTextChanged(s: android.text.Editable?) { updateSaveEnabled() }
            })
        }
        root.addView(textInput)

        val outcomeRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(12) }
        }
        successBtn = TextView(this).apply {
            text = "✅  Fatto"
            textSize = 13f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginEnd = dp(6) }
            setOnClickListener { pickOutcome(true) }
        }
        failBtn = TextView(this).apply {
            text = "❌  Non fatto"
            textSize = 13f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, dp(42), 1f)
            setOnClickListener { pickOutcome(false) }
        }
        outcomeRow.addView(successBtn)
        outcomeRow.addView(failBtn)
        root.addView(outcomeRow)
        updateOutcomeColors()

        pointsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            visibility = android.view.View.GONE
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(16) }
        }
        for (v in 1..5) {
            val chip = TextView(this).apply {
                text = v.toString()
                textSize = 13f
                setTypeface(null, android.graphics.Typeface.BOLD)
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(0, dp(38), 1f).apply {
                    marginEnd = if (v < 5) dp(6) else 0
                }
                setOnClickListener { pickPoints(v) }
            }
            pointsRow.addView(chip)
        }
        root.addView(pointsRow)

        saveBtn = TextView(this).apply {
            text = "Salva"
            textSize = 15f
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setTextColor(android.graphics.Color.parseColor("#666680"))
            setBackgroundResource(R.drawable.chip_unselected)
            alpha = 0.5f
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(46)
            )
            setOnClickListener { save() }
        }
        root.addView(saveBtn)

        setContentView(root)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun pickOutcome(value: Boolean) {
        succeeded = value
        points = 0
        pointsRow.visibility = android.view.View.VISIBLE
        updateOutcomeColors()
        updatePointsColors()
        updateSaveEnabled()
    }

    private fun pickPoints(value: Int) {
        points = value
        updatePointsColors()
        updateSaveEnabled()
    }

    private fun updateOutcomeColors() {
        val successColor = android.graphics.Color.parseColor("#4CAF50")
        val failColor = android.graphics.Color.parseColor("#E53935")
        successBtn.setBackgroundResource(if (succeeded == true) R.drawable.chip_selected else R.drawable.chip_unselected)
        successBtn.setTextColor(if (succeeded == true) successColor else android.graphics.Color.parseColor("#C7C7D1"))
        successBtn.setTypeface(null, if (succeeded == true) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
        failBtn.setBackgroundResource(if (succeeded == false) R.drawable.chip_selected else R.drawable.chip_unselected)
        failBtn.setTextColor(if (succeeded == false) failColor else android.graphics.Color.parseColor("#C7C7D1"))
        failBtn.setTypeface(null, if (succeeded == false) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
    }

    private fun updatePointsColors() {
        val color = if (succeeded == true) android.graphics.Color.parseColor("#4CAF50") else android.graphics.Color.parseColor("#E53935")
        for (i in 0 until pointsRow.childCount) {
            val chip = pointsRow.getChildAt(i) as? TextView ?: continue
            val active = (i + 1) == points
            chip.setBackgroundResource(if (active) R.drawable.chip_selected else R.drawable.chip_unselected)
            chip.setTextColor(if (active) color else android.graphics.Color.parseColor("#C7C7D1"))
        }
    }

    private fun updateSaveEnabled() {
        val enabled = succeeded != null && points > 0 && textInput.text.toString().trim().isNotEmpty()
        saveBtn.alpha = if (enabled) 1f else 0.5f
        if (enabled) {
            saveBtn.setBackgroundResource(R.drawable.chip_selected)
            saveBtn.setTextColor(android.graphics.Color.parseColor("#121212"))
        } else {
            saveBtn.setBackgroundResource(R.drawable.chip_unselected)
            saveBtn.setTextColor(android.graphics.Color.parseColor("#666680"))
        }
    }

    private fun save() {
        val text = textInput.text.toString().trim()
        val isSuccess = succeeded ?: return
        if (text.isEmpty() || points <= 0) return

        val pts = if (isSuccess) points.toDouble() else -points.toDouble()
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())

        if (isSuccess) {
            DayWidgetProvider.applyDelta(this, earnedDelta = points, extraEarnedDelta = points)
        } else {
            DayWidgetProvider.applyDelta(this, spentDelta = points, penaltyDelta = points)
        }

        val logEntry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "text" to text,
            "succeeded" to isSuccess,
            "pts" to pts,
            "time" to timeStr
        )

        FirebaseFirestore.getInstance()
            .collection("users").document("flavio")
            .update("willpowerLog.$today", FieldValue.arrayUnion(logEntry))
            .addOnSuccessListener {
                val sign = if (isSuccess) "+" else ""
                Toast.makeText(this, "$sign${pts.toInt()}pt — $text", Toast.LENGTH_SHORT).show()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Errore salvataggio", Toast.LENGTH_SHORT).show()
            }

        finish()
    }
}
