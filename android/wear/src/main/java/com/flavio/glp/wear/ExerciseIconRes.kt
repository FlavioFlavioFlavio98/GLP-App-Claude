package com.flavio.glp.wear

import android.content.Context
import java.text.Normalizer

// Porta Kotlin di slugifyExerciseName (src/lib/exerciseIcons.js), ma con
// underscore al posto dei trattini perché i nomi risorsa Android accettano
// solo [a-z0-9_] e devono iniziare con una lettera. Le immagini stesse sono
// le stesse 13 usate su web/telefono, copiate in res/drawable-nodpi (nodpi
// per non farle ricampionare in base alla densità dello schermo — sono già
// piccole, 1-17KB l'una, nessun impatto di performance).
private fun exerciseIconResName(name: String?): String {
    if (name.isNullOrBlank()) return ""
    val noAccents = Normalizer.normalize(name, Normalizer.Form.NFD)
        .replace(Regex("\\p{Mn}+"), "")
    return noAccents.lowercase()
        .replace(Regex("[^a-z0-9]+"), "_")
        .trim('_')
}

// Ritorna l'id della risorsa drawable se esiste un'icona per questo
// esercizio, altrimenti null (fallback all'emoji, stessa logica di
// ExerciseIcon.jsx sul web).
fun resolveExerciseIconRes(context: Context, name: String?): Int? {
    val resName = exerciseIconResName(name)
    if (resName.isEmpty()) return null
    val id = context.resources.getIdentifier(resName, "drawable", context.packageName)
    return if (id != 0) id else null
}
