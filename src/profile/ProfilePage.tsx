import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { PushToggle } from '../push/PushToggle'
import { AppearanceForm } from './AppearanceForm'
import { GoalForm } from './GoalForm'
import { PasswordForm } from './PasswordForm'

export function ProfilePage() {
  const { signOut } = useAuth()
  const { profile, updateProfile } = useProfile()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const currentName = profile?.display_name ?? ''
  useEffect(() => {
    setName(currentName)
  }, [currentName])

  function saveName(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    if (!name.trim()) return setError('Inserisci il tuo nome')
    setError(null)
    void updateProfile({ display_name: name.trim() }).then(() => setSaved(true))
  }

  return (
    <main className="page">
      <h1>Profilo</h1>

      <section className="section">
        <form className="stack" onSubmit={saveName} noValidate>
          <label>
            Nome
            <input maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <p className="hint">Nome e foto sono visibili agli altri utenti nella classifica.</p>
          {error && <p role="alert" className="error">{error}</p>}
          {saved && <p role="status" className="hint">Nome salvato.</p>}
          <button className="secondary">Salva nome</button>
        </form>
      </section>

      <AppearanceForm />

      <section className="section">
        <h2>Obiettivo e promemoria</h2>
        <GoalForm />
        <p><Link to="/promemoria">Gestisci i promemoria</Link></p>
      </section>

      <section className="section">
        <h2>Notifiche</h2>
        <PushToggle />
        <p><Link to="/notifiche">Stato notifiche</Link></p>
      </section>

      <PasswordForm />

      <section className="section">
        <h2>Altro</h2>
        <p><Link to="/feedback">Suggerisci un miglioramento</Link></p>
        <p><Link to="/privacy">Privacy e cancellazione dell'account</Link></p>
        <button className="secondary" onClick={() => void signOut()}>Esci</button>
      </section>
    </main>
  )
}
