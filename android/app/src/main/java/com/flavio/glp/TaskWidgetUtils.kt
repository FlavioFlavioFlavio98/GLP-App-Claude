package com.flavio.glp

// Logica di filtro condivisa tra TaskWidgetProvider (refresh manuale),
// WidgetUpdateWorker (sync periodica) e MainActivity.saveWidgetData (all'avvio) —
// prima era triplicata in modo leggermente diverso in ognuno dei tre punti.
object TaskWidgetUtils {

    // Task attive per la data selezionata. Se la data selezionata è oggi, include
    // anche le task scadute (deadline < oggi, mai completate) così non si perdono
    // di vista — su una data futura invece mostra solo quel giorno esatto.
    fun activeTasksForDate(tasks: List<Map<String, Any>>, targetDate: String, today: String): List<Map<String, Any>> {
        return tasks
            .filter { task ->
                val status = task["status"] as? String ?: ""
                val deadline = task["deadline"] as? String ?: ""
                if (status != "active" || deadline.isEmpty()) return@filter false
                if (targetDate == today) deadline <= targetDate else deadline == targetDate
            }
            .sortedBy { it["deadline"] as? String ?: "9999" }
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

    // Colori priorità stile Todoist: bassa=blu, media=arancione, alta=rossa.
    fun priorityColor(priority: String?): Int = when (priority) {
        "high" -> android.graphics.Color.parseColor("#EB5757")
        "low"  -> android.graphics.Color.parseColor("#4A90D9")
        else   -> android.graphics.Color.parseColor("#F2994A") // medium
    }
}
