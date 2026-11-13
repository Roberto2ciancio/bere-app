import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { Avatar } from '../avatars/Avatar'
import { localParts } from '../domain/time'
import { useGluSpot, useGluStageActive } from '../glu3d/stage/stageContext'
import { LevelBadge } from '../levels/LevelBadge'
import { levelOf } from '../levels/levels'
import { useLevels } from '../levels/useLevels'
import { readCache } from '../lib/cache'
import { useGluAccessories } from '../mascot/accessories'
import { GluCorner } from '../mascot/GluCorner'
import { profileGreeting } from '../mascot/phrases'
import { usePauses } from '../pause/usePauses'
import { isPushOff, pushSupportState } from '../push/subscribe'
import { listSchedules, toReminders } from '../schedules/schedulesApi'
import { useTodayGoalMl } from '../schedules/useGoalMl'
import { ChevronIcon, GlassIcon, HelpIcon, LockIcon, PaletteIcon, ReminderIcon, TargetIcon } from '../ui/icons'
import { Stagger } from '../ui/motion/Stagger'
import { drinkSummary, goalSummary, notificationSummary } from './profileSummaries'

/** Quanti orari hanno i programmi attivi: prima la copia della Home, poi il server; null se non si sa. */
function useReminderCount(userId: string | null): number | null {
  const [count, setCount] = useState<number | null>(() => (userId ? readCache<unknown[]>(`bere.reminders.${userId}`)?.length ?? null : null))
  useEffect(() => {
    if (!userId) return
    let active = true
    listSchedules(userId)
      .then((schedules) => {
        if (active) setCount(toReminders(schedules).length)
      })
      .catch(() => {
        // Senza rete resta la copia (o nessun numero).
      })
    return () => {
      active = false
    }
  }, [userId])
  return count
}

interface Row {
  to: string
  title: string
  summary: string
  icon: ReactNode
}

/** Un indice essenziale: ogni gruppo di impostazioni ha la propria pagina, con un riepilogo vivo. */
export function ProfilePage() {
  const { profile } = useProfile()
  const { user } = useAuth()
  const userId = user?.id ?? null
  const tz = profile?.tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = localParts(new Date(), tz).date
  const goalMl = useTodayGoalMl(userId, tz)
  const reminders = useReminderCount(userId)
  const pause = usePauses(userId, today).current
  // Come PushToggle: lo stato del browser e lo spegnimento scelto su questo telefono.
  const [support] = useState(pushSupportState)
  const [off] = useState(isPushOff)
  const points = useLevels()?.get(userId ?? '')

  // Glu nell'angolo: con il palcoscenico lo disegna lui (stessa frase), altrimenti GluCorner.
  const stage = useGluStageActive()
  const accessories = useGluAccessories()
  const greeting = profile ? profileGreeting(profile.display_name) : undefined
  useGluSpot(stage ? { spot: 'corner', mood: 'hello', text: greeting, fill: 0.6, extras: accessories, help: 'profilo' } : null)

  const units = profile?.units
  const rows: Row[] = [
    { to: '/profilo/obiettivo', title: 'Obiettivo', summary: goalSummary(goalMl, units), icon: <TargetIcon /> },
    {
      to: '/profilo/avvisi',
      title: 'Promemoria e notifiche',
      summary: notificationSummary({ support, off, pauseEnd: pause?.end_date ?? null, reminders }),
      icon: <ReminderIcon />,
    },
    { to: '/profilo/bevute', title: 'Bevute e tazze', summary: profile ? drinkSummary(profile.drink_ml, units) : '—', icon: <GlassIcon /> },
    { to: '/profilo/aspetto', title: 'Aspetto e Glu', summary: 'Avatar, sfondo e Glu', icon: <PaletteIcon /> },
    { to: '/profilo/account', title: 'Account e privacy', summary: user?.email ?? 'Password, dati e privacy', icon: <LockIcon /> },
    { to: '/profilo/aiuto', title: 'Aiuto e suggerimenti', summary: 'Chiedi a Glu, idee e novità', icon: <HelpIcon /> },
  ]

  return (
    <Stagger as="main" className={stage ? 'page profile has-glu-stage' : 'page profile'}>
      <h1>Profilo</h1>
      {profile && (
        <header className="profile-index-head">
          <Link className="profile-index-avatar" to="/profilo/aspetto" aria-label="Cambia avatar e aspetto">
            <Avatar path={profile.avatar_path} name={profile.display_name} large />
          </Link>
          <div className="profile-index-who">
            <p className="profile-index-name">{profile.display_name}</p>
            {points !== undefined && (
              <p className="profile-index-level">
                <LevelBadge points={points} />
                <span className="hint">{levelOf(points).name}</span>
              </p>
            )}
          </div>
        </header>
      )}

      {!stage && greeting && <GluCorner mood="hello" text={greeting} />}

      <nav className="card profile-menu" aria-label="Impostazioni del profilo">
        {rows.map((row) => (
          <Link className="profile-menu-row" key={row.to} to={row.to}>
            <span className="profile-menu-icon">{row.icon}</span>
            <span className="profile-menu-text">
              <strong>{row.title}</strong>
              <span className="profile-menu-summary">{row.summary}</span>
            </span>
            <span className="profile-menu-chevron"><ChevronIcon /></span>
          </Link>
        ))}
      </nav>

      <p className="hint app-version">Bere {__APP_VERSION__}</p>
    </Stagger>
  )
}
