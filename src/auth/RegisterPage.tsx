import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ageOn, blockAge, isAgeBlocked, MIN_AGE } from './age'
import { EmailCodeForm } from './EmailCodeForm'

function signUpErrorMessage(message: string): string {
  if (/rate limit/i.test(message)) return 'Troppe email inviate di recente. Riprova tra un\'ora'
  if (/fetch|network/i.test(message)) return 'Registrazione non riuscita. Controlla la connessione e riprova'
  if (/already registered/i.test(message)) return 'Questa email ha già un profilo: usa la stessa password per accedere'
  if (/email/i.test(message)) return 'Controlla l\'indirizzo email: non sembra valido'
  if (/password/i.test(message)) return 'Scegli una password più sicura'
  return 'Registrazione non riuscita. Controlla i dati e riprova'
}

export function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [birth, setBirth] = useState('')
  const [tooYoung, setTooYoung] = useState(isAgeBlocked)
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Inserisci il tuo nome')
    if (password.length < 8) return setError('La password deve avere almeno 8 caratteri')
    // La data serve solo per questo controllo: non viene inviata né salvata.
    const age = ageOn(birth, new Date())
    if (age === null) return setError('Inserisci la tua data di nascita')
    if (age < MIN_AGE) {
      blockAge()
      return setTooYoung(true)
    }
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim(), tz: new Intl.DateTimeFormat().resolvedOptions().timeZone },
      },
    })
    setBusy(false)
    if (error) return setError(signUpErrorMessage(error.message))
    // Supabase risponde "ok" anche per una email già registrata, ma non invia nulla: l'elenco identità è vuoto.
    if (data.user?.identities?.length === 0) return setError('Questa email ha già un profilo: usa la stessa password per accedere')
    if (!data.session) setSent(true)
  }

  if (sent) return <EmailCodeForm email={email.trim()} />

  if (tooYoung)
    return (
      <main className="auth">
        <h1>Bere è per chi ha almeno {MIN_AGE} anni</h1>
        <p>Per creare un profilo serve avere almeno {MIN_AGE} anni. Grazie di aver provato Bere: ti aspettiamo più avanti!</p>
        <p className="hint">La data che hai scritto non è stata inviata né salvata.</p>
        <p className="auth-links"><Link to="/login">Torna all'accesso</Link></p>
      </main>
    )

  return (
    <main className="auth">
      <h1>Crea il tuo profilo</h1>
      <form onSubmit={submit} className="stack" noValidate>
        <label>
          Nome
          <input autoComplete="given-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label>
          Data di nascita
          <input type="date" autoComplete="bday" max={today} value={birth} onChange={(e) => setBirth(e.target.value)} />
        </label>
        <p className="hint">Serve almeno {MIN_AGE} anni. La data resta sul telefono: non la salviamo.</p>
        <p className="hint">Il nome e la foto sono visibili agli altri utenti nella classifica.</p>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary" disabled={busy}>Registrati</button>
      </form>
      <p className="auth-links"><Link to="/login">Hai già un profilo? Accedi</Link></p>
    </main>
  )
}
