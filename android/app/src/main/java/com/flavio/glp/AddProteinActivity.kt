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

// Dialog aggiunta rapida proteine dal widget 1x1 home-screen — stesso schema
// di AddWorkoutActivity: chip alimenti (ordine alfabetico) + stepper grammi.
// Non stima alimenti nuovi via AI (serve la Cloud Function, troppo lento per
// un tap dalla home) — quelli si aggiungono dall'app, qui solo quelli già presenti.
class AddProteinActivity : Activity() {

    private var foods = listOf<Map<String, Any>>()
    private var selectedIndex = 0
    private var grams = 100

    private lateinit var gramsView: TextView
    private lateinit var proteinResult: TextView
    private lateinit var foodName: TextView
    private lateinit var proteinLabel: TextView
    private lateinit var chipGroup: LinearLayout

    // Firestore può restituire un numero senza decimali come Long invece che
    // Double (ambiguità nota della serializzazione JS→Firestore→Android).
    private fun asDouble(v: Any?): Double = when (v) {
        is Double -> v
        is Long -> v.toDouble()
        is Int -> v.toDouble()
        else -> 0.0
    }

    private fun currentProtein(): Double {
        val per100 = asDouble(foods.getOrNull(selectedIndex)?.get("proteinPer100g"))
        return (grams * (per100 / 100) * 10).toLong() / 10.0
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

        // Chip alimenti — scroll orizzontale, ordine alfabetico
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

        // Nome alimento selezionato
        foodName = TextView(this).apply {
            textSize = 19f
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setTextColor(android.graphics.Color.WHITE)
            setPadding(0, 10, 0, 2)
        }
        root.addView(foodName)

        proteinLabel = TextView(this).apply {
            textSize = 11f
            setTextColor(android.graphics.Color.parseColor("#55557A"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 18)
        }
        root.addView(proteinLabel)

        // Counter row — grammi
        gramsView = TextView(this).apply {
            text = grams.toString()
            textSize = 42f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(android.graphics.Color.parseColor("#FFCA28"))
            gravity = Gravity.CENTER
            minWidth = 120
        }

        proteinResult = TextView(this).apply {
            text = "= 0g proteine"
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

        val gramsLabel = TextView(this).apply {
            text = "GRAMMI"
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
        centerCol.addView(gramsView)
        centerCol.addView(gramsLabel)

        counterRow.addView(makeStepBtn("-50", -50))
        counterRow.addView(makeStepBtn("-10", -10))
        counterRow.addView(centerCol)
        counterRow.addView(makeStepBtn("+10", 10))
        counterRow.addView(makeStepBtn("+50", 50))

        root.addView(counterRow)
        root.addView(proteinResult)

        // Bottone aggiungi
        val addBtn = TextView(this).apply {
            text = "🥩 Aggiungi"
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
                val food = foods.getOrNull(selectedIndex) ?: return@setOnClickListener
                saveProtein(food, grams, currentProtein())
                finish()
            }
        }
        root.addView(addBtn)

        setContentView(root)

        // Carica alimenti
        FirebaseFirestore.getInstance()
            .collection("users").document("flavio")
            .get()
            .addOnSuccessListener { doc ->
                @Suppress("UNCHECKED_CAST")
                val rawFoods = doc.get("proteinFoods") as? List<Map<String, Any>> ?: emptyList()
                if (rawFoods.isEmpty()) {
                    Toast.makeText(this, "Nessun alimento configurato — aprilo prima dall'app", Toast.LENGTH_LONG).show()
                    finish()
                    return@addOnSuccessListener
                }

                foods = rawFoods.sortedBy { (it["name"] as? String) ?: "" }

                foods.forEachIndexed { index, f ->
                    val emoji = f["emoji"] as? String ?: "🍽️"
                    val name = f["name"] as? String ?: "Alimento"
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
                Toast.makeText(this, "Errore caricamento alimenti", Toast.LENGTH_SHORT).show()
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
                grams = maxOf(1, grams + delta)
                gramsView.text = grams.toString()
                proteinResult.text = "= ${currentProtein()}g proteine"
            }
        }
    }

    private fun updateSelection() {
        val f = foods.getOrNull(selectedIndex) ?: return
        val emoji = f["emoji"] as? String ?: "🍽️"
        val name = f["name"] as? String ?: ""
        val per100 = asDouble(f["proteinPer100g"])

        foodName.text = "$emoji $name"
        proteinLabel.text = "${per100}g proteine / 100g"
        proteinResult.text = "= ${currentProtein()}g proteine"

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

    private fun saveProtein(food: Map<String, Any>, grams: Int, proteinGrams: Double) {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())

        val logEntry = hashMapOf(
            "id" to System.currentTimeMillis().toString(),
            "foodId" to (food["id"] as? String ?: "manual"),
            "name" to (food["name"] as? String ?: "Alimento"),
            "emoji" to (food["emoji"] as? String ?: "🍽️"),
            "grams" to grams,
            "proteinGrams" to proteinGrams,
            "time" to timeStr
        )

        FirebaseFirestore.getInstance()
            .collection("users").document("flavio")
            .update("proteinLog.$today", FieldValue.arrayUnion(logEntry))
            .addOnSuccessListener {
                Toast.makeText(this, "+${proteinGrams}g proteine — ${food["name"]}", Toast.LENGTH_SHORT).show()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Errore salvataggio", Toast.LENGTH_SHORT).show()
            }
    }
}
