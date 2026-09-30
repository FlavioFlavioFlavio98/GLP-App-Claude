# GLP App — Note per Claude

App di gamification personale (abitudini, task, workout, letture) ad uso esclusivo di Flavio.

## Stack tecnico

- **Web**: React + Vite, deploy statico su GitHub Pages (`npm run deploy` → branch `gh-pages`, base path `/GLP-App-Claude/`)
- **Android**: Capacitor 8.4.1, APK nativo per Pixel 8 (package `com.flavio.glp`)
- **Backend**: Firebase — Firestore (dati), Auth (Google, whitelist singolo utente), Storage (PDF letture), Cloud Functions (`functions/index.js`, region `europe-west1`)
- **Build**: `npm run build` (Android/locale, base `/`) · `npm run build:web` (GitHub Pages, base `/GLP-App-Claude/`) · entrambi eseguono automaticamente `scripts/stamp-sw.js` dopo la build (vedi sezione Service Worker)

## Struttura app (5 tab)

1. **Oggi** — task del giorno + sezione abitudini
2. **Abitudini** — obiettivi, ricerca, lista abitudini, negozio premi
3. **Task** — lista task attive/completate/scadute
4. **Workout & Peso** — heatmap muscolare, allenamento rapido, tracciamento peso, statistiche esercizi
5. **Statistiche** — grafici e analisi storiche

**Header condiviso**: avatar + punteggio totale, icona 💡 Insight, icona ⚙️ Impostazioni. Tutto il resto (Coach AI, Psicologo AI, Letture, tema chiaro/scuro, Dashboard Settimanale) è stato spostato **dentro Impostazioni** per tenere l'header minimale — non rimetterlo in homepage senza richiesta esplicita.

**Sezioni raggiungibili da Impostazioni**: Coach AI, Psicologo AI, Letture, Dashboard Settimanale, Diario, Storico Modifiche, Notifiche Android (AlarmManager locale), Backup/Export JSON+CSV, e in fondo la **Zona Pericolosa** (Reset completo dati, flusso di conferma a 2 step).

## ⚠️ Flusso obbligatorio dopo modifiche React/JS

Qualsiasi modifica a file `.jsx`/`.js` in `src/` **richiede sempre**:
```bash
npm run build
npx cap sync android
```
prima che l'utente possa testare su Android con Clean+Run in Android Studio — altrimenti l'APK mostra codice vecchio (il bundle web viene copiato in `android/app/src/main/assets/public` solo da `cap sync`).

Per modifiche **solo Kotlin** (`android/app/src/main/java/com/flavio/glp/*.kt`), basta Clean+Run direttamente in Android Studio, senza build/sync.

Dopo build+sync web, **esegui sempre anche `npm run deploy`** senza chiederlo — l'utente vuole vedere le modifiche live su GitHub Pages ad ogni sessione di lavoro (preferenza confermata più volte). Se una sessione tocca `functions/index.js`, quello richiede un deploy **separato** (`firebase deploy --only functions`) — chiedere conferma prima di eseguirlo, non è coperto dall'istruzione automatica di deploy.

## Utenti e abitudini condivise (Flavio + Simona)

L'app è di **Flavio** (`flavio.rossi94@gmail.com`, accesso totale). Su richiesta esplicita di Flavio (settembre 2026) la fidanzata **Simona** (`simonaballini2000@gmail.com`) ha accesso **solo alla sezione Abitudini + Negozio Premi**, condivisi: ognuno vede quelle dell'altro, può completarle/fallirle per l'altro, e può vedere/comprare i premi dell'altro. Nient'altro va mai esposto a Simona (task, diario, psicologo, workout, impostazioni avanzate). Non aggiungere altri utenti né altre sezioni condivise senza richiesta esplicita. Il sistema achievement (popup/confetti al completamento) è stato rimosso su richiesta esplicita ("buggava" durante il completamento rapido di più abitudini): resta solo lo sblocco silenzioso salvato su `achievements` per la pagina Impostazioni → Trofei, nessun popup.

