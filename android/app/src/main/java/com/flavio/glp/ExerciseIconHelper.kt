package com.flavio.glp

import android.content.Context
import java.text.Normalizer

// Stessa logica di slug della web app (vedi src/lib/exerciseIcons.js) — le
// icone vanno messe come drawable in res/drawable-nodpi/ex_{slug_con_underscore}.png
// (i nomi risorsa Android non ammettono trattini, solo lettere minuscole/underscore).
// getIconResId ritorna 0 se l'icona non esiste ancora: i chiamanti devono
// ricadere sull'emoji testuale in quel caso, esattamente come fa ExerciseIcon.jsx.
object ExerciseIconHelper {

    fun slugify(name: String?): String {
        if (name.isNullOrBlank()) return ""
        val normalized = Normalizer.normalize(name, Normalizer.Form.NFD)
            .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
        return normalized
            .lowercase()
            .replace(Regex("[^a-z0-9]+"), "_")
            .trim('_')
    }

    fun getIconResId(context: Context, exerciseName: String?): Int {
        val slug = slugify(exerciseName)
        if (slug.isEmpty()) return 0
        return context.resources.getIdentifier("ex_$slug", "drawable", context.packageName)
    }
}
