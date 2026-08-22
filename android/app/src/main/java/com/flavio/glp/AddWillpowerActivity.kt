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
    private lateinit var successBtn: Button
    private lateinit var failBtn: Button
    private lateinit var saveBtn: Button

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
            setPadding(48, 40, 48, 32)
            setBackgroundColor(android.graphics.Color.parseColor("#1E1E1E"))
        }

        val title = TextView(this).apply {
            text = "🔥 Willpower"
            textSize = 13f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(android.graphics.Color.parseColor("#888888"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 16)
        }
        root.addView(title)

        textInput = EditText(this).apply {
            hint = "Es. Filo interdentale"
            inputType = InputType.TYPE_CLASS_TEXT
            setTextColor(android.graphics.Color.WHITE)
            setHintTextColor(android.graphics.Color.parseColor("#666666"))
            setBackgroundColor(android.graphics.Color.parseColor("#2A2A2A"))
            setPadding(24, 20, 24, 20)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 16 }
        }
        textInput.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: android.text.Editable?) { updateSaveEnabled() }
        })
        root.addView(textInput)

        val outcomeRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 16 }
        }
        successBtn = Button(this).apply {
            text = "✅ L'ho fatto"
            textSize = 13f
            isAllCaps = false
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = 6 }
            setOnClickListener { pickOutcome(true) }
        }
        failBtn = Button(this).apply {
            text = "❌ Non l'ho fatto"
            textSize = 13f
            isAllCaps = false
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = 6 }
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
            ).apply { bottomMargin = 20 }
        }
        for (v in 1..5) {
            val chip = Button(this).apply {
                text = v.toString()
                textSize = 13f
                minWidth = 0
                minimumWidth = 0
                isAllCaps = false
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { setMargins(3, 0, 3, 0) }
                setOnClickListener { pickPoints(v) }
            }
            pointsRow.addView(chip)
        }
        root.addView(pointsRow)

        saveBtn = Button(this).apply {
            text = "Salva"
            textSize = 16f
            setBackgroundColor(android.graphics.Color.parseColor("#FFCA28"))
            setTextColor(android.graphics.Color.BLACK)
            setTypeface(null, android.graphics.Typeface.BOLD)
            isEnabled = false
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            setOnClickListener { save() }
        }
        root.addView(saveBtn)

        setContentView(root)
    }

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
        successBtn.setBackgroundColor(if (succeeded == true) successColor else android.graphics.Color.parseColor("#2A2A2A"))
        successBtn.setTextColor(if (succeeded == true) android.graphics.Color.BLACK else successColor)
        failBtn.setBackgroundColor(if (succeeded == false) failColor else android.graphics.Color.parseColor("#2A2A2A"))
        failBtn.setTextColor(if (succeeded == false) android.graphics.Color.BLACK else failColor)
    }

    private fun updatePointsColors() {
        val color = if (succeeded == true) android.graphics.Color.parseColor("#4CAF50") else android.graphics.Color.parseColor("#E53935")
        for (i in 0 until pointsRow.childCount) {
            val chip = pointsRow.getChildAt(i) as? Button ?: continue
            val active = (i + 1) == points
            chip.setBackgroundColor(if (active) color else android.graphics.Color.parseColor("#2A2A2A"))
            chip.setTextColor(if (active) android.graphics.Color.BLACK else color)
        }
    }

    private fun updateSaveEnabled() {
        saveBtn.isEnabled = succeeded != null && points > 0 && textInput.text.toString().trim().isNotEmpty()
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
