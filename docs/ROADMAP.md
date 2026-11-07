# Bere: idee per le prossime versioni

Ultimo aggiornamento: 7 novembre 2026 (app alla versione 1.7.0).

Legenda: 🟢 piccolo · 🟡 medio · 🔴 grande · 🗄️ tocca il server (database o funzioni) · 📦 serve un nuovo APK

Già fatto, quindi escluso: Newsletter, complimenti agli amici, promemoria a chi non apre l'app, riepilogo
serale, resoconto del lunedì, obiettivo che si adatta (caldo e allenamento), nuove sfide e traguardi,
scorciatoie dall'icona, «Bevuto ✓» dalla notifica.

## 1.7: notifiche più furbe

- [x] 🟢 🗄️ **«Ricordamelo tra 15 minuti»** (fatto in 1.7.0: «Tra 15 min», fino a 3 volte per promemoria): secondo pulsante nelle notifiche, accanto a «Bevuto ✓».
- [x] 🟢 🗄️ **Modalità pausa** (fatto in 1.7.0: 1, 3, 7 o 14 giorni dal Profilo; la classifica settimanale non cambia) (vacanza, malattia): spegne tutte le notifiche per X giorni; la serie non si rompe.
- [ ] 🟡 🗄️ **Orari che imparano**: l'app propone i promemoria negli orari in cui di solito bevi davvero.
- [ ] 🟢 🗄️ **Due quantità nella notifica**: «Bevuto 200 ml» e «Bevuto 500 ml».

## 1.8: motivazione a lungo termine

- [ ] 🟡 **Salva-serie**: un giorno «jolly» a settimana che non rompe la serie.
- [ ] 🟡 🗄️ **Livelli e punti**: si sale di livello bevendo e completando sfide, con un badge accanto al nome in classifica.
- [ ] 🟡 **Statistiche mensili e annuali**, con un calendario colorato giorno per giorno.
- [ ] 🟢 **Condividi la settimana**: un'immagine con il resoconto da mandare su WhatsApp o Instagram.

## 1.9: social

- [ ] 🔴 🗄️ **Gruppi privati** (famiglia, colleghi, amici) con codice invito, ognuno con la sua classifica.
- [ ] 🟡 🗄️ **Sfide 1 contro 1**: «Chi raggiunge più giorni questa settimana?».
- [ ] 🟢 🗄️ **Reazioni** ai traguardi degli amici (👏 💪 🔥), non solo complimenti.

## Qualità e affidabilità (consigliate prima del Play Store)

- [x] 🟢 **Monitoraggio errori** (fatto in 1.6.1, con una tabella su Supabase invece di Sentry) (per esempio Sentry gratuito): sapere subito se l'app si rompe sul telefono di qualcuno.
- [x] 🟡 **Test automatici su telefono simulato** (fatto in 1.6.1: `npm run test:e2e`, bloccano la pubblicazione se falliscono) (Playwright con le misure di un iPhone): avrebbero preso il bug
      della bottiglia sopra «Prossimo promemoria» prima della pubblicazione.
- [ ] 🟢 🗄️ **Avviso se il job delle notifiche si ferma**: un'email se `send-reminders` non gira per 10 minuti.
- [ ] 🟢 📦 **Tema scuro** automatico, che segue il telefono (anche i colori della barra di stato nell'APK).
- [ ] 🟢 **Esporta in CSV** per aprire i dati in Excel.

## Verso il Play Store (2.0)

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

1. Due quantità nella notifica e orari che imparano: chiudono la 1.7.
2. Salva-serie e statistiche mensili: tengono le persone motivate nel tempo.
3. Avviso se il job delle notifiche si ferma: ora che ci sono rimandi e pause, conta ancora di più.

## Come si pubblica una versione

1. Aggiungi la voce in cima a `src/profile/changelog.ts` (versione, data, titolo, note) e porta `version` in
   `package.json` allo stesso numero: un test fallisce se non coincidono.
2. Se cambiano database o funzioni: migrazione in `supabase/migrations/`, applicata in produzione, e funzioni
   ripubblicate.
3. Push su `main`: il sito e l'app installata si aggiornano da soli; al primo avvio compare il popup delle novità.
4. Solo per le voci 📦: alza `appVersionCode` (+1) e `appVersionName` in `android/twa-manifest.json`, lancia
   `gh workflow run android.yml` e installa il nuovo APK sopra il vecchio.
