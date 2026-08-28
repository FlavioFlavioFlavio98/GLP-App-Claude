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
    // null = non ancora scelto dall'utente — reward/penalità sono facoltativi,
    // se non selezionati la task si crea comunque con valore 0.
    private var selectedReward: Int? = null
    private var selectedPenalty: Int? = null
    private var selectedPriority = "medium"
    private var isAlreadyDone = false
    // Ricorrente: solo in creazione (non in modifica) — vedi RecurringTasksModal
    // sul web per la stessa logica (regola separata + prima istanza generata
    // subito, scadenza di default oggi).
    private var isRecurring = false
    // Se valorizzato, il dialog è in modalità modifica di una task esistente
    // (aperto dal tap sul nome nel widget) invece che creazione — stesso layout,
    // cambia solo cosa fa il bottone "salva" e i valori pre-selezionati.
    private var editTaskId: String? = null

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
    private lateinit var chipRecurring: TextView
    private lateinit var recurringIntervalSection: android.widget.LinearLayout
    private lateinit var recurringIntervalInput: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.setBackgroundDrawableResource(android.R.color.transparent)
        // Forza tastiera sempre visibile a livello di finestra
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
        setContentView(R.layout.dialog_add_task)
        editTaskId = intent.getStringExtra("edit_task_id")
        setupViews()
        if (editTaskId != null) applyEditExtras()
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
        chipRecurring = findViewById(R.id.chip_recurring)
        recurringIntervalSection = findViewById(R.id.recurring_interval_section)
        recurringIntervalInput = findViewById(R.id.recurring_interval_input)
        val deadlineLbl = findViewById<TextView>(R.id.deadline_label)
        val btnCrea = findViewById<TextView>(R.id.btn_crea)

        deadlineLbl.visibility = View.GONE

        // La ricorrenza si imposta solo alla creazione, non in modifica
        if (editTaskId != null) {
            chipRecurring.visibility = View.GONE
            recurringIntervalSection.visibility = View.GONE
        }

        // ─── Chip ricorrente ───
        chipRecurring.setOnClickListener {
            isRecurring = !isRecurring
            if (isRecurring) {
                // Ricorrente e "già fatta" non hanno senso insieme
                isAlreadyDone = false
                chipGiaFatta.text = "☐  Segna come già fatta"
                setChip(chipGiaFatta, false)
                penaltySection.visibility = View.VISIBLE
                deadlineDomani.visibility = View.VISIBLE
                deadlineSectionLabel.text = "SCADENZA"
                chipRecurring.text = "✅  🔁 Task ricorrente"
                setChip(chipRecurring, true)
                recurringIntervalSection.visibility = View.VISIBLE
                btnCrea.text = "Crea ricorrente"
            } else {
                chipRecurring.text = "☐  🔁 Task ricorrente"
                setChip(chipRecurring, false)
                recurringIntervalSection.visibility = View.GONE
                btnCrea.text = "Crea"
            }
        }

        // ─── Chip già fatta ───
        chipGiaFatta.setOnClickListener {
            isAlreadyDone = !isAlreadyDone
            if (isAlreadyDone) {
                // "Già fatta" e ricorrente non hanno senso insieme
                isRecurring = false
                chipRecurring.text = "☐  🔁 Task ricorrente"
                setChip(chipRecurring, false)
                recurringIntervalSection.visibility = View.GONE
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
            if (name.isEmpty()) {
                Toast.makeText(this, "Inserisci un nome per la task", Toast.LENGTH_SHORT).show()
            } else {
                val id = editTaskId
                if (id != null) updateTask(id, name) else saveTask(name)
            }
        }
    }

    // ─── Modalità modifica ───

    private fun applyEditExtras() {
        val title = intent.getStringExtra("edit_title") ?: ""
        val priority = intent.getStringExtra("edit_priority") ?: "medium"
        val reward = intent.getIntExtra("edit_reward", 0)
        val penalty = intent.getIntExtra("edit_penalty", 0)
        val deadline = intent.getStringExtra("edit_deadline") ?: sdf.format(Date())

        findViewById<EditText>(R.id.task_name_input).setText(title)
        findViewById<TextView>(R.id.dialog_title).text = "Modifica Task"
        findViewById<TextView>(R.id.btn_crea).text = "Salva modifiche"
        findViewById<View>(R.id.chip_gia_fatta).visibility = View.GONE

        selectedPriority = priority
        selectPriority(priority)

        // I chip reward/penalità hanno solo alcuni valori fissi (1/2/3/5 e
        // 0/1/2/3): se il valore salvato non corrisponde a nessuno (es. 0 per
        // reward, impostabile solo lasciando il chip vuoto) restano tutti
        // deselezionati, che rappresenta correttamente "nessuno scelto".
        if (reward in listOf(1, 2, 3, 5)) { selectedReward = reward; selectReward(reward) }
        if (penalty in 0..3) { selectedPenalty = penalty; selectPenalty(penalty) }

        selectedDeadline = deadline
        val today = sdf.format(Date())
        val tomorrow = sdf.format(Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, 1) }.time)
        when (deadline) {
            today -> selectDeadline("oggi")
            tomorrow -> selectDeadline("domani")
            else -> {
                selectDeadline("cal")
                try {
                    val parsed = sdf.parse(deadline)!!
                    val deadlineLbl = findViewById<TextView>(R.id.deadline_label)
                    deadlineLbl.text = displaySdf.format(parsed)
                    deadlineLbl.visibility = View.VISIBLE
                } catch (e: Exception) { /* data non parsabile, ignora */ }
            }
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
        // Facoltativi: se l'utente non ha toccato i chip reward/penalità, la task
        // si crea comunque con valore 0 invece di forzare un default.
        val reward = selectedReward ?: 0
        val penalty = selectedPenalty ?: 0

        val task: HashMap<String, Any> = if (isAlreadyDone) {
            hashMapOf(
                "id" to "task_${System.currentTimeMillis()}",
                "title" to name,
                "deadline" to selectedDeadline,
                "reward" to reward.toDouble(),
                "penalty" to 0.0,
                "priority" to selectedPriority,
                "status" to "completed",
                "rewardApplied" to true,
                "penaltyApplied" to false,
                "completedAt" to "${selectedDeadline}T23:59:59.000Z",
                "createdAt" to com.google.firebase.Timestamp.now()
            )
        } else {
            // Scadenza già passata → segnata scaduta subito invece di restare
            // "active" fino al prossimo giro notturno di expireTasks (stesso
            // motivo della versione web in store.jsx addTask/editTask).
            val isPast = selectedDeadline < today
            val map = hashMapOf<String, Any>(
                "id" to "task_${System.currentTimeMillis()}",
                "title" to name,
                "deadline" to selectedDeadline,
                "reward" to reward.toDouble(),
                "penalty" to penalty.toDouble(),
                "priority" to selectedPriority,
                "status" to if (isPast) "expired" else "active",
                "rewardApplied" to false,
                "penaltyApplied" to isPast,
                "createdAt" to com.google.firebase.Timestamp.now()
            )
            if (isPast) {
                map["expiredAt"] = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                    .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(Date())
            }
            map
        }

        if (isRecurring) {
            saveRecurringTask(name, reward, penalty)
            return
        }

        if (!isAlreadyDone && selectedDeadline == today) {
            addTaskToWidgetPrefs(task)
        }

        // arrayUnion invece di get()+update(): un read-modify-write non atomico
        // qui perderebbe silenziosamente qualunque modifica concorrente a
        // "tasks" fatta da web/telefono/altro widget nella finestra tra le due
        // chiamate (stessa classe di bug della perdita dati del 28/8/2026,
        // anche se più circoscritta) — e in più evita del tutto la lettura.
        val updates = hashMapOf<String, Any>("tasks" to com.google.firebase.firestore.FieldValue.arrayUnion(task))
        if (isAlreadyDone) {
            updates["score"] = com.google.firebase.firestore.FieldValue.increment(reward.toLong())
        }
        userRef.update(updates)
            .addOnSuccessListener {
                if (isAlreadyDone && selectedDeadline == today) {
                    DayWidgetProvider.applyDelta(this, earnedDelta = reward, taskEarnedDelta = reward)
                }
                vibrate()
                val msg = if (isAlreadyDone) "Task già fatta registrata! +${reward}pt" else "Task creata!"
                Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
                finish()
            }
            .addOnFailureListener { e ->
                Toast.makeText(this, "Errore: ${e.message}", Toast.LENGTH_LONG).show()
                finish()
            }
    }

    // Crea la regola ricorrente (recurringTasks) + la prima istanza (tasks) —
    // stessa struttura di addRecurringTask in store.jsx sul web.
    private fun saveRecurringTask(name: String, reward: Int, penalty: Int) {
        val db = FirebaseFirestore.getInstance()
        val userRef = db.collection("users").document("flavio")
        val intervalDays = recurringIntervalInput.text.toString().toIntOrNull()?.coerceAtLeast(1) ?: 7
        val recurringId = "rec_${System.currentTimeMillis()}"

        val template = hashMapOf<String, Any>(
            "id" to recurringId,
            "title" to name,
            "priority" to selectedPriority,
            "reward" to reward.toDouble(),
            "penalty" to penalty.toDouble(),
            "intervalDays" to intervalDays.toDouble(),
            "active" to true,
            "createdAt" to com.google.firebase.Timestamp.now(),
        )
        val firstInstance = hashMapOf<String, Any>(
            "id" to "task_${System.currentTimeMillis()}",
            "title" to name,
            "deadline" to selectedDeadline,
            "reward" to reward.toDouble(),
            "penalty" to penalty.toDouble(),
            "priority" to selectedPriority,
            "status" to "active",
            "rewardApplied" to false,
            "penaltyApplied" to false,
            "createdAt" to com.google.firebase.Timestamp.now(),
            "recurringId" to recurringId,
        )

        if (selectedDeadline == sdf.format(Date())) {
            addTaskToWidgetPrefs(firstInstance)
        }

        // arrayUnion su entrambi i campi, niente più get()+update() (stesso
        // motivo della race in saveTask qui sopra).
        userRef.update(
            mapOf(
                "tasks" to com.google.firebase.firestore.FieldValue.arrayUnion(firstInstance),
                "recurringTasks" to com.google.firebase.firestore.FieldValue.arrayUnion(template),
            )
        ).addOnSuccessListener {
            vibrate()
            Toast.makeText(this, "🔁 Task ricorrente creata!", Toast.LENGTH_SHORT).show()
            finish()
        }.addOnFailureListener { e ->
            Toast.makeText(this, "Errore: ${e.message}", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    private fun updateTask(taskId: String, name: String) {
        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }
        val reward = selectedReward ?: 0
        val penalty = selectedPenalty ?: 0

        val db = FirebaseFirestore.getInstance()
        val userRef = db.collection("users").document("flavio")
        val today = sdf.format(Date())
        // Transazione invece di get()+update(): qui si modifica un elemento
        // esistente dell'array in base al suo stato attuale (attiva→scaduta o
        // viceversa), quindi arrayUnion non basta — serve una vera lettura
        // atomica con retry automatico in caso di scrittura concorrente nella
        // stessa finestra (stessa classe di bug della perdita dati del
        // 28/8/2026, qui su un singolo elemento invece che sull'intero documento).
        db.runTransaction { transaction ->
            val doc = transaction.get(userRef)
            @Suppress("UNCHECKED_CAST")
            val existing = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
            val updated = existing.map { t ->
                if (t["id"]?.toString() == taskId) {
                    t.toMutableMap().apply {
                        put("title", name)
                        put("deadline", selectedDeadline)
                        put("reward", reward.toDouble())
                        put("penalty", penalty.toDouble())
                        put("priority", selectedPriority)
                        // Se si sposta la scadenza nel passato su una task
                        // ancora attiva, la segna scaduta subito.
                        if ((this["status"] as? String) == "active" && selectedDeadline < today) {
                            put("status", "expired")
                            put("penaltyApplied", true)
                            put("expiredAt", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(Date()))
                        }
                        // Il contrario: si rimanda una task scaduta a oggi o
                        // dopo → torna attiva, penalità già applicata annullata
                        // (expiredAt/penaltyApplied sono ciò che il calcolo
                        // punteggio usa davvero, non lo status da solo).
                        if ((this["status"] as? String) == "expired" && selectedDeadline >= today) {
                            put("status", "active")
                            put("penaltyApplied", false)
                            remove("expiredAt")
                        }
                    }
                } else t
            }
            transaction.update(userRef, "tasks", updated)
        }.addOnSuccessListener {
            refreshTaskWidgets()
            vibrate()
            Toast.makeText(this, "Task aggiornata", Toast.LENGTH_SHORT).show()
            finish()
        }.addOnFailureListener { e ->
            Toast.makeText(this, "Errore: ${e.message}", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    private fun refreshTaskWidgets() {
        val manager = AppWidgetManager.getInstance(this)
        val ids = manager.getAppWidgetIds(ComponentName(this, TaskWidgetProvider::class.java))
        ids.forEach { TaskWidgetProvider.updateWidget(this, manager, it) }
    }

    private fun addTaskToWidgetPrefs(task: Map<String, Any>) {
        val prefs = getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
        val json = prefs.getString("active_tasks", "[]") ?: "[]"
        val type = object : TypeToken<MutableList<Map<String, Any>>>() {}.type
        val current: MutableList<Map<String, Any>> = try {
            Gson().fromJson(json, type) ?: mutableListOf()
        } catch (e: Exception) { mutableListOf() }
        current.add(task)
        prefs.edit().putString("active_tasks", Gson().toJson(current.take(TaskWidgetProvider.MAX_ROWS))).apply()

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
