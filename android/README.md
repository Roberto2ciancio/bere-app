# App Android (Trusted Web Activity)

L'APK apre il sito pubblicato a schermo intero dentro Chrome: stesso codice,
stesse notifiche push. Si aggiorna da solo a ogni push su `main`; l'APK va
rifatto solo se cambiano nome, icona, colori o versione in `twa-manifest.json`.

## Generare l'APK
GitHub → Actions → **APK Android** → Run workflow. A fine corsa scarica
l'artefatto `bere-apk`: dentro ci sono `app-release-signed.apk` (da installare)
e `app-release-bundle.aab` (per il Play Store).

Da terminale: `gh workflow run android.yml` e poi `gh run download -n bere-apk`.

## Firma
La chiave non è nel repo: sta nei secret `ANDROID_KEYSTORE_BASE64` e
`ANDROID_KEYSTORE_PASSWORD`. L'impronta SHA-256 della chiave deve comparire in
`https://roberto2ciancio.github.io/.well-known/assetlinks.json`, altrimenti
l'app mostra la barra dell'indirizzo di Chrome.

## Nuova versione
Aumenta `appVersionCode` (+1) e `appVersionName` in `twa-manifest.json`.
