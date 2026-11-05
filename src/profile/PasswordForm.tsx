import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { sendPasswordLink } from '../auth/ResetPasswordPage'
import { supabase } from '../lib/supabase'

export function PasswordForm() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    if (next.length < 8) return setError('La nuova password deve avere almeno 8 caratteri')
    if (!user?.email) return setError('Accedi di nuovo per cambiare la password')
    setBusy(true)
    setError(null)
    // Su un telefono lasciato sbloccato, la sessione aperta non deve bastare a cambiare la password.
    const check = await supabase.auth.signInWithPassword({ email: user.email, password: current })
    if (check.error) {
      setBusy(false)
      return setError(/invalid login/i.test(check.error.message) ? 'La password attuale non è corretta' : 'Controllo non riuscito. Controlla la connessione e riprova')
    }
    const { error } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (error) return setError('Non è stato possibile cambiare la password. Deve essere diversa da quella attuale')
    setCurrent('')
    setNext('')
    setMessage('Password cambiata.')
  }

  async function sendLink() {
    if (!user?.email) return setError('Accedi di nuovo per cambiare la password')
    setBusy(true)
    setError(null)
    setMessage(null)
    const { error } = await sendPasswordLink(user.email)
    setBusy(false)
    if (error) return setError('Non è stato possibile inviare il link. Riprova tra qualche minuto')
    setMessage(`Abbiamo inviato a ${user.email} un link per scegliere una nuova password.`)
  }

  return (
    <details className="fold">
      <summary>Password</summary>
      <div className="fold-body">
        <form className="stack" onSubmit={submit} noValidate>
          <label>
            Password attuale
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label>
            Nuova password
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          {error && <p role="alert" className="error">{error}</p>}
          {message && <p role="status" className="hint">{message}</p>}
          <button className="secondary" disabled={busy}>Cambia password</button>
        </form>
        <button className="ghost" disabled={busy} onClick={() => void sendLink()}>Non la ricordo: inviami un link</button>
      </div>
    </details>
  )
}
