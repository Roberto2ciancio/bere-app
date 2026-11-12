import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

type Reason = 'copyright' | 'offensive'

const REASONS: Record<Reason, string> = {
  copyright: 'Una foto usa una mia opera senza permesso (diritto d\'autore)',
  offensive: 'Una foto o un nome è offensivo o inadatto',
}

/**
 * Segnalazione di una foto o di un nome visibili in classifica. Finisce tra i suggerimenti, che legge solo chi
 * gestisce l'app; la procedura per rimuovere il contenuto è in docs/segnalazioni.md.
 */
export function ReportPage() {
  const { user } = useAuth()
  const [reason, setReason] = useState<Reason>('copyright')
  const [who, setWho] = useState('')
  const [details, setDetails] = useState('')
  const [goodFaith, setGoodFaith] = useState(false)
  const [accurate, setAccurate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!who.trim()) return setError('Scrivi il nome come appare in classifica')
    if (!details.trim()) return setError(reason === 'copyright' ? 'Descrivi l\'opera tua che viene usata' : 'Spiega in breve il problema')
    if (reason === 'copyright' && !(goodFaith && accurate)) return setError('Per una segnalazione di diritto d\'autore servono le due dichiarazioni')
    if (!user) return
    const message = [
      `[Segnalazione: ${reason === 'copyright' ? 'diritto d\'autore' : 'contenuto inadatto'}]`,
      `In classifica: ${who.trim()}`,
      `Dettagli: ${details.trim()}`,
      reason === 'copyright' ? 'Dichiara buona fede ed esattezza, come titolare o per conto del titolare.' : '',
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 2000)
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('feedback').insert({ user_id: user.id, message })
    setBusy(false)
    if (error) return setError('La segnalazione non è partita. Controlla la connessione e riprova')
    setSent(true)
  }

  return (
    <main className="page">
      <div className="row">
        <h1>Segnala</h1>
        <Link to="/classifica">Classifica</Link>
      </div>
      {sent ? (
        <p role="status">Grazie, l'abbiamo ricevuta. La controlliamo e, se il contenuto viola i diritti o le regole, lo togliamo.</p>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <fieldset className="stack">
            <legend>Cosa segnali?</legend>
            {(Object.keys(REASONS) as Reason[]).map((key) => (
              <label key={key} className="check">
                <input type="radio" name="reason" checked={reason === key} onChange={() => setReason(key)} />
                {REASONS[key]}
              </label>
            ))}
          </fieldset>
          <label>
            Nome in classifica
            <input maxLength={60} value={who} onChange={(e) => setWho(e.target.value)} />
          </label>
          <label>
            {reason === 'copyright' ? 'Quale opera tua viene usata? Dove si trova l\'originale?' : 'Cosa c\'è che non va?'}
            <textarea rows={5} maxLength={1500} value={details} onChange={(e) => setDetails(e.target.value)} />
          </label>
          {reason === 'copyright' && (
            <>
              <label className="check">
                <input type="checkbox" checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} />
                In buona fede ritengo che questo uso non sia autorizzato dal titolare dei diritti o dalla legge.
              </label>
              <label className="check">
                <input type="checkbox" checked={accurate} onChange={(e) => setAccurate(e.target.checked)} />
                Le informazioni sono esatte e sono il titolare dei diritti o agisco per suo conto.
              </label>
            </>
          )}
          {error && <p role="alert" className="error">{error}</p>}
          <button className="primary" disabled={busy}>Invia la segnalazione</button>
          <p className="hint">Ti ricontattiamo all'email del tuo profilo se serve. Le segnalazioni le legge solo chi gestisce l'app.</p>
        </form>
      )}
    </main>
  )
}
