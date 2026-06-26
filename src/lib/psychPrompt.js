export function buildPsychSystemPrompt(psychProfile, glpContext) {
  // Support both old flat format and new { globalSummary, dailyEntries } format
  const isNewFormat = psychProfile?.globalSummary || psychProfile?.dailyEntries
  const globalSummary = psychProfile?.globalSummary || null
  const dailyEntries = psychProfile?.dailyEntries || {}

  let profileSection = 'Nessun profilo ancora — questa è la prima sessione.'

  if (isNewFormat) {
    const starredEntries = Object.entries(dailyEntries)
      .filter(([, e]) => e.starred)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, e]) => `[⭐ ${date}] ${e.insights}${e.patterns ? '\nPattern: ' + e.patterns : ''}`)
      .join('\n\n')

    const recentEntries = Object.entries(dailyEntries)
      .filter(([, e]) => !e.starred)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 15)
      .map(([date, e]) => `[${date}] ${e.insights}${e.patterns ? '\nPattern: ' + e.patterns : ''}${e.openQuestions ? '\nDomande aperte: ' + e.openQuestions : ''}`)
      .join('\n\n')

    profileSection = `ENTRY FONDAMENTALI (sempre inclusi):
${starredEntries || 'Nessuno ancora'}

ENTRY RECENTI (ultimi 15 giorni):
${recentEntries || 'Nessuno ancora'}

RIASSUNTO GLOBALE:
${globalSummary?.narrative || 'Non ancora generato'}
Temi ricorrenti: ${(globalSummary?.coreThemes || []).join(', ') || 'N/A'}
Pattern emotivi: ${(globalSummary?.emotionalPatterns || []).join(', ') || 'N/A'}
Punti di forza: ${(globalSummary?.strengths || []).join(', ') || 'N/A'}`
  } else if (psychProfile?.narrative) {
    // Old flat format fallback
    profileSection = `PROFILO PSICOLOGICO (formato precedente):
Narrativa: ${psychProfile.narrative}
Temi ricorrenti: ${(psychProfile.coreThemes || []).join(', ')}
Pattern emotivi: ${(psychProfile.emotionalPatterns || []).join(', ')}
Aree di crescita: ${(psychProfile.growthAreas || []).join(', ')}
Punti di forza: ${(psychProfile.strengths || []).join(', ')}
Insight recenti: ${(psychProfile.recentInsights || []).join(', ')}`
  }

  return `Sei lo psicologo personale di Flavio. Il tuo approccio:
- Schietto e diretto: dici le cose come stanno, senza filtri inutili
- Socratico: fai domande che fanno riflettere, non dai risposte preconfezionate
- Orientato alla crescita: il tuo obiettivo è farlo crescere, non consolarlo
- Onesto: se vedi un pattern autodistruttivo lo nomini chiaramente
- Parli in italiano, tono informale ma professionale
- Adatti la lunghezza: breve per domande semplici, più articolato per temi profondi

NON fare:
- Complimenti vuoti o frasi motivazionali generiche
- Diagnosi cliniche
- Ripetere quello che dice Flavio senza aggiungere valore
- Iniziare ogni risposta con "Capisco..." o "Ottima osservazione..."

${profileSection}

DATI GLP RECENTI:
Punteggio netto ultimi 7 giorni: ${glpContext?.last7DaysNet ?? 'N/A'}
Mood medio recente: ${glpContext?.recentMoodAvg ?? 'N/A'}
Abitudini con win rate basso (<50%): ${glpContext?.lowWinRateHabits?.join(', ') || 'nessuna'}
Streak attuale: ${glpContext?.currentStreak ?? 0} giorni

Usa il profilo e i dati GLP per contestualizzare le risposte quando rilevante, ma segui Flavio su qualsiasi argomento voglia esplorare.`
}
