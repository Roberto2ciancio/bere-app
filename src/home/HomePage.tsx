import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { formatTime } from '../domain/format'
import { DEFAULT_DRINK_ML, goalForDate, type GoalChange } from '../domain/goals'
import { nextReminder, type Reminder } from '../domain/reminders'
import { addDays, localParts, weekdayOf } from '../domain/time'
import { CAFFEINE_LIMIT_MG } from '../caffeine/caffeine'
import { MonsterPunishment } from '../caffeine/MonsterPunishment'
import { useCaffeine } from '../caffeine/useCaffeine'
import { DrinkSheet } from '../drinks/DrinkSheet'
import { useDrinks, type DrinkInput } from '../drinks/useDrinks'
import { expectedByNow, formatAmount, formatVolume, HIGH_INTAKE_ML } from '../domain/hydration'
import { pendingOnboardingStep } from '../onboarding/onboardingFlag'
import { pushSupportState } from '../push/subscribe'
import { readCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { listSchedules, toReminders } from '../schedules/schedulesApi'
import { BottleView } from './BottleView'
import { CharacterView } from './CharacterView'
import { DropsView } from './DropsView'
import { RingView } from './RingView'
import { playBuzzer, playSound } from './sounds'
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
  const [punished, setPunished] = useState(false)
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
  const goalMl = goalForDate(goals, today)
  const { totalMl, pending, canUndo, drink, undoLast } = useDrinks(userId, today, tz, drinkMl)
  const caffeine = useCaffeine(userId, today, tz)
  const next = reminders ? nextReminder(reminders, now, tz) : null
  const View = VIEWS[profile?.home_style ?? 'bottle'] ?? BottleView

  function onDrink(input?: DrinkInput) {
    if (!drink(input)) return
    setSheetOpen(false)
    setPulse((p) => p + 1)
    playSound(profile?.sound ?? 'goccia')
  }

  function onMonster() {
    if (!caffeine.add('monster')) return
    setPunished(true)
    playBuzzer(profile?.sound ?? 'goccia')
    navigator.vibrate?.([200, 80, 400])
  }

  // La quantità viene dal profilo: non si segna nulla finché non è disponibile.
  if (!profile) {
    return <p className="center-note">{loading ? 'Caricamento…' : 'Profilo non disponibile. Controlla la connessione e riapri l\'app.'}</p>
  }

  const units = profile.units
  const parts = localParts(now, tz)
  const todayMinutes = (reminders ?? []).filter((r) => r.weekdays.includes(weekdayOf(today))).map((r) => r.minutes)
  const expected = expectedByNow(todayMinutes, goalMl, parts.minutes)
  const behind = expected !== null && totalMl < goalMl ? expected - totalMl : 0

  return (
    <main className="home">
      <header className="home-head">
        <p className="home-total" aria-live="polite">{formatVolume(totalMl, units)}</p>
        <p className="home-goal">
          {totalMl >= goalMl ? `Obiettivo raggiunto: su ${formatVolume(goalMl, units)}` : `su ${formatVolume(goalMl, units)}`}
          {expected !== null && totalMl < goalMl && (behind > 0 ? ` · ${formatVolume(behind, units)} per essere in pari` : ' · sei in pari')}
        </p>
        {totalMl >= HIGH_INTAKE_ML && (
          <p className="error">Oggi hai bevuto molto: bere troppo in poco tempo può far male. Se non stai bene, chiedi a un medico.</p>
        )}
      </header>

      <div className="home-view">
        <View totalMl={totalMl} goalMl={goalMl} drinkMl={drinkMl} pulse={pulse} />
      </div>

      <footer className="home-actions">
        {(pending || caffeine.pending) && <p className="hint" role="status">Salvata sul telefono: la invio appena torna la rete.</p>}
        {next && <p className="home-next">Prossimo promemoria {describeNext(next, today)}</p>}
        {reminders && !next && <Link className="home-next" to="/promemoria">Imposta i promemoria</Link>}
        {pushSupportState() !== 'granted' && <Link className="home-next" to="/notifiche">Attiva le notifiche</Link>}
        <div className="drink-row">
          <button className="primary drink" onClick={() => onDrink()}>Ho bevuto · {formatAmount(drinkMl, units)}</button>
          <button className="secondary drink-more" aria-label="Altra bevanda" onClick={() => setSheetOpen(true)}>+</button>
        </div>

        <section className="caffeine" aria-label="Caffeina">
          <div className="caffeine-tiles">
            <button className="caffeine-tile caffeine-tile-special" aria-label={`Red Bull, ${caffeine.redBulls} oggi. Aggiungi`} onClick={() => caffeine.add('redbull')}>
              <span key={caffeine.redBulls} className="caffeine-count">{caffeine.redBulls}</span>
              <span>Red Bull</span>
            </button>
            <button className="caffeine-tile" aria-label={`Caffè, ${caffeine.coffees} oggi. Aggiungi`} onClick={() => caffeine.add('coffee')}>
              <span key={caffeine.coffees} className="caffeine-count">{caffeine.coffees}</span>
              <span>Caffè</span>
            </button>
            <button className="caffeine-tile caffeine-tile-monster" aria-label={`Monster, ${caffeine.monsters} oggi. Aggiungi`} onClick={onMonster}>
              <span key={caffeine.monsters} className="caffeine-count">{caffeine.monsters}</span>
              <span>Monster</span>
            </button>
          </div>
          <p className={caffeine.overLimit ? 'caffeine-total error' : 'caffeine-total'}>
            {caffeine.overLimit
              ? `${caffeine.totalMg} mg di caffeina: oltre i ${CAFFEINE_LIMIT_MG} di riferimento`
              : `${caffeine.totalMg} mg di caffeina su ${CAFFEINE_LIMIT_MG}`}
          </p>
        </section>

        {(canUndo || caffeine.canUndo) && (
          <div className="home-undos">
            {canUndo && <button className="ghost" onClick={() => void undoLast()}>Annulla l'ultima</button>}
            {caffeine.canUndo && <button className="ghost" onClick={() => void caffeine.undoLast()}>Annulla caffeina</button>}
          </div>
        )}
      </footer>

      {punished && <MonsterPunishment onClose={() => setPunished(false)} />}
      {sheetOpen && <DrinkSheet userId={userId} units={units} defaultMl={drinkMl} onDrink={onDrink} onClose={() => setSheetOpen(false)} />}
    </main>
  )
}
