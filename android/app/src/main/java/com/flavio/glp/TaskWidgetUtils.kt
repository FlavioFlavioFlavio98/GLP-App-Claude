package com.flavio.glp

// Logica di filtro condivisa tra TaskWidgetProvider (refresh manuale),
// WidgetUpdateWorker (sync periodica) e MainActivity.saveWidgetData (all'avvio) —
// prima era triplicata in modo leggermente diverso in ognuno dei tre punti.
object TaskWidgetUtils {

    private const val AUTO_RESET_AFTER_MS = 60 * 60 * 1000L // 1 ora

    // Se la data selezionata nel widget lista task non è "oggi" da più di
    // un'ora, la riporta automaticamente a oggi — sia perché l'utente ha
    // lasciato aperta una data diversa per sbaglio (dimenticandosi di
    // riportarla indietro), sia perché nel frattempo è scoccata la
    // mezzanotte e "oggi" stesso è cambiato. Senza questo il widget può
    // restare bloccato a mostrare (o peggio, sembrare vuoto per) un altro
    // giorno a tempo indeterminato — bug reale segnalato da Flavio ("penso
    // di non avere task in scadenza invece è vuoto perché è impostata la
    // data di un'altra giornata"). Scrive subito il ripristino in prefs così
    // ogni chiamante (refresh manuale, worker periodico) lo vede coerente.
    fun resolveSelectedDate(prefs: android.content.SharedPreferences, today: String): String {
        val selectedDate = prefs.getString("selected_date", null) ?: today
        if (selectedDate == today) return today
        val setAt = prefs.getLong("selected_date_set_at", 0L)
        if (System.currentTimeMillis() - setAt > AUTO_RESET_AFTER_MS) {
            // Invalida anche la cache task/completate insieme alla data:
            // trovato con un test reale che, senza questo, TaskWidgetProvider
            // .onUpdate() (il refresh periodico OS, che chiama updateWidget()
            // direttamente senza rifare il fetch da Firestore) rendeva subito
            // l'etichetta "Oggi" corretta ma con la lista task ANCORA quella
            // vecchia — cioè esattamente lo stato ingannevole che questa
            // funzione doveva evitare, solo spostato dall'etichetta al
            // contenuto. Rimuovendo la cache, nel peggiore dei casi il widget
            // mostra "nessuna task" (onesto, invece di dati sbagliati sotto
            // un'etichetta corretta) finché il prossimo fetch reale (refresh
            // manuale, o il worker periodico entro 15 min) non la ripopola.
            prefs.edit()
                .putString("selected_date", today)
                .remove("selected_date_set_at")
                .remove("active_tasks")
                .remove("completed_tasks_widget")
                .apply()
            return today
        }
        return selectedDate
    }

    private fun priorityRank(priority: String?): Int = when (priority) {
        "high" -> 0
        "low"  -> 2
        else   -> 1 // medium
    }

    // Task attive per la data selezionata. Se la data selezionata è oggi, include
    // anche le task scadute (deadline < oggi, mai completate) così non si perdono
    // di vista — su una data futura invece mostra solo quel giorno esatto.
    // Ordinate per priorità (alta in cima, bassa in fondo) — non serve mostrare
    // un indicatore vistoso della priorità se l'ordine la comunica già da solo.
    fun activeTasksForDate(tasks: List<Map<String, Any>>, targetDate: String, today: String): List<Map<String, Any>> {
        val active = tasks
            .filter { task ->
                val status = task["status"] as? String ?: ""
                val deadline = task["deadline"] as? String ?: ""
                if (status != "active" || deadline.isEmpty()) return@filter false
                if (targetDate == today) deadline <= targetDate else deadline == targetDate
            }
            .sortedWith(compareBy(
                { priorityRank(it["priority"] as? String) },
                { it["deadline"] as? String ?: "9999" }
            ))

        if (targetDate != today) return active

        // Task scadute (penalità già applicata a mezzanotte da expireTasks) ma
        // mai completate — vanno mostrate comunque, altrimenti spariscono dal
        // widget senza che l'utente se ne accorga (stesso motivo per cui la
        // web app ha sempre visibile la sezione "SCADUTE"). In cima, sono le
        // più urgenti.
        val expired = tasks
            .filter { (it["status"] as? String) == "expired" }
            .sortedByDescending { it["expiredAt"] as? String ?: "" }

        return expired + active
    }

    // Task completate quel giorno — mostrate sotto le attive, sbarrate.
    fun completedTasksForDate(tasks: List<Map<String, Any>>, targetDate: String): List<Map<String, Any>> {
        return tasks
            .filter { task ->
                val status = task["status"] as? String ?: ""
                val completedAt = task["completedAt"] as? String ?: ""
                status == "completed" && completedAt.startsWith(targetDate)
            }
            .sortedByDescending { it["completedAt"] as? String ?: "" }
    }
}
