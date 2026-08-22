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
    private var effort = 1

    private lateinit var repsView: TextView
    private lateinit var ptsResult: TextView
    private lateinit var exerciseName: TextView
    private lateinit var ptsLabel: TextView
    private lateinit var chipGroup: LinearLayout
    private lateinit var effortChips: List<TextView>

    private fun effortMultiplier(level: Int) = when (level) {
        2 -> 1.2
        3 -> 1.5
        else -> 1.0
    }

    private fun currentPts(): Double {
        val ppr = (exercises.getOrNull(selectedIndex)?.get("pointsPerRep") as? Double) ?: 0.1
        return (reps * ppr * effortMultiplier(effort) * 100).toLong() / 100.0
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setFinishOnTouchOutside(true)
        window.setBackgroundDrawable(ColorDrawable(android.graphics.Color.TRANSPARENT))

        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 32, 40, 28)
            setBackgroundResource(R.drawable.dialog_bg_gradient)
        }

        // Chip esercizi — scroll orizzontale, ogni chip largo quanto il suo testo
        // (prima erano compressi tutti in una riga a larghezza uguale e il testo
        // andava a capo lettera per lettera con nomi lunghi come "Trazioni Red Band")
        chipGroup = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }
        val chipScroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 14 }
            addView(chipGroup)
        }
        root.addView(chipScroll)

        // Nome esercizio selezionato
        exerciseName = TextView(this).apply {
            textSize = 19f
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setTextColor(android.graphics.Color.WHITE)
            setPadding(0, 10, 0, 2)
        }
        root.addView(exerciseName)

        // Pts per rep
        ptsLabel = TextView(this).apply {
            textSize = 11f
            setTextColor(android.graphics.Color.parseColor("#55557A"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 18)
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
            setPadding(0, 8, 0, 22)
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
            textSize = 10f
            setTextColor(android.graphics.Color.parseColor("#55557A"))
            letterSpacing = 0.1f
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

        counterRow.addView(makeStepBtn("-5", -5))
        counterRow.addView(makeStepBtn("-", -1))
        counterRow.addView(centerCol)
        counterRow.addView(makeStepBtn("+", 1))
        counterRow.addView(makeStepBtn("+5", 5))

        root.addView(counterRow)
        root.addView(ptsResult)

        // Sforzo percepito — stessa scala 1/2/3 = leggero/medio/massimo della web app
        val effortLabel = TextView(this).apply {
            text = "SFORZO PERCEPITO"
            textSize = 10f
            setTextColor(android.graphics.Color.parseColor("#55557A"))
            letterSpacing = 0.1f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(6))
        }
        root.addView(effortLabel)

        val effortRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(16) }
        }
        val effortDefs = listOf(Triple(1, "🟢", "Leggero"), Triple(2, "🟡", "Medio"), Triple(3, "🔴", "Massimo"))
        effortChips = effortDefs.map { (level, emoji, label) ->
            TextView(this).apply {
                text = "$emoji $label"
                textSize = 11f
                gravity = Gravity.CENTER
                setPadding(0, dp(9), 0, dp(9))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    if (level < 3) marginEnd = dp(6)
                }
                setOnClickListener {
                    effort = level
                    updateEffortColors()
                    ptsResult.text = "= +${currentPts()}pt"
                }
            }
        }
        effortChips.forEach { effortRow.addView(it) }
        root.addView(effortRow)
        updateEffortColors()

        // Bottone aggiungi
        val addBtn = TextView(this).apply {
            text = "💪 Aggiungi"
            textSize = 15f
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setTextColor(android.graphics.Color.parseColor("#121212"))
            setBackgroundResource(R.drawable.chip_selected)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(46)
            )
            setOnClickListener {
                val ex = exercises.getOrNull(selectedIndex) ?: return@setOnClickListener
                saveWorkout(ex, reps, currentPts(), effort)
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
                val rawExercises = doc.get("quickExercises") as? List<Map<String, Any>> ?: emptyList()
                if (rawExercises.isEmpty()) {
                    Toast.makeText(this, "Nessun esercizio configurato", Toast.LENGTH_SHORT).show()
                    finish()
                    return@addOnSuccessListener
                }

                // Esercizi già fatti oggi in cima (più recente prima), poi il resto in
                // ordine alfabetico — stesso criterio della web/Android app, così si
                // scrolla meno per trovare quello giusto durante l'allenamento.
                val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                @Suppress("UNCHECKED_CAST")
                val todayLog = (doc.get("exerciseLog") as? Map<String, Any>)?.get(today) as? List<Map<String, Any>> ?: emptyList()
                val lastTimeById = mutableMapOf<String, String>()
                todayLog.forEach { s ->
                    val exId = s["exerciseId"] as? String ?: return@forEach
                    val t = s["time"] as? String ?: ""
                    if (t > (lastTimeById[exId] ?: "")) lastTimeById[exId] = t
                }
                exercises = rawExercises
                    .map { ex -> ex to (lastTimeById[ex["id"] as? String]) }
                    .sortedWith(compareByDescending<Pair<Map<String, Any>, String?>> { it.second != null }
                        .thenByDescending { it.second ?: "" }
                        .thenBy { (it.first["name"] as? String) ?: "" })
                    .map { it.first }

                exercises.forEachIndexed { index, ex ->
                    val emoji = ex["emoji"] as? String ?: "💪"
                    val name = ex["name"] as? String ?: "Esercizio"
                    val chip = TextView(this).apply {
                        text = "$emoji $name"
                        textSize = 12f
                        gravity = Gravity.CENTER
                        setPadding(dp(14), dp(9), dp(14), dp(9))
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        ).apply { marginEnd = dp(8) }
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

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun makeStepBtn(label: String, delta: Int): TextView {
        return TextView(this).apply {
            text = label
            textSize = 14f
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setTextColor(android.graphics.Color.parseColor("#C7C7D1"))
            setBackgroundResource(R.drawable.chip_unselected)
            layoutParams = LinearLayout.LayoutParams(0, dp(40), 1f).apply { marginEnd = dp(4) }
            setOnClickListener {
                reps = maxOf(1, reps + delta)
                repsView.text = reps.toString()
                ptsResult.text = "= +${currentPts()}pt"
            }
        }
    }

    private fun updateEffortColors() {
        if (!::effortChips.isInitialized) return
        effortChips.forEachIndexed { i, chip ->
            val active = (i + 1) == effort
            chip.setBackgroundResource(if (active) R.drawable.chip_selected else R.drawable.chip_unselected)
            chip.setTextColor(if (active) android.graphics.Color.parseColor("#FFCA28") else android.graphics.Color.parseColor("#C7C7D1"))
            chip.setTypeface(null, if (active) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
        }
    }

    private fun updateSelection() {
        val ex = exercises.getOrNull(selectedIndex) ?: return
        val emoji = ex["emoji"] as? String ?: "💪"
        val name = ex["name"] as? String ?: ""
        val pts = (ex["pointsPerRep"] as? Double) ?: 0.1

        exerciseName.text = "$emoji $name"
        ptsLabel.text = "${pts}pt / rep"
        ptsResult.text = "= +${currentPts()}pt"

        for (i in 0 until chipGroup.childCount) {
            val chip = chipGroup.getChildAt(i) as? TextView ?: continue
            if (i == selectedIndex) {
                chip.setBackgroundResource(R.drawable.chip_selected)
                chip.setTextColor(android.graphics.Color.parseColor("#FFCA28"))
                chip.setTypeface(null, android.graphics.Typeface.BOLD)
            } else {
                chip.setBackgroundResource(R.drawable.chip_unselected)
                chip.setTextColor(android.graphics.Color.parseColor("#C7C7D1"))
                chip.setTypeface(null, android.graphics.Typeface.NORMAL)
            }
        }
    }

    private fun saveWorkout(exercise: Map<String, Any>, reps: Int, pts: Double, effort: Int) {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())

        // Aggiornamento ottimistico: aggiorna subito DayWidget senza aspettare Firestore
        DayWidgetProvider.applyDelta(this, earnedDelta = pts.toInt(), extraEarnedDelta = pts.toInt())

        val logEntry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "exerciseId" to (exercise["id"] as? String ?: "manual"),
            "reps" to reps,
            "pts" to pts,
            "effort" to effort,
            "time" to timeStr
        )

        FirebaseFirestore.getInstance()
            .collection("users").document("flavio")
            .update("exerciseLog.$today", FieldValue.arrayUnion(logEntry))
            .addOnSuccessListener {
                Toast.makeText(this, "+${pts}pt per $reps ${exercise["name"]} 💪", Toast.LENGTH_SHORT).show()
            }
    }
}
