import { useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useProfile } from '../../auth/ProfileProvider'
import { activeHoursError, MIN_ACTIVE_MINUTES } from '../../domain/activeHours'
import { formatLiters, formatTime } from '../../domain/format'
import { intervalLabel, intervalMinutes } from '../../domain/intervals'
import { ScheduleEditor } from '../../schedules/ScheduleEditor'
import { saveSchedule, type ScheduleDraft } from '../../schedules/schedulesApi'
import { OnboardingShell } from '../OnboardingShell'

const STEP_MIN = 30
const DAY_END = 24 * 60 - STEP_MIN
const DEFAULT_START = 8 * 60
const DEFAULT_END = 22 * 60
const EVERY_MIN = 30
const EVERY_MAX = 180
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7]
const SAVE_ERROR = 'Salvataggio non riuscito. Controlla la connessione e riprova.'

/** Ritmo regolare (multiplo di 30 min) che porta in fascia i bicchieri dell'obiettivo. */
function suggestEvery(start: number, end: number, goalMl: number, drinkMl: number): number {
  const drinks = Math.max(1, Math.ceil(goalMl / drinkMl))
  const raw = Math.round((end - start) / drinks / STEP_MIN) * STEP_MIN
  return Math.min(EVERY_MAX, Math.max(EVERY_MIN, raw))
}

function Sun() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ob-sun">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  )
}

function Moon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ob-moon">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </svg>
  )
}

interface Props {
  goalMl: number
  onNext: () => void
}

export function ScheduleStep({ goalMl, onNext }: Props) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const userId = user?.id ?? null
  const drinkMl = profile?.drink_ml ?? 200
  const [start, setStart] = useState(DEFAULT_START)
  const [end, setEnd] = useState(DEFAULT_END)
  const [manual, setManual] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const every = suggestEvery(start, end, goalMl, drinkMl)
  const times = intervalMinutes(start, end, every)
  const problem = activeHoursError(start, end)

  // Sveglia e sonno restano a un'ora almeno l'uno dall'altro.
  const changeStart = (value: number) => setStart(Math.min(value, end - MIN_ACTIVE_MINUTES))
  const changeEnd = (value: number) => setEnd(Math.max(value, start + MIN_ACTIVE_MINUTES))

  async function save(draft: ScheduleDraft) {
    if (!userId) return
    await saveSchedule(userId, draft)
    onNext()
  }

  async function create() {
    if (problem || times.length === 0) return setError(problem ?? SAVE_ERROR)
    setBusy(true)
    setError(null)
    try {
      await save({ name: `Ogni ${intervalLabel(every)}`, weekdays: ALL_DAYS, enabled: true, minutes: times })
    } catch {
      setError(SAVE_ERROR)
      setBusy(false)
    }
  }

  if (manual) {
    return (
      <main className="page">
        <h1>Quando vuoi bere?</h1>
        <ScheduleEditor
          initial={{ name: '', weekdays: ALL_DAYS, enabled: true, minutes: [] }}
          drinkMl={drinkMl}
          goalMl={goalMl}
          onSave={save}
          onClose={() => setManual(false)}
        />
      </main>
    )
  }

  const pos = (minutes: number) => `calc(14px + (100% - 28px) * ${minutes / DAY_END})`
  return (
    <OnboardingShell
      step="schedule"
      mood="idle"
      say={problem ? 'La giornata deve durare almeno un’ora' : `Ti ricordo ogni ${intervalLabel(every)}, ${times.length} volte al giorno`}
      onNext={() => void create()}
      onSkip={onNext}
      nextLabel="Crea i promemoria"
      nextDisabled={busy || Boolean(problem) || times.length === 0}
    >
      <div className="ob-schedule">
        <h1 className="ob-title" tabIndex={-1}>Quando vuoi bere?</h1>
        <div className="ob-sky" aria-hidden="true">
          <div className="ob-sky-band" style={{ left: pos(start), right: `calc(100% - ${pos(end)})` }} />
          <span className="ob-sky-icon" style={{ left: pos(start) }}><Sun /></span>
          <span className="ob-sky-icon" style={{ left: pos(end) }}><Moon /></span>
        </div>
        <label className="ob-field">
          <span className="ob-label">Mi sveglio · <span className="num">{formatTime(start)}</span></span>
          <input type="range" min={0} max={DAY_END} step={STEP_MIN} value={start} aria-valuetext={formatTime(start)} onChange={(e) => changeStart(Number(e.target.value))} />
        </label>
        <label className="ob-field">
          <span className="ob-label">Vado a dormire · <span className="num">{formatTime(end)}</span></span>
          <input type="range" min={0} max={DAY_END} step={STEP_MIN} value={end} aria-valuetext={formatTime(end)} onChange={(e) => changeEnd(Number(e.target.value))} />
        </label>
        {times.length > 0 && (
          <p className="hint">
            {times.length} promemoria × {drinkMl} ml = {formatLiters(times.length * drinkMl)} su {formatLiters(goalMl)}
          </p>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <button type="button" className="ghost" onClick={() => setManual(true)}>Scelgo io gli orari</button>
      </div>
    </OnboardingShell>
  )
}
