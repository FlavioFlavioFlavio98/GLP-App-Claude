package com.flavio.glp

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.lifecycle.lifecycleScope
import com.getcapacitor.BridgeActivity
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.gson.Gson
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : BridgeActivity() {

    companion object {
        const val GOOGLE_FIT_REQUEST_CODE = 1001
        const val ACTIVITY_RECOGNITION_REQUEST_CODE = 1002
    }

    private val healthConnectPermissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class)
    )

    private val requestPermissionActivityContract = PermissionController.createRequestPermissionResultContract()

    private val requestHealthPermissions = registerForActivityResult(requestPermissionActivityContract) { granted: Set<String> ->
        android.util.Log.d("FitSync", "Health Connect permissions result: $granted")
        android.util.Log.d("FitSync", "Required: $healthConnectPermissions")
        android.util.Log.d("FitSync", "All granted: ${granted.containsAll(healthConnectPermissions)}")
        if (granted.containsAll(healthConnectPermissions)) {
            triggerFitSync()
        } else {
            android.util.Log.w("FitSync", "Permessi Health Connect NON tutti concessi — sync non parte")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(NotificationPlugin::class.java)
        registerPlugin(MealSessionPlugin::class.java)
        super.onCreate(savedInstanceState)
        android.util.Log.d("GLPWidget", "=== MainActivity onCreate ===")
        android.webkit.WebView.setWebContentsDebuggingEnabled(true)
        WidgetUpdateWorker.schedule(this)
        WidgetRefreshScheduler.scheduleNext(this)
        NotificationReceiver.createChannel(this)

        // Inietta il build timestamp nella WebView non appena il bridge è pronto
        // (getBridgeWebViewClient() non esiste più in Capacitor 8.x: BridgeActivity
        // non espone più quell'hook, quindi iniettiamo direttamente sul webView del bridge)
        bridge.webView.post {
            val t = BuildConfig.BUILD_TIME.replace("'", "\\'")
            bridge.webView.evaluateJavascript("window.__ANDROID_BUILD_TIME__='$t';", null)
        }

        FirebaseAuth.getInstance().addAuthStateListener { auth ->
            android.util.Log.d("GLPWidget", "Auth state changed: ${auth.currentUser?.email}")
            if (auth.currentUser != null) {
                cleanAutoFitHabitsOnce()
                saveWidgetData()
                setupHealthConnect()
                // Ri-programma gli allarmi usando le impostazioni salvate localmente
                NotificationScheduler.scheduleAll(this)
                // Assicura che il token FCM sia salvato per i push silenziosi di sync widget
                WidgetSyncMessagingService.registerTokenIfNeeded()
            }
        }

        // Gestisci deep link se l'app è aperta da una notifica
        handleNotificationIntent(intent)

        setupBackHandling()
    }

    // Lo swipe-back di sistema (o il tasto indietro) chiudeva subito l'app perché
    // la WebView non ha una vera history di navigazione (è una SPA React, non
    // pagine multiple). Ora: primo tentativo delegato a window.__nativeBackHandler
    // in App.jsx (chiude modal/torna alla tab Oggi); solo se la web app dice che
    // non c'è nulla da chiudere, serve un secondo swipe entro 2s per uscire —
    // altrimenti mostriamo solo un Toast di conferma.
    private var lastBackPressAt = 0L

    private fun setupBackHandling() {
        onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                bridge.webView.evaluateJavascript(
                    "(window.__nativeBackHandler ? String(window.__nativeBackHandler()) : 'false')"
                ) { rawResult ->
                    val handled = rawResult?.trim('"') == "true"
                    if (handled) return@evaluateJavascript

                    val now = System.currentTimeMillis()
                    if (now - lastBackPressAt < 2000) {
                        finish()
                    } else {
                        lastBackPressAt = now
                        Toast.makeText(this@MainActivity, "Trascina di nuovo per uscire", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleNotificationIntent(intent)
    }

    private fun handleNotificationIntent(intent: Intent?) {
        val tab = intent?.getStringExtra("open_tab") ?: return
        android.util.Log.d("GLP_Notif", "Deep link to tab: $tab")
        // Attende che la WebView sia pronta prima di eseguire JS
        bridge.webView.post {
            bridge.webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('glp_open_tab',{detail:'$tab'}))",
                null
            )
        }
    }

    private fun cleanAutoFitHabitsOnce() {
        val prefs = getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
        if (prefs.getBoolean("auto_fit_cleaned", false)) return
        val db = com.google.firebase.firestore.FirebaseFirestore.getInstance()
        db.collection("users").document("flavio").get()
            .addOnSuccessListener { doc ->
                @Suppress("UNCHECKED_CAST")
                val habits = doc.get("habits") as? List<Map<String, Any>> ?: emptyList()
                val cleaned = habits.filter {
                    it["id"] != "glp_auto_steps" && it["id"] != "glp_auto_sleep"
                }
                if (cleaned.size < habits.size) {
                    db.collection("users").document("flavio").update("habits", cleaned)
                        .addOnSuccessListener {
                            android.util.Log.d("GLPWidget", "Removed ${habits.size - cleaned.size} auto_fit habits")
                            prefs.edit().putBoolean("auto_fit_cleaned", true).apply()
                        }
                } else {
                    prefs.edit().putBoolean("auto_fit_cleaned", true).apply()
                }
            }
    }

    private fun setupHealthConnect() {
        val status = HealthConnectClient.getSdkStatus(this)
        android.util.Log.d("FitSync", "Health Connect status: $status")
        if (status != HealthConnectClient.SDK_AVAILABLE) {
            android.util.Log.w("FitSync", "Health Connect non disponibile (status=$status)")
            return
        }
        val client = HealthConnectClient.getOrCreate(this)
        lifecycleScope.launch {
            val granted = client.permissionController.getGrantedPermissions()
            android.util.Log.d("FitSync", "Already granted: $granted")
            android.util.Log.d("FitSync", "Required: $healthConnectPermissions")
            if (granted.containsAll(healthConnectPermissions)) {
                android.util.Log.d("FitSync", "Permessi OK — avvio sync")
                triggerFitSync()
            } else {
                android.util.Log.d("FitSync", "Permessi mancanti — lancio dialog Health Connect")
                requestHealthPermissions.launch(healthConnectPermissions)
            }
        }
    }

    private fun fetchUrgentReadingsCount() {
        FirebaseFirestore.getInstance()
            .collection("users").document("flavio").collection("readings")
            .get()
            .addOnSuccessListener { snap ->
                val nowMs = System.currentTimeMillis()
                val thirtyDaysMs = 30L * 24 * 60 * 60 * 1000
                val urgentCount = snap.documents.count { doc ->
                    val lastReadMs = doc.getTimestamp("lastReadAt")?.toDate()?.time
                        ?: doc.getTimestamp("uploadedAt")?.toDate()?.time
                        ?: 0L
                    (nowMs - lastReadMs) >= thirtyDaysMs
                }
                getSharedPreferences("glp_widget", Context.MODE_PRIVATE).edit()
                    .putInt("notification_readings_urgent", urgentCount)
                    .apply()
                android.util.Log.d("GLP_Notif", "Urgent readings: $urgentCount")
            }
    }

    private fun triggerFitSync() {
        android.util.Log.d("FitSync", "triggerFitSync called")
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        android.util.Log.d("FitSync", "Current hour: $hour — sync_all")
        startService(Intent(this, FitSyncService::class.java).apply {
            putExtra("action", "sync_all")
        })
    }

    private fun saveWidgetData() {
        if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
            com.google.firebase.FirebaseApp.initializeApp(this)
        }

        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        // completedAt/expiredAt sono salvati in UTC, "today" è la data locale
        // del device: con un fuso avanti rispetto a UTC (es. Italia/Bulgaria),
        // un evento delle prime ore del mattino locale ha ancora la data UTC
        // di ieri — "today" da solo lo escluderebbe. Confrontare anche con
        // "yesterday" copre questo caso qualunque sia l'offset positivo.
        val yesterday = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).let { sdf ->
            val cal = Calendar.getInstance()
            cal.add(Calendar.DAY_OF_YEAR, -1)
            sdf.format(cal.time)
        }

        FirebaseFirestore.getInstance()
            .collection("users").document("flavio")
            .get()
            .addOnSuccessListener { doc ->
                android.util.Log.d("GLPWidget", "=== saveWidgetData START ===")
                android.util.Log.d("GLPWidget", "Today: $today")
                android.util.Log.d("GLPWidget", "DailyLogs keys: ${(doc.get("dailyLogs") as? Map<*, *>)?.keys}")
                android.util.Log.d("GLPWidget", "Habits count: ${(doc.get("habits") as? List<*>)?.size}")

                @Suppress("UNCHECKED_CAST")
                val tasks = doc.get("tasks") as? List<Map<String, Any>> ?: emptyList()
                val habits = doc.get("habits") as? List<Map<String, Any>> ?: emptyList()
                val rewards = doc.get("rewards") as? List<Map<String, Any>> ?: emptyList()
                val dailyLogs = doc.get("dailyLogs") as? Map<String, Any> ?: emptyMap()
                val todayLog = dailyLogs[today] as? Map<String, Any> ?: emptyMap()

                android.util.Log.d("GLPWidget", "TodayLog: $todayLog")
                todayLog.forEach { (key, value) ->
                    android.util.Log.d("GLPWidget", "  todayLog[$key] = $value (${value?.javaClass?.simpleName})")
                }

                // Task attive per la data selezionata nel widget (oggi = include
                // anche le scadute), più le completate quel giorno
                val widgetPrefs = getSharedPreferences("glp_widget", Context.MODE_PRIVATE)
                val selectedDate = widgetPrefs.getString("selected_date", null) ?: today
                val activeTasks = TaskWidgetUtils.activeTasksForDate(tasks, selectedDate, today)
                val completedTasksWidget = TaskWidgetUtils.completedTasksForDate(tasks, selectedDate)

                // Converti tutti gli ID in String per confronto robusto (Firestore li salva come Long)
                val doneList = (todayLog["habits"] as? List<*>)?.map { it.toString() } ?: emptyList()
                val failedList = (todayLog["failedHabits"] as? List<*>)?.map { it.toString() } ?: emptyList()
                val doneHabits = doneList  // alias per conteggio abitudini
                val failedHabits = failedList
                val activeHabits = habits.filter { it["archivedAt"] == null }

                android.util.Log.d("GLPWidget", "Done habits: $doneList")
                android.util.Log.d("GLPWidget", "Failed habits: $failedList")

                // Guadagni: abitudini completate
                var habitEarned = 0.0
                doneList.forEach { habitId ->
                    val habit = habits.find {
                        (it["id"] as? String) == habitId || it["id"].toString() == habitId
                    }
                    val reward = (habit?.get("reward") as? Double)
                        ?: (habit?.get("reward") as? Long)?.toDouble() ?: 0.0
                    habitEarned += reward
                    android.util.Log.d("GLPWidget", "Done habit $habitId reward=$reward")
                }

                // Guadagni: esercizi (extra)
                var extraEarned = 0.0
                val exerciseLog = doc.get("exerciseLog") as? Map<String, Any> ?: emptyMap()
                val todayExercises = exerciseLog[today] as? List<Map<String, Any>> ?: emptyList()
                todayExercises.forEach { ex -> extraEarned += (ex["pts"] as? Double) ?: 0.0 }

                // Guadagni: task completate oggi. Controlla anche "yesterday"
                // (stesso motivo per cui expiredTasksCost qui sotto lo fa già):
                // completedAt è in UTC, quindi una task completata nelle prime
                // ore del mattino locale ha ancora la data UTC di ieri e
                // "today" da solo la escluderebbe silenziosamente dal widget.
                var taskEarned = 0.0
                tasks.filter { task ->
                    task["status"] == "completed" &&
                    (task["rewardApplied"] == true || task["rewardApplied"] == "true") &&
                    ((task["completedAt"] as? String)?.startsWith(today) == true ||
                     (task["completedAt"] as? String)?.startsWith(yesterday) == true)
                }.forEach { task ->
                    taskEarned += (task["reward"] as? Double)
                        ?: (task["reward"] as? Long)?.toDouble() ?: 0.0
                }
                android.util.Log.d("GLPWidget", "Task earned today: $taskEarned")

                val earned = habitEarned + extraEarned + taskEarned

                // Costi: penalità abitudini fallite
                var penaltySpent = 0.0
                failedList.forEach { habitId ->
                    val habit = habits.find {
                        (it["id"] as? String) == habitId || it["id"].toString() == habitId
                    }
                    val penalty = (habit?.get("penalty") as? Double)
                        ?: (habit?.get("penalty") as? Long)?.toDouble() ?: 0.0
                    penaltySpent += penalty
                    android.util.Log.d("GLPWidget", "Failed habit $habitId penalty=$penalty")
                }
                // Costi: acquisti negozio
                val purchases = todayLog["purchases"] as? List<*> ?: emptyList<Any>()
                purchases.forEach { rewardId ->
                    val rewardIdStr = rewardId.toString()
                    val reward = rewards.find {
                        (it["id"] as? String) == rewardIdStr || it["id"].toString() == rewardIdStr
                    }
                    penaltySpent += (reward?.get("cost") as? Double)
                        ?: (reward?.get("cost") as? Long)?.toDouble() ?: 0.0
                }

                var spent = penaltySpent

                // Debug: stampa TUTTE le task con status expired
                tasks.filter { it["status"] == "expired" }.forEach { task ->
                    android.util.Log.d("GLPWidget", "Expired task: title=${task["title"]} penalty=${task["penalty"]} expiredAt=${task["expiredAt"]} penaltyApplied=${task["penaltyApplied"]}")
                }

                // Costi da task scadute con penaltyApplied=true
                val yesterday = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).let { sdf ->
                    val cal2 = Calendar.getInstance()
                    cal2.add(Calendar.DAY_OF_YEAR, -1)
                    sdf.format(cal2.time)
                }

                val expiredTasksCost = tasks
                    .filter { task ->
                        task["status"] == "expired" &&
                        (task["penaltyApplied"] == true || task["penaltyApplied"] == "true") &&
                        ((task["expiredAt"] as? String)?.startsWith(today) == true ||
                         (task["expiredAt"] as? String)?.startsWith(yesterday) == true)
                    }
                    .sumOf { task ->
                        (task["penalty"] as? Double)
                            ?: (task["penalty"] as? Long)?.toDouble() ?: 0.0
                    }

                android.util.Log.d("GLPWidget", "Expired tasks found: ${tasks.count { it["status"] == "expired" }}")
                android.util.Log.d("GLPWidget", "Expired tasks cost: $expiredTasksCost")
                spent += expiredTasksCost
                val tasksSpent = expiredTasksCost

                android.util.Log.d("GLPWidget", "Final earned=$earned spent=$spent")

                // Streak: giorni consecutivi con almeno un'abitudine completata
                var streak = 0
                val cal = Calendar.getInstance()
                val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                for (i in 0..365) {
                    val dateStr = sdf.format(cal.time)
                    val dayLog = dailyLogs[dateStr] as? Map<String, Any>
                    val dayDone = dayLog?.get("habits") as? List<*>
                    if (!dayDone.isNullOrEmpty()) {
                        streak++
                        cal.add(Calendar.DAY_OF_YEAR, -1)
                    } else {
                        break
                    }
                }

                val net = earned - spent
                android.util.Log.d("GLPWidget", "=== SAVE WIDGET DATA ===")
                android.util.Log.d("GLPWidget", "Today: $today")
                android.util.Log.d("GLPWidget", "RAW tasks: ${(doc.get("tasks") as? List<*>)?.size}")
                android.util.Log.d("GLPWidget", "DailyLogs keys: ${dailyLogs.keys}")
                android.util.Log.d("GLPWidget", "RAW dailyLogs today: $todayLog")
                todayLog.forEach { (key, value) ->
                    android.util.Log.d("GLPWidget", "todayLog[$key] = $value (${value?.javaClass?.simpleName})")
                }
                android.util.Log.d("GLPWidget", "Done habits count: ${doneHabits.size}")
                android.util.Log.d("GLPWidget", "Failed habits count: ${failedHabits.size}")
                android.util.Log.d("GLPWidget", "Active habits count: ${activeHabits.size}")
                android.util.Log.d("GLPWidget", "Earned: $earned")
                android.util.Log.d("GLPWidget", "Spent: $spent")
                android.util.Log.d("GLPWidget", "Net: $net")
                android.util.Log.d("GLPWidget", "Streak: $streak")
                android.util.Log.d("GLPWidget", "Saving to SharedPrefs...")

                // Abitudini pending per widget abitudini (usa doneList/failedList già definiti sopra)
                val pendingHabits = habits.filter { habit ->
                    val id = habit["id"]?.toString() ?: return@filter false
                    val archived = habit["archivedAt"]
                    archived == null && !doneList.contains(id) && !failedList.contains(id)
                }

                @Suppress("UNCHECKED_CAST")
                val cachedExercises = doc.get("quickExercises") as? List<Map<String, Any>> ?: emptyList()
                @Suppress("UNCHECKED_CAST")
                val cachedFoods = doc.get("proteinFoods") as? List<Map<String, Any>> ?: emptyList()

                @Suppress("UNCHECKED_CAST")
                val meditationLog = doc.get("meditationLog") as? Map<String, Any> ?: emptyMap()
                val meditationCountToday = (meditationLog[today] as? List<*>)?.size ?: 0

                // Salva in SharedPreferences — tutto Int per evitare ClassCastException
                getSharedPreferences("glp_widget", Context.MODE_PRIVATE).edit()
                    .putString("active_tasks", Gson().toJson(activeTasks.take(TaskWidgetProvider.MAX_ROWS)))
                    .putString("completed_tasks_widget", Gson().toJson(completedTasksWidget.take(TaskWidgetProvider.MAX_ROWS)))
                    .putInt("day_earned_int", earned.toInt())
                    .putInt("day_spent_int", spent.toInt())
                    .putInt("day_net_int", (earned - spent).toInt())
                    .putInt("day_habits_earned", habitEarned.toInt())
                    .putInt("day_extra_earned", extraEarned.toInt())
                    .putInt("day_tasks_earned", taskEarned.toInt())
                    .putInt("day_penalty_spent", penaltySpent.toInt())
                    .putInt("day_tasks_spent", tasksSpent.toInt())
                    .putInt("habits_completed", doneHabits.size)
                    .putInt("habits_total", activeHabits.size)
                    .putInt("streak", streak)
                    .putInt("meditation_count_today", meditationCountToday)
                    .putString("pending_habits", Gson().toJson(pendingHabits.take(5)))
                    // Counter per le notifiche locali
                    .putInt("notification_habits_pending", pendingHabits.size)
                    .putInt("notification_tasks_today", activeTasks.size)
                    // Cache locale di esercizi/alimenti per i dialog di aggiunta rapida
                    // (AddWorkoutActivity, AddProteinActivity): mostrano subito questa
                    // lista invece di aspettare una lettura di rete ad ogni apertura,
                    // poi la aggiornano in background — vedi loro rispettivi onCreate.
                    .putString("cached_exercises", Gson().toJson(cachedExercises))
                    .putString("cached_foods", Gson().toJson(cachedFoods))
                    .apply()

                // Fetch separata per letture urgenti (sub-collection)
                fetchUrgentReadingsCount()

                val manager = AppWidgetManager.getInstance(this)

                val taskIds = manager.getAppWidgetIds(ComponentName(this, TaskWidgetProvider::class.java))
                taskIds.forEach { TaskWidgetProvider.updateWidget(this, manager, it) }

                val dayIds = manager.getAppWidgetIds(ComponentName(this, DayWidgetProvider::class.java))
                android.util.Log.d("GLPWidget", "Updating ${dayIds.size} day widgets")
                dayIds.forEach { DayWidgetProvider.updateWidget(this, manager, it) }

                val habitsIds = manager.getAppWidgetIds(ComponentName(this, HabitsWidgetProvider::class.java))
                habitsIds.forEach { HabitsWidgetProvider.updateWidget(this, manager, it) }

                val meditationIds = manager.getAppWidgetIds(ComponentName(this, MeditationWidgetProvider::class.java))
                meditationIds.forEach { MeditationWidgetProvider.updateWidget(this, manager, it) }
            }
            .addOnFailureListener {
                android.util.Log.e("GLPWidget", "Firestore error: ${it.message}")
            }
    }
}
