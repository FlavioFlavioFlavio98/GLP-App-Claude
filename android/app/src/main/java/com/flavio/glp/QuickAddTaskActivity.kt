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

// Aggiunta rapida stile Google Tasks: solo il titolo, nessun altro dettaglio.
// La task si crea con priorità/reward/penalità a 0/default — si rifiniscono
// poi dall'app se serve, aprendo la task in modifica (tap sul nome nel widget).
class QuickAddTaskActivity : Activity() {

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
            hint = "Nuova task..."
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            imeOptions = EditorInfo.IME_ACTION_DONE
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
        Handler(Looper.getMainLooper()).postDelayed({
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(input, InputMethodManager.SHOW_FORCED)
        }, 150)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun submit(rawTitle: String) {
        val title = rawTitle.trim()
        if (title.isEmpty()) { finish(); return }

        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val widgetPrefs = getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
        val deadline = widgetPrefs.getString("selected_date", null) ?: today

        val task = hashMapOf(
            "id" to "task_${System.currentTimeMillis()}",
            "title" to title,
            "deadline" to deadline,
            "reward" to 0.0,
            "penalty" to 0.0,
            "priority" to "medium",
            "status" to "active",
            "rewardApplied" to false,
            "penaltyApplied" to false,
            "createdAt" to com.google.firebase.Timestamp.now()
        )

        val db = FirebaseFirestore.getInstance()
        val userRef = db.collection("users").document("flavio")
        userRef.get().addOnSuccessListener { doc ->
            @Suppress("UNCHECKED_CAST")
            val existing = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
            userRef.update("tasks", existing + task)
                .addOnSuccessListener {
                    Toast.makeText(this, "Task creata", Toast.LENGTH_SHORT).show()
                    addTaskToWidgetPrefs(task)
                    finish()
                }
                .addOnFailureListener {
                    Toast.makeText(this, "Errore: ${it.message}", Toast.LENGTH_LONG).show()
                    finish()
                }
        }.addOnFailureListener { finish() }
    }

    // Aggiornamento ottimistico: la task appena creata ha sempre deadline uguale
    // alla data attualmente selezionata nel widget, quindi va aggiunta subito
    // alla cache locale invece di aspettare il prossimo refresh/sync periodico.
    private fun addTaskToWidgetPrefs(task: Map<String, Any>) {
        val prefs = getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
        val json = prefs.getString("active_tasks", "[]") ?: "[]"
        val type = object : com.google.gson.reflect.TypeToken<MutableList<Map<String, Any>>>() {}.type
        val current: MutableList<Map<String, Any>> = try {
            com.google.gson.Gson().fromJson(json, type) ?: mutableListOf()
        } catch (e: Exception) { mutableListOf() }
        current.add(task)
        prefs.edit().putString("active_tasks", com.google.gson.Gson().toJson(current.take(TaskWidgetProvider.MAX_ROWS))).apply()

        val manager = AppWidgetManager.getInstance(this)
        val ids = manager.getAppWidgetIds(ComponentName(this, TaskWidgetProvider::class.java))
        ids.forEach { TaskWidgetProvider.updateWidget(this, manager, it) }
    }
}