Architettura (perché `users/flavio` è un documento monolitico con tutto, Simona NON può leggerlo):
- `users/simona`: suo documento (abitudini + premi), lettura/scrittura sua e di Flavio.
- `sharedHabits/flavio`: copia in **sola lettura** delle sole abitudini + Negozio Premi di Flavio, scritta dalla Cloud Function `mirrorSharedHabits` (trigger su `users/flavio`). Esclude note vocali (`voiceNotes`/`notes`), `why`, obiettivi, note per giorno e ogni altro campo dei log oltre a habits/failedHabits/habitLevels/habitValues/purchases (ultimi 365 giorni). La logica pura è in `functions/sharedHabits.js`.
- Completare l'abitudine dell'altro passa SEMPRE dalla callable `setPartnerHabitStatus` (Admin SDK, transazione, stessa logica di `setHabitStatus`), comprare un premio dell'altro dalla callable `buyPartnerReward` (stesso schema, costo sempre letto dal documento del proprietario, mai fidarsi del client), inserire il valore di un'abitudine numerica dell'altro dalla callable `setPartnerNumericValue` (stesso schema): Simona non ha alcuna scrittura diretta su `users/flavio`. **Dal 30/9/2026 anche le abitudini numeriche sono completabili dall'altro** (richiesta esplicita: a fine giornata completano spesso le abitudini di entrambi da un solo telefono) — resta escluso solo il tipo `goal` (obiettivi, percorso separato non gestito da queste callable). Date ≤ oggi e max 30 giorni indietro. Copia client per l'aggiornamento ottimistico (tap/acquisto/valore visibile subito, senza aspettare il giro di rete — stesso meccanismo usato anche per le proprie abitudini in `setHabitStatus`, per evitare la spunta che "torna indietro" con tap rapidi consecutivi): `src/lib/partnerHabits.js` (deve restare identica alla copia server — la verifica `node src/lib/partnerHabits.test.mjs`).
- `firestore.rules`: `isFlavio()` (rossi94 + rossi95 watch/estensione), `isSimona()` (email + `email_verified`). Storage rules e Cloud Functions AI restano solo di Flavio.
- Client: `store.jsx` (Flavio ascolta `users/flavio`+`users/simona`; Simona `users/simona`+`sharedHabits/flavio`), `PartnerBar`/`CoupleStatsPanel` (statistiche in `lib/coupleStats.js`, pulsanti "Flavio"/"Simona" — non "Le mie"/"Di Simona"), Simona vede solo la tab Abitudini (`App.jsx`). Ogni funzionalità nuova per Flavio va gated con `authUserId === 'flavio'`; ogni azione di sola visualizzazione/modifica del PROFILO dell'abitudine (modifica config, insights) resta gated con `isReadOnly` — il completamento (booleane/multi/numeriche) NON lo è più, è simmetrico tra i due.
- Test: `node --test functions/sharedHabits.test.js`, `node src/lib/coupleStats.test.mjs`, `node src/lib/partnerHabits.test.mjs`, `node src/lib/habitLogic.test.mjs`. Contro emulatori (richiede JDK 21, l'emulatore Functions ha dato timeout di discovery in questo ambiente indipendentemente dalla versione Node — non un problema del codice, verificato caricando `functions/index.js` a mano): `firebase emulators:start --only auth,firestore --project demo-glp`, poi `node scripts/test-shared-habits-rules.mjs` (regole per ogni account) e `node scripts/test-shared-habits-logic.mjs` (stessa logica delle Cloud Function contro Firestore reale via Admin SDK, bypassando il livello HTTP).
- Deploy: regole e functions NON partono da `git push`: `firebase deploy --only firestore:rules` e `firebase deploy --only functions:setPartnerHabitStatus,functions:mirrorSharedHabits,functions:buyPartnerReward,functions:setPartnerNumericValue` (chiedere conferma a Flavio prima).

## Indicatore versione

In homepage (tab Oggi, sotto il riepilogo Guadagni/Costi/Netto) c'è un indicatore automatico "🌐 web {data}" / "📱 apk {data}", generato dinamicamente ad ogni build (`__BUILD_TIME__` iniettato da `vite.config.js`, `BuildConfig.BUILD_TIME` lato Android). **Primo check diagnostico utile**: se l'utente dice che l'app "sembra non aggiornata", guardare qui prima di ogni altra ipotesi.

## Decisioni architetturali importanti

- **Punteggio (score) vs Coin abitudini (habitCoins)**: DUE totali separati, calcolati **sempre dinamicamente**, mai salvati staticamente, iniettati entrambi nel reducer di `store.jsx` (`SET_USER_DATA`/`PATCH_USER_DATA`) ad ogni aggiornamento dati Firestore. Richiesta esplicita di Flavio (29/9/2026): non mischiare mai le due cose.
  - `calculateTotalScore()` / `computeDayNet().net` (`src/lib/habitLogic.js`): punteggio GENERALE dell'app — task, allenamento/extra log, check-in, letture. **Non include più abitudini né acquisti al Negozio Premi.**
  - `calculateTotalHabitCoins()` / `computeDayNet().habitCoinsNet`: coin abitudini — guadagni/penalità delle sole abitudini (incluso bonus completamento obiettivi) meno TUTTI gli acquisti al Negozio Premi (normali e tracciati a soglia). È quello che si spende nel negozio (`buyReward`/`buyPartnerReward` controllano `globalData.habitCoins`, non `.score`) ed è l'unico numero confrontato tra Flavio e Simona (badge in `PartnerBar.jsx`, mostrato anche nel mirror `sharedHabits/flavio` — `SHARED_LOG_FIELDS` in `functions/sharedHabits.js` include `trackedRewards` apposta per questo calcolo).
  - Non esiste più un campo `score`/`habitCoins` scritto/incrementato manualmente da nessuna parte (client o Cloud Function) — qualsiasi nuova fonte di punti deve passare per `computeDayNet`, decidendo esplicitamente se è punteggio generale o coin abitudini, mai un contatore separato. Test: `node src/lib/habitLogic.test.mjs`.
- **Service Worker** (`public/sw.js`): precache reale dell'app shell (index.html + JS/CSS con hash) generato dinamicamente da `scripts/stamp-sw.js` dopo ogni build — non editare a mano i placeholder `BUILD_TS`/`PRECACHE_ASSETS`, sono sostituiti automaticamente. Cache-first per asset hashati e per i font esterni (Google Fonts, Tabler Icons via jsDelivr), network-only per la navigazione HTML, mai cache per Firestore/Google APIs.
- **Code splitting**: le 5 tab e i ~37 modali sono caricati con `React.lazy()`, i modali raggruppati in 6 bundle logici per contesto d'uso (`src/modalGroups/`) per non generare troppe richieste piccole. Se aggiungi un nuovo modal, valuta se appartiene a un gruppo esistente prima di crearne uno nuovo.
- **Widget Android** (riepilogo, task, abitudini): Kotlin nativo, **separato dal bundle React** — leggono da `SharedPreferences` con aggiornamento ottimistico locale prima della sync Firestore, per restare reattivi anche offline.
- **Notifiche locali Android**: `AlarmManager` nativo (`NotificationScheduler.kt`), **non FCM/push** — programmate lato client, non richiedono un server sempre attivo.
- **Documento Firestore**: `users/flavio` è un documento monolitico che contiene quasi tutto (habits, tasks, dailyLogs, tags, ecc.) scaricato per intero ad ogni apertura via `onSnapshot`. È una scelta consapevole non ancora rifattorizzata in sotto-collezioni — prima di proporre uno split, verificare se l'utente lo vuole esplicitamente (rischio/complessità valutati e rimandati in precedenza).
- **Reset account**: `actions.resetAllUserData()` in `store.jsx` cancella tutto (Firestore + Storage PDF + localStorage) e ricrea un documento vuoto — non tocca l'account di autenticazione. Flusso UI a 2 step con parola di conferma, in Impostazioni → Zona Pericolosa.

## Workflow di lavoro con l'utente

- **Non è un programmatore**: dare sempre codice completo pronto da incollare/applicare direttamente (io — Claude — applico le modifiche via Edit/Write, non gli chiedo di incollare snippet), mai frammenti parziali da integrare a mano.
- Spiegare **il perché** di ogni fix in italiano semplice, non solo il cosa.
- Per implementazioni ampie o rischiose (cancellazioni dati, refactoring strutturali, cambi di architettura come lo score) — **mostrare il piano e aspettare conferma prima di scrivere codice**.
- Prima di modifiche a componenti che ho già toccato, verificare lo stato reale del file (spesso ci sono modifiche non ancora committate in git — vedi sotto).

## Nota importante su Git

**La cronologia commit locale è inaffidabile/incompleta**: la maggior parte del lavoro recente viene deployato direttamente via `npm run deploy` (push diretto al branch `gh-pages`) **senza mai passare da un commit su `main`**. Non fidarti di `git log` per capire cosa è stato fatto di recente — controlla sempre anche `git status` (probabile lavoro non committato) e, se serve confrontare col sito live, `git fetch origin gh-pages && git log origin/gh-pages -1`.

## Pattern ricorrenti da riusare

- **Modali**: ogni modal in `src/modals/` si auto-gestisce leggendo `state.modal` dallo store (`if (modal !== 'xyz') return null`) — apertura via `actions.openModal('xyz', payload?)`, chiusura via `actions.closeModal()`.
- **Navigazione tra modali**: pattern `openAfter(name)` (chiude il modal corrente, apre il successivo dopo un breve `setTimeout`) usato per i link dentro Impostazioni.
- **localStorage**: tutte le chiavi hanno prefisso `glp_` — utile per pulizie complete (vedi `resetAllUserData`) o per debug.
- **Componenti/funzioni ordinate ma non utilizzate**: il codebase ha accumulato qualche componente orfano nel tempo (es. `ChangePinModal.jsx`, `MissionsCard.jsx`, sistema "missioni" in `store.jsx` mai collegato alla UI) — non è un bug, sono feature abbandonate/mai completate. Non presumere che siano attive; verificare sempre con una ricerca di utilizzo prima di modificarle o di fare affidamento su di esse.
