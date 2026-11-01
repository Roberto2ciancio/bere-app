import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CODE_LENGTH = 6

/** A codice giusto Supabase apre la sessione e il router porta alla home. */
export function EmailCodeForm({ email }: { email: string }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    if (code.length !== CODE_LENGTH) return setError(`Il codice ha ${CODE_LENGTH} cifre`)
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' })
    setBusy(false)
    if (!error) return
    setError(
      /expired|invalid/i.test(error.message)
        ? 'Codice errato o scaduto. Riprova o chiedine uno nuovo'
        : 'Verifica non riuscita. Controlla la connessione e riprova',
    )
  }

  async function resend() {
    setBusy(true)
    setError(null)
    setMessage(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setBusy(false)
    if (error) return setError('Non è stato possibile inviare un nuovo codice. Riprova tra qualche minuto')
    setCode('')
    setMessage('Nuovo codice inviato: usa quello più recente.')
  }

  return (
    <main className="auth">
      <h1>Inserisci il codice</h1>
      <p>Controlla la tua email: abbiamo inviato un codice di {CODE_LENGTH} cifre a {email}.</p>
      <form onSubmit={submit} className="stack" noValidate>
        <label>
          Codice
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        {message && <p role="status" className="hint">{message}</p>}
        <button className="primary" disabled={busy}>Conferma</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => void resend()}>Invia un nuovo codice</button>
      </form>
      <p className="hint">Non arriva? Controlla lo spam. Se questa email ha già un profilo, non riceverai nessun codice: accedi con la tua password.</p>
      <p className="auth-links"><Link to="/login">Vai all'accesso</Link></p>
    </main>
  )
}
