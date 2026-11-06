import { Link } from 'react-router-dom'
import { DeleteAccount } from './DeleteAccount'

export function PrivacyPage() {
  return (
    <main className="page">
      <div className="row">
        <h1>Privacy</h1>
        <Link to="/profilo">Profilo</Link>
      </div>

      <section className="section">
        <h2>Cosa salviamo</h2>
        <p>Email e password per l'accesso, nome, foto e sfondo che scegli, obiettivi, orari dei promemoria, bevute e caffeina segnate, tazze e bevande personalizzate, peso e attività se usi il calcolo dell'obiettivo, la città se attivi i giorni caldi, allenamenti segnati, suggerimenti inviati e i dati tecnici necessari per recapitare le notifiche al tuo telefono.</p>
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
        <h2>Cancellare il profilo</h2>
        <p>Cancella subito profilo, foto, bevute, caffeina e promemoria. I suggerimenti già inviati restano, senza il collegamento al tuo profilo. Non si può annullare.</p>
        <DeleteAccount />
      </section>
    </main>
  )
}
