# Bere

PWA che ricorda di bere, segna le bevute con un tocco e mostra una classifica settimanale. Frontend React su GitHub Pages, backend Supabase.

## Sviluppo

```bash
npm install
cp .env.example .env   # poi inserisci i valori del tuo progetto
npm run dev
npm test               # non serve Docker: i test SQL girano su PGlite
```

## App di prova

Si pubblica insieme all'app vera in `/bere-app/dev/`. Usa lo stesso codice, ma `src/dev/devBackend.ts` prende il posto di Supabase: i dati restano sul telefono, non serve un account e nulla arriva al server. Le notifiche sono locali e i promemoria partono solo con l'app aperta, quindi l'invio dal server si prova solo sull'app vera.

## Rilascio

1. Crea un progetto Supabase e collegalo: `npx supabase link --project-ref <ref>`.
2. In Dashboard, Database, Extensions, verifica che `pg_cron` e `pg_net` siano disponibili.
3. Applica le migrazioni: `npx supabase db push`.
4. Genera le chiavi VAPID con lo script `generate-vapid-keys` della libreria `@negrel/webpush` ed esporta la chiave pubblica con `exportApplicationServerKey`.
5. Imposta i segreti delle funzioni:
   ```bash
   npx supabase secrets set VAPID_KEYS_JSON='<json>' VAPID_CONTACT_EMAIL=<email> CRON_SECRET=<stringa casuale>
   ```
6. Salva i segreti per il job, dall'SQL Editor di Supabase (`cron_secret` ha lo stesso valore di `CRON_SECRET`):
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<stringa casuale>', 'cron_secret');
   ```
7. Pubblica le funzioni: `npx supabase functions deploy`.
8. In Authentication, URL Configuration, imposta come Site URL e Redirect URL l'indirizzo GitHub Pages dell'app.
9. Su GitHub attiva Pages con sorgente GitHub Actions e aggiungi i segreti `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`. Il push su `main` pubblica l'app.
10. Controlla sull'iPhone: installa da Safari, attiva le notifiche, invia la prova con l'app chiusa e tieni d'occhio "Stato notifiche" per qualche giorno.

I suggerimenti degli utenti si leggono dalla dashboard Supabase, nella tabella `feedback`.
