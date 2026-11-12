import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { useGluSpot, useGluStageActive } from '../glu3d/stage/stageContext'
import { useGluAccessories } from '../mascot/accessories'
import { GluCorner } from '../mascot/GluCorner'
import { profileGreeting } from '../mascot/phrases'
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
  const { profile } = useProfile()
  // Glu nell'angolo: con il palcoscenico lo disegna lui (stessa frase), altrimenti GluCorner.
  const stage = useGluStageActive()
  const accessories = useGluAccessories()
  const greeting = profile ? profileGreeting(profile.display_name) : undefined
  useGluSpot(stage ? { spot: 'corner', mood: 'hello', text: greeting, fill: 0.6, extras: accessories, help: 'profilo' } : null)

  return (
    <Stagger as="main" className={stage ? 'page profile has-glu-stage' : 'page profile'}>
      <h1>Profilo</h1>

      {!stage && greeting && <GluCorner mood="hello" text={greeting} />}

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
