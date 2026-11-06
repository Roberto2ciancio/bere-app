import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { activePace, DEFAULT_ACTIVE_END, DEFAULT_ACTIVE_START, inActiveHours, MAX_HOURLY_ML, type ActiveHours, type Pace } from '../domain/activeHours'
import { formatTime } from '../domain/format'
import { DEFAULT_DRINK_ML, goalForDate, type GoalChange } from '../domain/goals'
import { nextReminder, type Reminder } from '../domain/reminders'
import { addDays, localParts, weekdayOf } from '../domain/time'
import { CAFFEINE_LIMIT_MG } from '../caffeine/caffeine'
import { useCaffeine } from '../caffeine/useCaffeine'
import { DrinkSheet } from '../drinks/DrinkSheet'
import { useDrinks, type DrinkInput } from '../drinks/useDrinks'
import { WORKOUT_BOOST_ML } from '../goal/boosts'
import { useGoalBoosts } from '../goal/useGoalBoosts'
import { expectedByNow, formatAmount, formatVolume, HIGH_INTAKE_ML, type Units } from '../domain/hydration'
import { NewsIcon } from '../news/NewsIcon'
import { pendingOnboardingStep } from '../onboarding/onboardingFlag'
import { pushSupportState } from '../push/subscribe'
import { readCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { listSchedules, toReminders } from '../schedules/schedulesApi'
import { BottleView } from './BottleView'
import { CharacterView } from './CharacterView'
import { DropsView } from './DropsView'
import { RingView } from './RingView'
import { playSound } from './sounds'
import type { ViewProps } from './views'

const DAYS = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
const VIEWS = {
  bottle: BottleView,
  ring: RingView,
  drops: DropsView,
  'drop-face': (props: ViewProps) => <CharacterView shape="drop-face" {...props} />,
  cat: (props: ViewProps) => <CharacterView shape="cat" {...props} />,
  fish: (props: ViewProps) => <CharacterView shape="fish" {...props} />,
  can: (props: ViewProps) => <CharacterView shape="can" {...props} />,
}

function describeNext(next: { date: string; minutes: number }, today: string): string {
  const time = formatTime(next.minutes)
  if (next.date === today) return `alle ${time}`
  if (next.date === addDays(today, 1)) return `domani alle ${time}`
  const weekday = new Date(`${next.date}T00:00:00Z`).getUTCDay()
  return `${DAYS[(weekday + 6) % 7]} alle ${time}`
}

/** Dove sei rispetto alla fascia attiva, in parole semplici. */
function describePace(pace: Pace, hours: ActiveHours, units: Units | undefined): { status: string; next?: string; capped?: boolean } | null {
  switch (pace.phase) {
    case 'done':
      return null
    case 'before':
      return { status: `Riprendo alle ${formatTime(pace.resumesAt)}` }
    case 'after':
      return { status: `Fascia attiva finita: riprendo domani alle ${formatTime(hours.start)}` }
    case 'active': {
      const expected = formatVolume(pace.expectedMl, units)
      const status =
        pace.status === 'on-track'
          ? `Sei in linea: a quest'ora dovresti essere a ${expected}`
          : pace.status === 'behind'
            ? `Sei indietro di ${formatAmount(-pace.diffMl, units)}: a quest'ora dovresti essere a ${expected}`
            : `Sei avanti di ${formatAmount(pace.diffMl, units)}: a quest'ora dovresti essere a ${expected}`
      return { status, next: `Da ora circa ${formatAmount(pace.hourlyMl, units)} all'ora fino alle ${formatTime(hours.end)}`, capped: pace.capped }
    }
  }
}

export function HomePage() {
  const { user } = useAuth()
  const { profile, loading } = useProfile()
  const navigate = useNavigate()
  const userId = user?.id ?? null
  const tz = profile?.tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
  const drinkMl = profile?.drink_ml ?? DEFAULT_DRINK_ML

  const [now, setNow] = useState(() => new Date())
  const [goals, setGoals] = useState<GoalChange[]>([])
  const [reminders, setReminders] = useState<Reminder[] | null>(null)
  const [pulse, setPulse] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Tiene aggiornati giorno e prossimo promemoria anche se l'app resta aperta o torna in primo piano.
  useEffect(() => {
    const tick = () => setNow(new Date())
    const timer = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let active = true
    const goalsKey = `bere.goals.${userId}`
    setGoals(readCache<GoalChange[]>(goalsKey) ?? [])
    Promise.resolve(supabase.from('goal_changes').select('effective_from, goal_ml').eq('user_id', userId)).then(({ data }) => {
      if (!active || !data) return
      const rows = data as { effective_from: string; goal_ml: number }[]
      const loaded = rows.map((r) => ({ effectiveFrom: r.effective_from, goalMl: r.goal_ml }))
      writeCache(goalsKey, loaded)
      setGoals(loaded)
    })
    const remindersKey = `bere.reminders.${userId}`
    setReminders(readCache<Reminder[]>(remindersKey))
    listSchedules(userId)
      .then((schedules) => {
        if (!active) return
        const loaded = toReminders(schedules)
        writeCache(remindersKey, loaded)
        setReminders(loaded)
        const step = pendingOnboardingStep(userId, schedules.length)
        if (step) navigate('/inizia', { replace: true, state: { step } })
      })
      .catch(() => {
        // Senza rete si resta sugli orari salvati: non è un invito a impostarne di nuovi.
      })
    return () => {
      active = false
    }
  }, [userId, navigate])

  const today = localParts(now, tz).date
  const boosts = useGoalBoosts(userId, today, { enabled: profile?.heat_boost, lat: profile?.city_lat, lon: profile?.city_lon })
  const baseGoalMl = goalForDate(goals, today)
  const goalMl = baseGoalMl + (boosts.byDay.get(today) ?? 0)
  const { totalMl, pending, canUndo, drink, undoLast } = useDrinks(userId, today, tz, drinkMl)
  const caffeine = useCaffeine(userId, today, tz)
  const split = profile?.active_split ?? false
  const hours: ActiveHours = { start: profile?.active_start_min ?? DEFAULT_ACTIVE_START, end: profile?.active_end_min ?? DEFAULT_ACTIVE_END }
  // Con la fascia attiva i promemoria fuori fascia non partono: non vanno annunciati.
  const activeReminders = reminders && split ? reminders.filter((r) => inActiveHours(r.minutes, hours)) : reminders
  const next = activeReminders ? nextReminder(activeReminders, now, tz) : null
  const View = VIEWS[profile?.home_style ?? 'bottle'] ?? BottleView

  function onDrink(input?: DrinkInput) {
    if (!drink(input)) return
    setSheetOpen(false)
    setPulse((p) => p + 1)
    playSound(profile?.sound ?? 'goccia')
  }

  // Scorciatoie dall'icona (pressione lunga): #/home?azione=bevi oppure ?azione=caffe.
  // Si esegue una volta sola, appena c'è il profilo, poi l'indirizzo torna pulito.
  const [params] = useSearchParams()
  const action = params.get('azione')
  const handled = useRef(false)
  const [shortcutNote, setShortcutNote] = useState<string | null>(null)
  useEffect(() => {
    // Una scorciatoia usata di nuovo con l'app già aperta riporta l'azione: va eseguita anche lei.
    if (!action) {
      handled.current = false
      return
    }
    if (!profile || !userId || handled.current) return
    handled.current = true
    if (action === 'bevi') {
      onDrink()
      setShortcutNote(`Segnati ${formatAmount(drinkMl, profile.units)} ✓`)
    } else if (action === 'caffe') {
      caffeine.add()
      setShortcutNote('Caffè segnato ✓')
    }
    navigate('/home', { replace: true })
  })
  useEffect(() => {
    if (!shortcutNote) return
    const timer = setTimeout(() => setShortcutNote(null), 4000)
    return () => clearTimeout(timer)
  }, [shortcutNote])

  // La quantità viene dal profilo: non si segna nulla finché non è disponibile.
  if (!profile) {
    return <p className="center-note">{loading ? 'Caricamento…' : 'Profilo non disponibile. Controlla la connessione e riapri l\'app.'}</p>
  }

  const units = profile.units
  const parts = localParts(now, tz)
  const todayMinutes = (reminders ?? []).filter((r) => r.weekdays.includes(weekdayOf(today))).map((r) => r.minutes)
  const expected = split ? null : expectedByNow(todayMinutes, goalMl, parts.minutes)
  const pace = split ? describePace(activePace({ goalMl, drunkMl: totalMl, nowMinutes: parts.minutes, hours }), hours, units) : null
  const behind = expected !== null && totalMl < goalMl ? expected - totalMl : 0
  const percent = goalMl > 0 ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0

  return (
    <main className="home">
      <NewsIcon />
      <header className="home-head">
        <p className="home-total" aria-live="polite">{formatVolume(totalMl, units)}</p>
        <div className="home-progress" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
        <p className="home-goal">
          {totalMl >= goalMl ? `Obiettivo raggiunto: su ${formatVolume(goalMl, units)}` : `su ${formatVolume(goalMl, units)}`}
          {expected !== null && totalMl < goalMl && (behind > 0 ? ` · ${formatVolume(behind, units)} per essere in pari` : ' · sei in pari')}
        </p>
        {(boosts.heat || boosts.workout) && (
          <p className="home-boost">
            {[
              boosts.heat && `+${formatAmount(boosts.heat.extra_ml, units)} per il caldo${boosts.heat.note ? ` (${boosts.heat.note})` : ''}`,
              boosts.workout && `+${formatAmount(boosts.workout.extra_ml, units)} per l'allenamento`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {pace && (
          <div className="home-pace" aria-live="polite">
            <p>{pace.status}</p>
            {pace.next && <p>{pace.next}</p>}
            {pace.capped && <p className="hint">Non serve recuperare tutto: più di {formatAmount(MAX_HOURLY_ML, units)} all'ora non conviene.</p>}
          </div>
        )}
        {totalMl >= HIGH_INTAKE_ML && (
          <p className="error">Oggi hai bevuto molto: bere troppo in poco tempo può far male. Se non stai bene, chiedi a un medico.</p>
        )}
      </header>

      <div className="home-view">
        <View totalMl={totalMl} goalMl={goalMl} drinkMl={drinkMl} pulse={pulse} />
      </div>

      <footer className="home-actions">
        {shortcutNote && <p role="status" className="board-toast shortcut-note">{shortcutNote}</p>}
        {(pending || caffeine.pending) && <p className="hint" role="status">Salvata sul telefono: la invio appena torna la rete.</p>}
        <div className="home-info">
          {next && <p className="home-next home-bell">Prossimo promemoria {describeNext(next, today)}</p>}
          {reminders && !next && <Link className="home-next" to="/promemoria">Imposta i promemoria</Link>}
          {pushSupportState() !== 'granted' && <Link className="home-next" to="/notifiche">Attiva le notifiche</Link>}
        </div>
        <div className="drink-row">
          <button className="primary drink" onClick={() => onDrink()}>Ho bevuto · {formatAmount(drinkMl, units)}</button>
          <button className="secondary drink-more" aria-label="Altra bevanda" onClick={() => setSheetOpen(true)}>+</button>
        </div>

        <section className="caffeine" aria-label="Caffeina">
          <button className="caffeine-tile" aria-label={`Caffè, ${caffeine.coffees} oggi. Aggiungi`} onClick={() => caffeine.add()}>
            <span aria-hidden="true">☕</span>
            <span>Caffè</span>
            <span key={caffeine.coffees} className="caffeine-count">{caffeine.coffees}</span>
          </button>
          <p className={caffeine.overLimit ? 'caffeine-total error' : 'caffeine-total'}>
            {caffeine.overLimit
              ? `${caffeine.totalMg} mg di caffeina: oltre i ${CAFFEINE_LIMIT_MG} di riferimento`
              : `${caffeine.totalMg} mg di caffeina su ${CAFFEINE_LIMIT_MG}`}
          </p>
        </section>

        <button
          className={boosts.workout ? 'workout-tile on' : 'workout-tile'}
          aria-pressed={!!boosts.workout}
          onClick={() => void boosts.setWorkout(today, !boosts.workout)}
        >
          <span aria-hidden="true">🏃</span>
          {boosts.workout ? `Allenamento segnato: +${formatAmount(boosts.workout.extra_ml, units)} oggi` : `Ho fatto allenamento: +${formatAmount(WORKOUT_BOOST_ML, units)} all'obiettivo`}
        </button>

        {(canUndo || caffeine.canUndo) && (
          <div className="home-undos">
            {canUndo && <button className="ghost" onClick={() => void undoLast()}>Annulla l'ultima</button>}
            {caffeine.canUndo && <button className="ghost" onClick={() => void caffeine.undoLast()}>Annulla caffeina</button>}
          </div>
        )}
      </footer>

      {sheetOpen && <DrinkSheet userId={userId} units={units} defaultMl={drinkMl} onDrink={onDrink} onClose={() => setSheetOpen(false)} />}
    </main>
  )
}
