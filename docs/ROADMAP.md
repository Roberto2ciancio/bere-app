# Bere: idee per le prossime versioni

Ultimo aggiornamento: 14 novembre 2026 (app alla versione 2.1.0).

Legenda: 🟢 piccolo · 🟡 medio · 🔴 grande · 🗄️ tocca il server (database o funzioni) · 📦 serve un nuovo APK

Già fatto, quindi escluso: Newsletter, complimenti agli amici, promemoria a chi non apre l'app, riepilogo
serale, resoconto del lunedì, obiettivo che si adatta (caldo e allenamento), nuove sfide e traguardi,
scorciatoie dall'icona, «Bevuto ✓» dalla notifica.

## 1.7: notifiche più furbe

- [x] 🟢 🗄️ **«Ricordamelo tra 15 minuti»** (fatto in 1.7.0: «Tra 15 min», fino a 3 volte per promemoria): secondo pulsante nelle notifiche, accanto a «Bevuto ✓».
- [x] 🟢 🗄️ **Modalità pausa** (fatto in 1.7.0: 1, 3, 7 o 14 giorni dal Profilo; la classifica settimanale non cambia) (vacanza, malattia): spegne tutte le notifiche per X giorni; la serie non si rompe.
- [x] 🟡 **Orari che imparano** (fatto in 1.7.1: in Promemoria, dalle bevute delle ultime 4 settimane, con un tocco per aggiungere l'orario): l'app propone i promemoria negli orari in cui di solito bevi davvero.
- [x] 🟢 🗄️ **Due quantità nella notifica** (fatto in 1.7.1: da attivare nel Profilo; su Android sostituiscono «Bevuto ✓» e «Tra 15 min», che ci stanno al massimo due pulsanti): «Bevuto 200 ml» e «Bevuto 500 ml».

## 1.8: motivazione a lungo termine

- [x] 🟡 **Salva-serie** (fatto in 1.8.0: automatico, il primo giorno mancato di ogni settimana; non vale nella classifica e nelle sfide «di fila»): un giorno «jolly» a settimana che non rompe la serie.
- [x] 🟡 🗄️ **Livelli e punti** (fatto in 1.8.2: 1 punto ogni 100 ml fino all'obiettivo, +20 a obiettivo, bonus settimanali; livelli da Goccia a Oceano): si sale di livello bevendo e completando sfide, con un badge accanto al nome in classifica.
- [x] 🟡 **Statistiche mensili e annuali** (fatto in 1.8.0: Storico › Calendario, viste Mese e Anno), con un calendario colorato giorno per giorno.
- [x] 🟢 **Condividi la settimana** (fatto in 1.12.0: Storico › «Condividi la settimana», immagine 1080×1350 con i giorni a obiettivo, i litri, la serie e Glu; niente nome né foto): un'immagine con il resoconto da mandare su WhatsApp o Instagram.

## 1.9: nuova grafica e Glu

- [x] 🟡 **1.9.0 · Nuova grafica**: colori vivaci, bottoni e card morbidi, tema scuro automatico, animazioni (numeri e cambi pagina; i coriandoli arrivano con Glu nella 1.9.1) e «riduci movimento» rispettato.
- [x] 🟡 **1.9.1 · Arriva Glu**: nuova schermata Oggi con Glu al centro nell'anello del progresso, Glu che si riempie e cambia espressione, azioni a portata di pollice e festa che sale dal basso quando raggiungi l'obiettivo.
- [x] 🟡 **1.9.2 · Un primo avvio con Glu**: primo avvio guidato da Glu in sette passi (avatar, obiettivo che per chi si è appena registrato vale da subito, bicchiere, orari, notifiche, primo sorso) e 12 avatar pronti, anche in Profilo › Aspetto.
- [x] 🟡 **1.9.3 · Glu nelle pagine vuote**: festa con coriandoli quando sali di livello, Glu nelle pagine vuote (Storico, Classifica, Promemoria) e nel popup delle novità.
- [x] 🟢 **1.9.3 · Rifiniture**: ultimi ritocchi, peso del pacchetto sotto i 60 KB gzip aggiunti.
- [x] 🟢 **1.9.4 · Correzioni**: saltare l'obiettivo nel primo avvio non cambia più quello di chi usa già l'app, chi cambia telefono non rifà il primo avvio da capo, scegliendo un avatar pronto la foto caricata prima viene cancellata, e Glu ti accompagna sempre in cima a Storico, Classifica e Profilo.
- [x] 🟡 **1.9.5 · Glu reagisce**: solo Glu nella Home, sete crescente (da 2 a 4 ore senza bere), caffè (20 minuti dopo), allenamento con la fascia, serie di giorni (corona a 7, 14 e 30 giorni), notte (fuori dall'orario dei promemoria), acqua che segue il telefono inclinato e «Glu tranquillo» in Profilo › Aspetto.

## 2.0: social

- [x] 🔴 🗄️ **Gruppi privati** (fatto in 2.0.0, insieme ai codici amico; la classifica generale è stata tolta) (famiglia, colleghi, amici) con codice invito, ognuno con la sua classifica.
- [x] 🟡 🗄️ **Sfide 1 contro 1** (fatto in 2.1.0): «Chi raggiunge più giorni questa settimana?».
- [x] 🟢 🗄️ **Reazioni** (fatto in 1.13.0) ai traguardi degli amici (👏 💪 🔥), non solo complimenti.

## Qualità e affidabilità (consigliate prima del Play Store)

- [x] 🟢 **Monitoraggio errori** (fatto in 1.6.1, con una tabella su Supabase invece di Sentry) (per esempio Sentry gratuito): sapere subito se l'app si rompe sul telefono di qualcuno.
- [x] 🟡 **Test automatici su telefono simulato** (fatto in 1.6.1: `npm run test:e2e`, bloccano la pubblicazione se falliscono) (Playwright con le misure di un iPhone): avrebbero preso il bug
      della bottiglia sopra «Prossimo promemoria» prima della pubblicazione.
- [x] 🟢 🗄️ **Avviso se il job delle notifiche si ferma** (fatto: workflow «Controllo notifiche» ogni 10 minuti, apre e chiude da solo una issue su GitHub, che manda l'email): un'email se `send-reminders` non gira per 10 minuti.
- [x] 🟢 📦 **Tema scuro** automatico, che segue il telefono (fatto in 1.9.0 nell'app; barra di stato e di navigazione scure nell'APK dalla versione 1.12.0, codice 3).
- [x] 🟢 **Esporta in CSV** (c'era già: Profilo › Account e privacy › «Copia e ripristino dei dati» › «Scarica bevute (CSV)») per aprire i dati in Excel.

## Più avanti: Glu in 3D

- [ ] 🟡 **Più Glu tra cui scegliere**: altri personaggi oltre a Glu, da scegliere in Profilo › Aspetto.
- [ ] 🔴 **Glu 3D**: Glu 3D animato come nei video della proposta: saluta, salta quando bevi, si sposta tra le schermate e va a mettersi in basso sopra la barra, cammina, dà un consiglio quando lo tocchi; sostituisce il Glu 2D della Home e i Glu piccoli di Storico, Classifica e Profilo.

## Verso il Play Store (2.1)

- [ ] 📦 🗄️ **Dominio proprio**: `assetlinks.json` sul nuovo dominio, Redirect URL in Supabase, `host` e `startUrl`
      in `android/twa-manifest.json`. Gli utenti dovranno rifare l'accesso e riattivare le notifiche.
- [ ] Scheda dello store (screenshot, descrizione, icona) e modulo «Sicurezza dei dati».
- [ ] Test chiuso con almeno 12 tester per 14 giorni (obbligatorio per gli account sviluppatore nuovi).
- [ ] 🟢 App anche in **inglese**.

## Più avanti, solo con app nativa (Capacitor) 🔴 📦

Richiede di passare da TWA a Capacitor e rifare le notifiche con Firebase Cloud Messaging.

- [ ] **Widget** nella schermata home, con progresso e pulsante «+250».
- [ ] **Health Connect**: acqua sincronizzata con Google Fit e Samsung Health.
- [ ] **Notifiche locali** che funzionano anche senza internet.
- [ ] **Wear OS**: segnare una bevuta dall'orologio.

## Da dove partire

1. 🟡 Notifica a chi viene sfidato (oggi la sfida si vede aprendo la Classifica).
2. Per il Play Store servono scheda, tester e dominio: decisioni tue.

## Come si pubblica una versione

1. Aggiungi la voce in cima a `src/profile/changelog.ts` (versione, data, titolo, note) e porta `version` in
   `package.json` allo stesso numero: un test fallisce se non coincidono.
2. Se cambiano database o funzioni: migrazione in `supabase/migrations/`, applicata in produzione, e funzioni
   ripubblicate.
3. Push su `main`: il sito e l'app installata si aggiornano da soli; al primo avvio compare il popup delle novità.
4. Solo per le voci 📦: alza `appVersionCode` (+1) e `appVersionName` in `android/twa-manifest.json`, lancia
   `gh workflow run android.yml` e installa il nuovo APK sopra il vecchio.
