import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

export function sendPasswordLink(email: string) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname })
}

export function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const linkExpired = (useLocation().state as { linkExpired?: boolean } | null)?.linkExpired === true

  async function submit(event: FormEvent) {
    event.preventDefault()
    // Il messaggio è sempre lo stesso, per non rivelare quali email sono registrate.
    await sendPasswordLink(email)
    setSent(true)
  }

  return (
    <main className="auth">
      <h1>Recupera la password</h1>
      {linkExpired && !sent && <p role="alert" className="error">Il link è scaduto o è già stato usato. Chiedine uno nuovo.</p>}
      {sent ? (
        <p>Se l'email è registrata, riceverai a breve un link per scegliere una nuova password.</p>
      ) : (
        <form onSubmit={submit} className="stack">
          <label>
            Email
            <input type="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="primary">Invia il link</button>
        </form>
      )}
      <p className="auth-links"><Link to="/login">Torna all'accesso</Link></p>
    </main>
  )
}

export function NewPasswordPage() {
  const { finishRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) return setError('La password deve avere almeno 8 caratteri')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setError('Non è stato possibile cambiare la password. Riprova')
    finishRecovery()
  }

  return (
    <main className="auth">
      <h1>Nuova password</h1>
      <form onSubmit={submit} className="stack" noValidate>
        <label>
          Password
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary">Salva</button>
      </form>
      <p className="hint">Se usi l'app installata, il link può essersi aperto nel browser: dopo aver salvato, riapri l'app dalla sua icona e accedi con la nuova password.</p>
    </main>
  )
}
