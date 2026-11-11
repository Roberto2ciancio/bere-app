import { useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useProfile } from '../../auth/ProfileProvider'
import { formatLiters } from '../../domain/format'
import { suggestGoal, type Activity } from '../../domain/hydration'
import { CountUp } from '../../ui/motion/CountUp'
import { setInitialGoal } from '../initialGoal'
import { OnboardingShell } from '../OnboardingShell'

const ACTIVITY_CHOICES: { id: Activity; icon: string; label: string }[] = [
  { id: 'sedentary', icon: '🛋️', label: 'Tranquilla' },
  { id: 'light', icon: '🚶', label: 'Normale' },
  { id: 'moderate', icon: '🏃', label: 'Sportiva' },
]
const MIN_KG = 30
const MAX_KG = 200
const DEFAULT_KG = 70
const MIN_GOAL = 1000
const MAX_GOAL = 6000
const SKIP_GOAL_ML = 2000
const SAVE_ERROR = 'Salvataggio non riuscito. Controlla la connessione e riprova.'

const parseKg = (text: string) => Number(text.trim().replace(',', '.'))
const isValidKg = (kg: number) => Number.isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG

interface Props {
  tz: string
  onGoal: (goalMl: number) => void
  onNext: () => void
}

export function GoalStep({ tz, onGoal, onNext }: Props) {
  const { user } = useAuth()
  const { profile, saveProfile } = useProfile()
  const userId = user?.id ?? null
  const [weightText, setWeightText] = useState(String(profile?.weight_kg ?? DEFAULT_KG))
  const [activity, setActivity] = useState<Activity>(() => ACTIVITY_CHOICES.find((a) => a.id === profile?.activity)?.id ?? 'light')
  const kg = parseKg(weightText)
  const validWeight = isValidKg(kg)
  const [goal, setGoal] = useState(() => suggestGoal(validWeight ? kg : DEFAULT_KG, activity, false))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tomorrow, setTomorrow] = useState(false)

  // Ogni cambio di peso o attività rifà il calcolo: i ritocchi di ±100 ml valgono per l'ultimo.
  function recalc(nextKg: number, nextActivity: Activity) {
    setTomorrow(false)
    if (isValidKg(nextKg)) setGoal(suggestGoal(nextKg, nextActivity, false))
  }
  function changeWeight(text: string) {
    setWeightText(text)
    recalc(parseKg(text), activity)
  }
  function stepWeight(delta: number) {
    const next = Math.min(MAX_KG, Math.max(MIN_KG, Math.round(validWeight ? kg : DEFAULT_KG) + delta))
    changeWeight(String(next))
  }
  function pickActivity(next: Activity) {
    setActivity(next)
    recalc(kg, next)
  }
  function tweak(delta: number) {
    setTomorrow(false)
    setGoal((g) => Math.min(MAX_GOAL, Math.max(MIN_GOAL, g + delta)))
  }

  async function next() {
    if (tomorrow) return onNext()
    if (!userId || !validWeight) return
    setBusy(true)
    setError(null)
    try {
      if (!(await saveProfile({ weight_kg: kg, activity }))) throw new Error('profilo')
      const when = await setInitialGoal(userId, goal, tz)
      onGoal(goal)
      // Da domani: il fumetto lo dice e il prossimo tocco prosegue.
      if (when === 'tomorrow') setTomorrow(true)
      else onNext()
    } catch {
      setError(SAVE_ERROR)
    }
    setBusy(false)
  }

  async function skip() {
    if (userId) {
      try {
        await setInitialGoal(userId, SKIP_GOAL_ML, tz)
        onGoal(SKIP_GOAL_ML)
      } catch {
        // Resta l'obiettivo di partenza: si cambia dal Profilo.
      }
    }
    onNext()
  }

  const say = tomorrow
    ? `Da domani punteremo a ${formatLiters(goal)}`
    : validWeight
      ? `Per te: ${formatLiters(goal)} al giorno`
      : 'Quanto pesi? Ti dico quanta acqua serve'

  return (
    <OnboardingShell
      step="goal"
      mood={validWeight ? 'almost' : 'idle'}
      say={say}
      onNext={() => void next()}
      onSkip={() => void skip()}
      nextLabel="Avanti"
      nextDisabled={busy || !validWeight}
    >
      <div className="ob-goal">
        <div className="ob-field">
          <span id="ob-weight-label" className="ob-label">Peso (kg)</span>
          <div className="ob-stepper">
            <button type="button" className="secondary" aria-label="Meno peso" onClick={() => stepWeight(-1)}>−</button>
            <input aria-labelledby="ob-weight-label" inputMode="decimal" value={weightText} onChange={(e) => changeWeight(e.target.value)} />
            <button type="button" className="secondary" aria-label="Più peso" onClick={() => stepWeight(1)}>+</button>
          </div>
        </div>
        <div className="ob-field">
          <span id="ob-activity-label" className="ob-label">Quanto ti muovi?</span>
          <div className="ob-activities" role="group" aria-labelledby="ob-activity-label">
            {ACTIVITY_CHOICES.map((a) => (
              <button key={a.id} type="button" className="ob-activity" aria-pressed={activity === a.id} onClick={() => pickActivity(a.id)}>
                <span aria-hidden="true">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ob-field">
          <span id="ob-goal-label" className="ob-label">Obiettivo giornaliero</span>
          <div className="ob-stepper">
            <button type="button" className="secondary" aria-label="Meno acqua" disabled={goal <= MIN_GOAL} onClick={() => tweak(-100)}>−</button>
            <output className="ob-goal-value num" aria-labelledby="ob-goal-label">
              <CountUp value={goal} format={formatLiters} />
            </output>
            <button type="button" className="secondary" aria-label="Più acqua" disabled={goal >= MAX_GOAL} onClick={() => tweak(100)}>+</button>
          </div>
        </div>
        {error && <p role="alert" className="error">{error}</p>}
      </div>
    </OnboardingShell>
  )
}
