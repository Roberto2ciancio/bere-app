# Segnalazioni di foto e nomi (diritto d'autore e contenuti inadatti)

Cosa possono caricare gli utenti: la **foto del profilo** (bucket `avatars`, pubblica, visibile in classifica) e lo
**sfondo** (bucket `backgrounds`, privato: lo vede solo chi l'ha caricato). Il **nome** è visibile in classifica.

## Come arrivano

- Dall'app: Classifica › Come funziona › «Segnalalo», oppure Privacy › «segnalalo» → pagina `#/segnala`.
- La segnalazione finisce nella tabella `feedback` con il messaggio che inizia per `[Segnalazione: …]`, insieme
  all'utente che la manda (la sua email è in Authentication › Users).
- Chi non ha un profilo non può usare il modulo: per lui serve un recapito pubblico (vedi «Da fare» sotto).

Per leggerle (SQL editor di Supabase):

```sql
select f.created_at, u.email as da, f.message
from public.feedback f left join auth.users u on u.id = f.user_id
where f.message like '[Segnalazione:%'
order by f.created_at desc;
```

## Cosa controllare

Per il diritto d'autore una segnalazione valida contiene: l'opera originale, il contenuto in Bere (nome in
classifica), un recapito, la dichiarazione di buona fede e quella di esattezza/titolarità. Il modulo le chiede tutte.
Se manca qualcosa, scrivere a chi ha segnalato.

## Rimuovere il contenuto

1. Trovare l'utente: `select id, display_name, avatar_path from public.profiles where display_name ilike '%nome%';`
2. **Foto**: Storage › `avatars` › cartella `<id utente>` › eliminare il file; poi
   `update public.profiles set avatar_path = null where id = '<id utente>';`
3. **Nome**: `update public.profiles set display_name = 'Utente' where id = '<id utente>';`
4. Avvisare chi ha caricato il contenuto (email da Authentication › Users) e, per il diritto d'autore, chi ha segnalato.
   Se l'utente contesta con motivi seri (ad esempio la foto è sua), si può ripristinare.
5. **Recidivi** (più violazioni): cancellare il profilo da Authentication › Users › Delete user, poi eliminare la
   cartella `<id utente>` sia in `avatars` sia in `backgrounds`.

Tenere nota (data, segnalazione, azione) di ogni caso.

## Da fare fuori dal codice

- **Agente DMCA (Stati Uniti)**: per la protezione «safe harbor» serve registrare un agente designato su
  <https://www.copyright.gov/dmca-directory/> (costo 6 $, da rinnovare ogni 3 anni), con nome, indirizzo postale,
  telefono ed email. Poi aggiungere quei recapiti nella pagina Privacy dell'app, così può segnalare anche chi non ha
  un profilo.
- In Italia/UE (DSA) basta un punto di contatto per le segnalazioni: la stessa email pubblica va bene.
