// 60 domande giornaliere, ruotano ciclicamente senza ripetersi per 2 mesi

export const JOURNAL_QUESTIONS = [
  // Riflessione
  { id: 'r01', cat: 'riflessione', text: 'Cosa hai imparato oggi?' },
  { id: 'r02', cat: 'riflessione', text: 'Qual è stata la parte migliore della tua giornata?' },
  { id: 'r03', cat: 'riflessione', text: 'C\'è qualcosa che rifaresti diversamente oggi?' },
  { id: 'r04', cat: 'riflessione', text: 'Di cosa sei più orgoglioso oggi?' },
  { id: 'r05', cat: 'riflessione', text: 'Qual è stato il momento più significativo della giornata?' },
  { id: 'r06', cat: 'riflessione', text: 'Cosa ti ha sorpreso oggi?' },
  { id: 'r07', cat: 'riflessione', text: 'C\'è stata una sfida che hai affrontato oggi? Come è andata?' },
  { id: 'r08', cat: 'riflessione', text: 'Hai preso una decisione importante oggi? Sei soddisfatto?' },
  { id: 'r09', cat: 'riflessione', text: 'Cosa vorresti ricordare di questa giornata tra un anno?' },
  { id: 'r10', cat: 'riflessione', text: 'Come hai gestito le difficoltà di oggi?' },
  { id: 'r11', cat: 'riflessione', text: 'Qual è la cosa più interessante che hai pensato oggi?' },
  { id: 'r12', cat: 'riflessione', text: 'Hai fatto qualcosa oggi che ti ha fatto sentire fiero/a?' },

  // Gratitudine
  { id: 'g01', cat: 'gratitudine', text: 'Per cosa sei grato/a oggi?' },
  { id: 'g02', cat: 'gratitudine', text: 'Chi ti ha aiutato o supportato oggi?' },
  { id: 'g03', cat: 'gratitudine', text: 'Cosa di bello hai notato intorno a te oggi?' },
  { id: 'g04', cat: 'gratitudine', text: 'Qual è una piccola gioia che hai vissuto oggi?' },
  { id: 'g05', cat: 'gratitudine', text: 'C\'è qualcosa che di solito dai per scontato ma oggi hai apprezzato?' },
  { id: 'g06', cat: 'gratitudine', text: 'Hai ricevuto un gesto gentile oggi? Da chi?' },
  { id: 'g07', cat: 'gratitudine', text: 'Cosa ti ha fatto sorridere oggi?' },
  { id: 'g08', cat: 'gratitudine', text: 'Di quale risorsa (tempo, salute, relazioni) sei grato/a oggi?' },
  { id: 'g09', cat: 'gratitudine', text: 'C\'è qualcosa nella tua vita quotidiana che ti rende la vita più facile?' },
  { id: 'g10', cat: 'gratitudine', text: 'Qual è un\'opportunità che hai avuto oggi per cui sei riconoscente?' },
  { id: 'g11', cat: 'gratitudine', text: 'Chi nella tua vita ti ha insegnato qualcosa di prezioso?' },
  { id: 'g12', cat: 'gratitudine', text: 'Cosa nel tuo corpo funziona bene e per cui sei grato/a?' },

  // Crescita
  { id: 'c01', cat: 'crescita', text: 'Come ti sei avvicinato/a ai tuoi obiettivi oggi?' },
  { id: 'c02', cat: 'crescita', text: 'Cosa ti ha messo alla prova oggi? Cosa ne hai imparato?' },
  { id: 'c03', cat: 'crescita', text: 'Quale abitudine è stata più difficile oggi e perché?' },
  { id: 'c04', cat: 'crescita', text: 'C\'è un\'abitudine che stai cercando di costruire? Come sta andando?' },
  { id: 'c05', cat: 'crescita', text: 'Hai letto, ascoltato o visto qualcosa di ispirazionale oggi?' },
  { id: 'c06', cat: 'crescita', text: 'Qual è una competenza che vorresti sviluppare? Cosa hai fatto oggi per avvicinarti?' },
  { id: 'c07', cat: 'crescita', text: 'C\'è qualcosa in cui hai fatto progressi ultimamente?' },
  { id: 'c08', cat: 'crescita', text: 'Hai uscito dalla tua zona di comfort oggi? Come?' },
  { id: 'c09', cat: 'crescita', text: 'Qual è un errore che hai fatto di recente e cosa ti ha insegnato?' },
  { id: 'c10', cat: 'crescita', text: 'Se potessi dare un consiglio al te stesso/a di un anno fa, quale sarebbe?' },
  { id: 'c11', cat: 'crescita', text: 'Qual è una credenza limitante che stai cercando di superare?' },
  { id: 'c12', cat: 'crescita', text: 'Come stai crescendo come persona rispetto a un mese fa?' },

  // Benessere
  { id: 'b01', cat: 'benessere', text: 'Come ti sei sentito/a fisicamente oggi?' },
  { id: 'b02', cat: 'benessere', text: 'Hai dedicato del tempo a te stesso/a oggi? Come?' },
  { id: 'b03', cat: 'benessere', text: 'Cosa ti ha dato energia oggi?' },
  { id: 'b04', cat: 'benessere', text: 'Come hai dormito? Cosa influenza la qualità del tuo sonno?' },
  { id: 'b05', cat: 'benessere', text: 'Hai mangiato in modo che ti ha fatto sentire bene oggi?' },
  { id: 'b06', cat: 'benessere', text: 'Qual è il tuo livello di stress in questo momento? Cosa lo causa?' },
  { id: 'b07', cat: 'benessere', text: 'Hai passato del tempo all\'aperto oggi? Come ti ha fatto sentire?' },
  { id: 'b08', cat: 'benessere', text: 'C\'è qualcosa che ti drena energia? Cosa potresti fare per limitarlo?' },
  { id: 'b09', cat: 'benessere', text: 'Come si è comportata la tua mente oggi — concentrata, dispersa, ansiosa?' },
  { id: 'b10', cat: 'benessere', text: 'Hai fatto qualcosa di creativo o di giocoso oggi?' },
  { id: 'b11', cat: 'benessere', text: 'Quali emozioni hai vissuto oggi? Quale ti ha colpito di più?' },
  { id: 'b12', cat: 'benessere', text: 'Ti sei concesso/a un momento di pausa oggi? Come ti ha fatto sentire?' },

  // Intenzione
  { id: 'i01', cat: 'intenzione', text: 'Cosa vuoi fare meglio domani?' },
  { id: 'i02', cat: 'intenzione', text: 'C\'è qualcosa che hai rimandato e devi affrontare presto?' },
  { id: 'i03', cat: 'intenzione', text: 'Qual è la tua priorità principale per domani?' },
  { id: 'i04', cat: 'intenzione', text: 'C\'è una conversazione che devi avere? Cosa ti trattiene?' },
  { id: 'i05', cat: 'intenzione', text: 'Cosa vorresti portare nella tua vita nei prossimi 30 giorni?' },
  { id: 'i06', cat: 'intenzione', text: 'Se domani fosse il tuo ultimo giorno libero, come lo passeresti?' },
  { id: 'i07', cat: 'intenzione', text: 'C\'è qualcosa che stai evitando? Perché?' },
  { id: 'i08', cat: 'intenzione', text: 'Cosa ti renderebbe orgoglioso/a di te stesso/a tra un mese?' },
  { id: 'i09', cat: 'intenzione', text: 'Qual è il primo passo che puoi fare domani verso un tuo obiettivo?' },
  { id: 'i10', cat: 'intenzione', text: 'A cosa vuoi dire "sì" nella tua vita? A cosa vuoi dire "no"?' },
  { id: 'i11', cat: 'intenzione', text: 'Come puoi rendere domani migliore di oggi?' },
  { id: 'i12', cat: 'intenzione', text: 'Cosa pensi potrà diventare facile se continui a praticare le tue abitudini?' },
]

// Get question for a specific date (cycles every 60 days, no repeats)
export function getQuestionForDate(dateStr) {
  // Offset from a fixed epoch to create a stable index
  const epoch = new Date('2024-01-01')
  const d = new Date(dateStr)
  const dayIdx = Math.floor((d - epoch) / 86400000)
  const idx = ((dayIdx % JOURNAL_QUESTIONS.length) + JOURNAL_QUESTIONS.length) % JOURNAL_QUESTIONS.length
  return JOURNAL_QUESTIONS[idx]
}

export const CAT_LABELS = {
  riflessione: '🔍 Riflessione',
  gratitudine: '🙏 Gratitudine',
  crescita: '🌱 Crescita',
  benessere: '💚 Benessere',
  intenzione: '🎯 Intenzione',
}
