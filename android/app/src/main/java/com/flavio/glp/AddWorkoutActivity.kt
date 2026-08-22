package com.flavio.glp

import android.app.Activity
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.widget.*
import android.view.*
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
import java.util.*

class AddWorkoutActivity : Activity() {

    private var exercises = listOf<Map<String, Any>>()
    private var selectedIndex = 0
    private var reps = 10

    private lateinit var repsView: TextView
    private lateinit var ptsResult: TextView
    private lateinit var exerciseName: TextView
    private lateinit var ptsLabel: TextView
    private lateinit var chipGroup: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setFinishOnTouchOutside(true)
        window.setBackgroundDrawable(ColorDrawable(android.graphics.Color.TRANSPARENT))

        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 40, 48, 32)
            setBackgroundColor(android.graphics.Color.parseColor("#1E1E1E"))
        }

        // Chip group esercizi — match_parent con weight uguale per ogni chip
        chipGroup = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 8 }
        }
        root.addView(chipGroup)

        // Nome esercizio selezionato
        exerciseName = TextView(this).apply {
            textSize = 18f
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setTextColor(android.graphics.Color.WHITE)
            setPadding(0, 24, 0, 4)
        }
        root.addView(exerciseName)

        // Pts per rep
        ptsLabel = TextView(this).apply {
            textSize = 11f
            setTextColor(android.graphics.Color.parseColor("#888888"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 20)
        }
        root.addView(ptsLabel)

        // Counter row
        repsView = TextView(this).apply {
            text = reps.toString()
            textSize = 42f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(android.graphics.Color.parseColor("#FFCA28"))
            gravity = Gravity.CENTER
            minWidth = 120
        }

        ptsResult = TextView(this).apply {
            text = "= +1pt"
            textSize = 14f
            setTextColor(android.graphics.Color.parseColor("#4CAF50"))
            gravity = Gravity.CENTER
            setPadding(0, 8, 0, 24)
        }

        val counterRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val repsLabel = TextView(this).apply {
            text = "REPS"
            textSize = 11f
            setTextColor(android.graphics.Color.parseColor("#888888"))
            gravity = Gravity.CENTER
        }
        val centerCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 2f)
            setPadding(8, 0, 8, 0)
        }
        centerCol.addView(repsView)
        centerCol.addView(repsLabel)

        counterRow.addView(makeBtn("-5", -5))
        counterRow.addView(makeBtn("-", -1))
        counterRow.addView(centerCol)
        counterRow.addView(makeBtn("+", 1))
        counterRow.addView(makeBtn("+5", 5))

        root.addView(counterRow)
        root.addView(ptsResult)

        // Bottone aggiungi
        val addBtn = Button(this).apply {
            text = "💪 Aggiungi"
            textSize = 16f
            setBackgroundColor(android.graphics.Color.parseColor("#FFCA28"))
            setTextColor(android.graphics.Color.BLACK)
            setTypeface(null, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            setOnClickListener {
                val ex = exercises.getOrNull(selectedIndex) ?: return@setOnClickListener
                val pts = (reps * ((ex["pointsPerRep"] as? Double) ?: 0.1) * 100).toLong() / 100.0
                saveWorkout(ex, reps, pts)
                finish()
            }
        }
        root.addView(addBtn)

        setContentView(root)

        // Carica esercizi
        FirebaseFirestore.getInstance()
            .collection("users").document("flavio")
            .get()
            .addOnSuccessListener { doc ->
                @Suppress("UNCHECKED_CAST")
                exercises = doc.get("quickExercises") as? List<Map<String, Any>> ?: emptyList()
                if (exercises.isEmpty()) {
                    Toast.makeText(this, "Nessun esercizio configurato", Toast.LENGTH_SHORT).show()
                    finish()
                    return@addOnSuccessListener
                }

                exercises.forEachIndexed { index, ex ->
                    val emoji = ex["emoji"] as? String ?: "💪"
                    val name = ex["name"] as? String ?: "Esercizio"
                    val chip = Button(this).apply {
                        text = "$emoji ${name.uppercase()}"
                        textSize = 10f
                        minWidth = 0
                        minimumWidth = 0
                        isAllCaps = false
                        setPadding(8, 6, 8, 6)
                        layoutParams = LinearLayout.LayoutParams(
                            0,
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            1f
                        ).apply { setMargins(4, 0, 4, 8) }
                        setOnClickListener {
                            selectedIndex = index
                            updateSelection()
                        }
                    }
                    chipGroup.addView(chip)
                }

                updateSelection()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Errore caricamento esercizi", Toast.LENGTH_SHORT).show()
                finish()
            }
    }

    private fun makeBtn(label: String, delta: Int): Button {
        return Button(this).apply {
            text = label
            textSize = 13f
            minWidth = 0
            minimumWidth = 0
            setPadding(12, 8, 12, 8)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnClickListener {
                reps = maxOf(1, reps + delta)
                repsView.text = reps.toString()
                val pts = exercises.getOrNull(selectedIndex)?.let {
                    (reps * ((it["pointsPerRep"] as? Double) ?: 0.1) * 100).toLong() / 100.0
                } ?: 0.0
                ptsResult.text = "= +${pts}pt"
            }
        }
    }

    private fun updateSelection() {
        val ex = exercises.getOrNull(selectedIndex) ?: return
        val emoji = ex["emoji"] as? String ?: "💪"
        val name = ex["name"] as? String ?: ""
        val pts = (ex["pointsPerRep"] as? Double) ?: 0.1

        exerciseName.text = "$emoji $name"
        ptsLabel.text = "${pts}pt / rep"

        val totalPts = (reps * pts * 100).toLong() / 100.0
        ptsResult.text = "= +${totalPts}pt"

        for (i in 0 until chipGroup.childCount) {
            val chip = chipGroup.getChildAt(i) as? Button ?: continue
            if (i == selectedIndex) {
                chip.setBackgroundColor(android.graphics.Color.parseColor("#FFCA28"))
                chip.setTextColor(android.graphics.Color.BLACK)
            } else {
                chip.setBackgroundColor(android.graphics.Color.parseColor("#333333"))
                chip.setTextColor(android.graphics.Color.WHITE)
            }
        }
    }

    private fun saveWorkout(exercise: Map<String, Any>, reps: Int, pts: Double) {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())

        // Aggiornamento ottimistico: aggiorna subito DayWidget senza aspettare Firestore
        DayWidgetProvider.applyDelta(this, earnedDelta = pts.toInt(), extraEarnedDelta = pts.toInt())

        val logEntry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "exerciseId" to (exercise["id"] as? String ?: "manual"),
            "reps" to reps,
            "pts" to pts,
            "time" to timeStr
        )

        FirebaseFirestore.getInstance()
            .collection("users").document("flavio")
            .update(
                "exerciseLog.$today", FieldValue.arrayUnion(logEntry),
                "score", FieldValue.increment(pts)
            )
            .addOnSuccessListener {
                Toast.makeText(this, "+${pts}pt per $reps ${exercise["name"]} 💪", Toast.LENGTH_SHORT).show()
            }
    }
}
