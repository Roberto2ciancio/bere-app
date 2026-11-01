import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { EmailCodeForm } from './EmailCodeForm'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [needsCode, setNeedsCode] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error && /not confirmed/i.test(error.message)) {
      // Il codice precedente può essere scaduto. Se l'invio fallisce, dalla schermata si può riprovare.
      await supabase.auth.resend({ type: 'signup', email })
      setBusy(false)
      return setNeedsCode(true)
    }
    setBusy(false)
    if (!error) return
    setError(/invalid login/i.test(error.message) ? 'Email o password non corrette' : 'Accesso non riuscito. Controlla la connessione e riprova')
  }

  if (needsCode) return <EmailCodeForm email={email} />

  return (
    <main className="auth">
      <h1>Accedi</h1>
      <form onSubmit={submit} className="stack">
        <label>
          Email
          <input type="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary" disabled={busy}>Accedi</button>
      </form>
      <p className="auth-links">
        <Link to="/recupera">Password dimenticata?</Link>
        <Link to="/registrati">Crea un profilo</Link>
      </p>
    </main>
  )
}
