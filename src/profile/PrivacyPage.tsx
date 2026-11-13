import { Link } from 'react-router-dom'
import { DeleteAccount } from './DeleteAccount'

export function PrivacyPage() {
  return (
    <main className="page">
      <div className="row">
        <h1>Privacy</h1>
        <Link to="/account">Account</Link>
      </div>

      <section className="section">
        <h2>Cosa salviamo</h2>
        <p>Email e password per l'accesso, nome, foto e sfondo che scegli, obiettivi, orari dei promemoria, bevute e caffeina segnate, tazze e bevande personalizzate, peso e attività se usi il calcolo dell'obiettivo, la città se attivi i giorni caldi, allenamenti segnati, suggerimenti inviati, i dati tecnici necessari per recapitare le notifiche al tuo telefono e, se l'app va in errore, una segnalazione tecnica (messaggio d'errore, pagina, versione e tipo di browser) conservata per 30 giorni.</p>
      </section>

      <section className="section">
        <h2>Chi lo vede</h2>
        <p>Nome e foto sono visibili a tutti gli utenti dell'app, insieme ai giorni in cui hai raggiunto l'obiettivo. L'acqua, il caffè, gli orari e lo sfondo restano privati. I suggerimenti li legge solo chi gestisce l'app.</p>
      </section>

      <section className="section">
        <h2>Dove sono conservati</h2>
        <p>I dati sono conservati su Supabase. Le notifiche passano dal servizio push del produttore del telefono, come Apple. Se chiedi il meteo o attivi «Più acqua nei giorni caldi», la città che scegli o la tua posizione approssimata (circa 10 km) vanno a Open-Meteo. I dati servono solo a far funzionare l'app e non vengono venduti né usati per pubblicità.</p>
      </section>

      <section className="section">
        <h2>Età minima</h2>
        <p>Bere è per chi ha almeno 14 anni. All'iscrizione chiediamo la data di nascita solo per questo controllo: resta sul telefono e non la salviamo. Se scopriamo che un profilo è di una persona più giovane, lo cancelliamo.</p>
      </section>

      <section className="section">
        <h2>Foto e diritto d'autore</h2>
        <p>Carica solo foto tue o che hai il permesso di usare: la foto del profilo è visibile a tutti in classifica. Se una foto usa una tua opera senza permesso, o un nome o una foto è offensivo, <Link to="/segnala">segnalalo</Link> indicando il nome in classifica e l'opera originale. Controlliamo ogni segnalazione e togliamo i contenuti che violano diritti o regole; chi lo fa più volte perde il profilo. Puoi togliere la tua foto in ogni momento scegliendo uno degli avatar pronti.</p>
      </section>

      <section className="section">
        <h2>Cancellare il profilo</h2>
        <p>Cancella subito profilo, foto, bevute, caffeina e promemoria. I suggerimenti già inviati restano, senza il collegamento al tuo profilo. Non si può annullare.</p>
        <DeleteAccount />
      </section>
    </main>
  )
}
