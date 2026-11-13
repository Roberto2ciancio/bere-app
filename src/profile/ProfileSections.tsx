import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useOpenGluHelp } from '../glu3d/stage/stageContext'
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
  // «Chiedi a Glu» esiste solo col palcoscenico (Glu in 3D scelto e acceso). Qui Glu è fuori scena:
  // la chat si apre comunque, senza farlo tornare (vedi GluStage, richiesta openHelp).
  const openHelp = useOpenGluHelp()
  return (
    <ProfileSectionPage title="Aiuto e suggerimenti" description="Novità di Bere, idee per migliorarla e segnalazioni.">
      {openHelp ? (
        <section className="card help-ask">
          <p>Glu risponde alle domande sull'app: dove trovare un'impostazione, come segnare una bevuta, come funziona la serie.</p>
          <button type="button" className="primary" onClick={() => openHelp('profilo')}>Chiedi a Glu</button>
        </section>
      ) : (
        <p className="hint">Con «Glu in 3D» acceso puoi anche chiedere a Glu come si fa qualcosa: lo trovi in «Aspetto e Glu», se il telefono lo permette.</p>
      )}
      <nav className="card link-list" aria-label="Aiuto">
        <Link className="link-row" to="/novita">Leggi le novità</Link>
        <Link className="link-row" to="/feedback">Suggerisci un miglioramento</Link>
        <Link className="link-row" to="/segnala">Segnala un contenuto</Link>
      </nav>
    </ProfileSectionPage>
  )
}
