import type { ReactNode } from 'react'
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

interface ProfileSectionPageProps {
  title: string
  description: string
  children: ReactNode
}

/** Intestazione comune delle pagine raggiunte dall'indice del Profilo. */
export function ProfileSectionPage({ title, description, children }: ProfileSectionPageProps) {
  return (
    <main className="page profile-section">
      <header className="profile-section-head">
        <Link className="back-link" to="/profilo">‹ Profilo</Link>
        <h1>{title}</h1>
        <p className="hint">{description}</p>
      </header>
      {children}
    </main>
  )
}

export function GoalSettingsPage() {
  return (
    <ProfileSectionPage title="Obiettivo" description="Quanto bere durante la giornata e come adattare l'obiettivo.">
      <section className="card">
        <GoalForm />
        <hr />
        <ActiveHoursForm />
        <hr />
        <HeatForm />
      </section>
    </ProfileSectionPage>
  )
}

export function NotificationSettingsPage() {
  return (
    <ProfileSectionPage title="Promemoria e notifiche" description="Orari, avvisi sul telefono e giorni di pausa.">
      <section className="card" aria-label="Notifiche">
        <PushToggle />
        <NotificationPrefs />
      </section>
      <section className="card">
        <h2>Pausa</h2>
        <PauseForm />
      </section>
      <nav className="card link-list" aria-label="Gestione degli avvisi">
        <Link className="link-row" to="/promemoria">Gestisci i promemoria</Link>
        <Link className="link-row" to="/notifiche">Stato notifiche</Link>
      </nav>
    </ProfileSectionPage>
  )
}

export function DrinkSettingsPage() {
  return (
    <ProfileSectionPage title="Bevute e tazze" description="Quantità, unità di misura, suoni e contenitori che usi.">
      <DrinkPrefs />
    </ProfileSectionPage>
  )
}

export function AppearanceSettingsPage() {
  return (
    <ProfileSectionPage title="Aspetto e Glu" description="Nome, immagine del profilo, sfondo e animazioni di Glu.">
      <ProfileHeader />
      <AppearanceForm />
    </ProfileSectionPage>
  )
}

export function AccountSettingsPage() {
  const { signOut, user } = useAuth()
  return (
    <ProfileSectionPage title="Account e privacy" description="Accesso, copie dei dati e cancellazione del profilo.">
      {user?.email && <p className="hint account-email">Sei connesso come {user.email}</p>}
      <section className="card">
        <div className="link-list">
          <PasswordForm />
          <DataBackup />
          <Link className="link-row" to="/privacy">Privacy e cancellazione dell'account</Link>
        </div>
        <button className="secondary" onClick={() => void signOut()}>Esci</button>
      </section>
    </ProfileSectionPage>
  )
}

export function HelpSettingsPage() {
  return (
    <ProfileSectionPage title="Aiuto e suggerimenti" description="Novità di Bere, idee per migliorarla e segnalazioni.">
      <p className="hint">Per una risposta rapida torna al Profilo e tocca Glu: può guidarti passo passo.</p>
      <nav className="card link-list" aria-label="Aiuto">
        <Link className="link-row" to="/novita">Leggi le novità</Link>
        <Link className="link-row" to="/feedback">Suggerisci un miglioramento</Link>
        <Link className="link-row" to="/segnala">Segnala un contenuto</Link>
      </nav>
    </ProfileSectionPage>
  )
}
