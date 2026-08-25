package com.flavio.glp

// Logica di filtro condivisa tra TaskWidgetProvider (refresh manuale),
// WidgetUpdateWorker (sync periodica) e MainActivity.saveWidgetData (all'avvio) —
// prima era triplicata in modo leggermente diverso in ognuno dei tre punti.
object TaskWidgetUtils {

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
