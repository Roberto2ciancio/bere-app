import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { PauseForm } from '../pause/PauseForm'
import { NotificationPrefs } from '../push/NotificationPrefs'
import { PushToggle } from '../push/PushToggle'
import { ActiveHoursForm } from './ActiveHoursForm'
import { AppearanceForm, DrinkPrefs, ProfileHeader } from './AppearanceForm'
import { DataBackup } from './DataBackup'
import { GoalForm } from './GoalForm'
import { HeatForm } from './HeatForm'
import { PasswordForm } from './PasswordForm'
import { Stagger } from '../ui/motion/Stagger'

// Dall'alto: chi sei, quanto bere, come segnarlo, quando ricordartelo, l'aspetto, l'account.
export function ProfilePage() {
  const { signOut } = useAuth()

  return (
    <Stagger as="main" className="page profile">
      <h1>Profilo</h1>

      <ProfileHeader />

      <section className="card">
        <h2>Obiettivo</h2>
        <GoalForm />
        <hr />
        <ActiveHoursForm />
        <hr />
        <HeatForm />
      </section>

      <DrinkPrefs />

      <section className="card">
        <h2>Promemoria e notifiche</h2>
        <PushToggle />
        <NotificationPrefs />
        <hr />
        <PauseForm />
        <nav className="link-list" aria-label="Promemoria">
          <Link className="link-row" to="/promemoria">Gestisci i promemoria</Link>
          <Link className="link-row" to="/notifiche">Stato notifiche</Link>
        </nav>
      </section>

      <AppearanceForm />

      <section className="card">
        <h2>Account</h2>
        <div className="link-list">
          <PasswordForm />
          <DataBackup />
          <Link className="link-row" to="/feedback">Suggerisci un miglioramento</Link>
          <Link className="link-row" to="/privacy">Privacy e cancellazione dell'account</Link>
        </div>
        <button className="secondary" onClick={() => void signOut()}>Esci</button>
      </section>

      <p className="hint app-version">Bere {__APP_VERSION__}</p>
    </Stagger>
  )
}
