import { Link } from 'react-router-dom'
import { useProfile } from '../auth/ProfileProvider'
import { useGluSpot, useGluStageActive } from '../glu3d/stage/stageContext'
import { useGluAccessories } from '../mascot/accessories'
import { GluCorner } from '../mascot/GluCorner'
import { profileGreeting } from '../mascot/phrases'
import { Stagger } from '../ui/motion/Stagger'

const SECTIONS = [
  { to: '/profilo/obiettivo', title: 'Obiettivo', summary: 'Litri al giorno, fascia attiva e giorni caldi' },
  { to: '/avvisi', title: 'Promemoria e notifiche', summary: 'Orari, avvisi sul telefono e pausa' },
  { to: '/bevute', title: 'Bevute e tazze', summary: 'Quantità, unità, suono e contenitori' },
  { to: '/aspetto', title: 'Aspetto e Glu', summary: 'Nome, foto, sfondo e animazioni' },
  { to: '/account', title: 'Account e privacy', summary: 'Password, copie dei dati e cancellazione' },
  { to: '/aiuto', title: 'Aiuto e suggerimenti', summary: 'Novità, idee e segnalazioni' },
] as const

/** Un indice essenziale: ogni gruppo di impostazioni ha la propria pagina. */
export function ProfilePage() {
  const { profile } = useProfile()
  // Glu nell'angolo: con il palcoscenico lo disegna lui (stessa frase), altrimenti GluCorner.
  const stage = useGluStageActive()
  const accessories = useGluAccessories()
  const greeting = profile ? profileGreeting(profile.display_name) : undefined
  useGluSpot(stage ? { spot: 'corner', mood: 'hello', text: greeting, fill: 0.6, extras: accessories, help: 'profilo' } : null)

  return (
    <Stagger as="main" className={stage ? 'page profile has-glu-stage' : 'page profile'}>
      <header className="profile-index-head">
        <h1>Profilo</h1>
        <p className="hint">Scegli cosa vuoi regolare.</p>
      </header>

      {!stage && greeting && <GluCorner mood="hello" text={greeting} />}

      <nav className="card profile-menu" aria-label="Impostazioni del profilo">
        {SECTIONS.map((section) => (
          <Link className="profile-menu-row" key={section.to} to={section.to}>
            <span className="profile-menu-text">
              <strong>{section.title}</strong>
              <span className="profile-menu-summary">{section.summary}</span>
            </span>
          </Link>
        ))}
      </nav>

      <p className="hint app-version">Bere {__APP_VERSION__}</p>
    </Stagger>
  )
}
