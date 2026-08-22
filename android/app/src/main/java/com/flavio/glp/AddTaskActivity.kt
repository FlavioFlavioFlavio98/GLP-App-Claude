package com.flavio.glp

import android.app.Activity
import android.app.DatePickerDialog
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.*
import com.google.firebase.firestore.FirebaseFirestore
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.text.SimpleDateFormat
import java.util.*

class AddTaskActivity : Activity() {

    private val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    private val displaySdf = SimpleDateFormat("d MMMM yyyy", Locale.ITALIAN)
    private var selectedDeadline = sdf.format(Date())
    private var selectedReward = 2
    private var selectedPenalty = 1
    private var selectedPriority = "medium"
    private var isAlreadyDone = false

    // Chip TextViews — inizializzati in setupViews
    private lateinit var deadlineOggi: TextView
    private lateinit var deadlineDomani: TextView
    private lateinit var deadlineCal: TextView
    private lateinit var deadlineSectionLabel: TextView
    private lateinit var chipGiaFatta: TextView
    private lateinit var priorityLow: TextView
    private lateinit var priorityMedium: TextView
    private lateinit var priorityHigh: TextView
    private lateinit var reward1: TextView
    private lateinit var reward2: TextView
    private lateinit var reward3: TextView
    private lateinit var reward5: TextView
    private lateinit var penalty0: TextView
    private lateinit var penalty1: TextView
    private lateinit var penalty2: TextView
    private lateinit var penalty3: TextView
    private lateinit var penaltySection: android.widget.LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.setBackgroundDrawableResource(android.R.color.transparent)
        // Forza tastiera sempre visibile a livello di finestra
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
        setContentView(R.layout.dialog_add_task)
        setupViews()
        // Focus + tastiera con delay per garantire che la view sia attached
        val input = findViewById<EditText>(R.id.task_name_input)
        input.requestFocus()
        Handler(Looper.getMainLooper()).postDelayed({
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(input, InputMethodManager.SHOW_FORCED)
        }, 200)
    }

    private fun setupViews() {
        deadlineOggi = findViewById(R.id.deadline_oggi)
        deadlineDomani = findViewById(R.id.deadline_domani)
        deadlineCal = findViewById(R.id.deadline_cal)
        deadlineSectionLabel = findViewById(R.id.deadline_section_label)
        chipGiaFatta = findViewById(R.id.chip_gia_fatta)
        priorityLow = findViewById(R.id.priority_low)
        priorityMedium = findViewById(R.id.priority_medium)
        priorityHigh = findViewById(R.id.priority_high)
        reward1 = findViewById(R.id.reward_1)
        reward2 = findViewById(R.id.reward_2)
        reward3 = findViewById(R.id.reward_3)
        reward5 = findViewById(R.id.reward_5)
        penalty0 = findViewById(R.id.penalty_0)
        penalty1 = findViewById(R.id.penalty_1)
        penalty2 = findViewById(R.id.penalty_2)
        penalty3 = findViewById(R.id.penalty_3)
        penaltySection = findViewById(R.id.penalty_section)
        val deadlineLbl = findViewById<TextView>(R.id.deadline_label)
        val btnCrea = findViewById<TextView>(R.id.btn_crea)

        deadlineLbl.visibility = View.GONE

        // ─── Chip già fatta ───
        chipGiaFatta.setOnClickListener {
            isAlreadyDone = !isAlreadyDone
            if (isAlreadyDone) {
                // selezione "oggi" come data di completamento di default
                selectedDeadline = sdf.format(Date())
                selectDeadline("oggi")
                deadlineLbl.visibility = View.GONE
                penaltySection.visibility = View.GONE
                deadlineDomani.visibility = View.GONE
                deadlineSectionLabel.text = "QUANDO L'HAI FATTA"
                chipGiaFatta.text = "✅  Segna come già fatta"
                setChip(chipGiaFatta, true)
                btnCrea.text = "Registra come fatta"
            } else {
                penaltySection.visibility = View.VISIBLE
                deadlineDomani.visibility = View.VISIBLE
                deadlineSectionLabel.text = "SCADENZA"
                chipGiaFatta.text = "☐  Segna come già fatta"
                setChip(chipGiaFatta, false)
                btnCrea.text = "Crea"
            }
        }

        // ─── Scadenza ───
        deadlineOggi.setOnClickListener {
            selectedDeadline = sdf.format(Date())
            deadlineLbl.visibility = View.GONE
            selectDeadline("oggi")
        }
        deadlineDomani.setOnClickListener {
            val cal = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, 1) }
            selectedDeadline = sdf.format(cal.time)
            deadlineLbl.visibility = View.GONE
            selectDeadline("domani")
        }
        deadlineCal.setOnClickListener {
            val cal = Calendar.getInstance()
            DatePickerDialog(this, { _, y, m, d ->
                selectedDeadline = String.format("%04d-%02d-%02d", y, m + 1, d)
                val parsed = sdf.parse(selectedDeadline)!!
                deadlineLbl.text = displaySdf.format(parsed)
                deadlineLbl.visibility = View.VISIBLE
                selectDeadline("cal")
            }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
        }

        // ─── Priorità ───
        priorityLow.setOnClickListener { selectedPriority = "low"; selectPriority("low") }
        priorityMedium.setOnClickListener { selectedPriority = "medium"; selectPriority("medium") }
        priorityHigh.setOnClickListener { selectedPriority = "high"; selectPriority("high") }

        // ─── Reward ───
        reward1.setOnClickListener { selectedReward = 1; selectReward(1) }
        reward2.setOnClickListener { selectedReward = 2; selectReward(2) }
        reward3.setOnClickListener { selectedReward = 3; selectReward(3) }
        reward5.setOnClickListener { selectedReward = 5; selectReward(5) }

        // ─── Penalità ───
        penalty0.setOnClickListener { selectedPenalty = 0; selectPenalty(0) }
        penalty1.setOnClickListener { selectedPenalty = 1; selectPenalty(1) }
        penalty2.setOnClickListener { selectedPenalty = 2; selectPenalty(2) }
        penalty3.setOnClickListener { selectedPenalty = 3; selectPenalty(3) }

        // ─── Bottoni ───
        findViewById<View>(R.id.btn_annulla).setOnClickListener { finish() }
        btnCrea.setOnClickListener {
            val name = findViewById<EditText>(R.id.task_name_input).text.toString().trim()
            if (name.isNotEmpty()) saveTask(name)
            else Toast.makeText(this, "Inserisci un nome per la task", Toast.LENGTH_SHORT).show()
        }
    }

    // ─── Chip selection helpers ───

    private fun setChip(view: TextView, selected: Boolean) {
        view.setBackgroundResource(if (selected) R.drawable.chip_selected else R.drawable.chip_unselected)
        view.setTextColor(if (selected) 0xFFFFCA28.toInt() else 0xFFC7C7D1.toInt())
        view.setTypeface(null, if (selected) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
    }

    private fun selectDeadline(active: String) {
        setChip(deadlineOggi, active == "oggi")
        setChip(deadlineDomani, active == "domani")
        setChip(deadlineCal, active == "cal")
    }

    private fun selectPriority(active: String) {
        setChip(priorityLow, active == "low")
        setChip(priorityMedium, active == "medium")
        setChip(priorityHigh, active == "high")
    }

    private fun selectReward(active: Int) {
        setChip(reward1, active == 1)
        setChip(reward2, active == 2)
        setChip(reward3, active == 3)
        setChip(reward5, active == 5)
    }

    private fun selectPenalty(active: Int) {
        setChip(penalty0, active == 0)
        setChip(penalty1, active == 1)
        setChip(penalty2, active == 2)
        setChip(penalty3, active == 3)
    }

    // ─── Salvataggio ───

    private fun saveTask(name: String) {
        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        val db = FirebaseFirestore.getInstance()
        val userRef = db.collection("users").document("flavio")
        val today = sdf.format(Date())

        val task: HashMap<String, Any> = if (isAlreadyDone) {
            hashMapOf(
                "id" to "task_${System.currentTimeMillis()}",
                "title" to name,
                "deadline" to selectedDeadline,
                "reward" to selectedReward.toDouble(),
                "penalty" to 0.0,
                "priority" to selectedPriority,
                "status" to "completed",
                "rewardApplied" to true,
                "penaltyApplied" to false,
                "completedAt" to "${selectedDeadline}T23:59:59.000Z",
                "createdAt" to com.google.firebase.Timestamp.now()
            )
        } else {
            hashMapOf(
                "id" to "task_${System.currentTimeMillis()}",
                "title" to name,
                "deadline" to selectedDeadline,
                "reward" to selectedReward.toDouble(),
                "penalty" to selectedPenalty.toDouble(),
                "priority" to selectedPriority,
                "status" to "active",
                "rewardApplied" to false,
                "penaltyApplied" to false,
                "createdAt" to com.google.firebase.Timestamp.now()
            )
        }

        if (!isAlreadyDone && selectedDeadline == today) {
            addTaskToWidgetPrefs(task)
        }

        userRef.get().addOnSuccessListener { doc ->
            @Suppress("UNCHECKED_CAST")
            val existing = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
            val updates = hashMapOf<String, Any>("tasks" to existing + task)
            if (isAlreadyDone) {
                updates["score"] = com.google.firebase.firestore.FieldValue.increment(selectedReward.toLong())
            }
            userRef.update(updates)
                .addOnSuccessListener {
                    if (isAlreadyDone && selectedDeadline == today) {
                        DayWidgetProvider.applyDelta(this, earnedDelta = selectedReward, taskEarnedDelta = selectedReward)
                    }
                    vibrate()
                    val msg = if (isAlreadyDone) "Task già fatta registrata! +${selectedReward}pt" else "Task creata!"
                    Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
                    finish()
                }
                .addOnFailureListener { e ->
                    Toast.makeText(this, "Errore: ${e.message}", Toast.LENGTH_LONG).show()
                    finish()
                }
        }.addOnFailureListener { e ->
            Toast.makeText(this, "Errore connessione: ${e.message}", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    private fun addTaskToWidgetPrefs(task: Map<String, Any>) {
        val prefs = getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
        val json = prefs.getString("active_tasks", "[]") ?: "[]"
        val type = object : TypeToken<MutableList<Map<String, Any>>>() {}.type
        val current: MutableList<Map<String, Any>> = try {
            Gson().fromJson(json, type) ?: mutableListOf()
        } catch (e: Exception) { mutableListOf() }
        current.add(task)
        prefs.edit().putString("active_tasks", Gson().toJson(current.take(5))).apply()

        val manager = AppWidgetManager.getInstance(this)
        val ids = manager.getAppWidgetIds(ComponentName(this, TaskWidgetProvider::class.java))
        ids.forEach { TaskWidgetProvider.updateWidget(this, manager, it) }
    }

    private fun vibrate() {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator.vibrate(VibrationEffect.createOneShot(60, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                v.vibrate(VibrationEffect.createOneShot(60, VibrationEffect.DEFAULT_AMPLITUDE))
            }
        } catch (e: Exception) { /* ignora */ }
    }
}
