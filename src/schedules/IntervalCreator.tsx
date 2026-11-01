import { useState, type FormEvent } from 'react'
import { formatLiters, formatTime } from '../domain/format'
import { intervalLabel } from '../domain/intervals'
import { DayPicker } from './DayPicker'
import { DEFAULT_INTERVAL, IntervalFields, intervalError, intervalTimes } from './IntervalFields'
import type { ScheduleDraft } from './schedulesApi'

interface Props {
  activeWeekdays: number[][]
  drinkMl: number
  goalMl: number
  onCreate(draft: ScheduleDraft, disableOthers: boolean): Promise<void>
  onManual(): void
  onCancel?: () => void
}

function preview(times: number[]): string {
  if (times.length <= 4) return times.map(formatTime).join(', ')
  return `${times.slice(0, 3).map(formatTime).join(', ')} … ${formatTime(times.at(-1)!)}`
}

export function IntervalCreator({ activeWeekdays, drinkMl, goalMl, onCreate, onManual, onCancel }: Props) {
  const [rhythm, setRhythm] = useState(DEFAULT_INTERVAL)
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5, 6, 7])
  const [disableOthers, setDisableOthers] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const times = intervalTimes(rhythm)
  const overlaps = activeWeekdays.some((days) => days.some((d) => weekdays.includes(d)))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = intervalError(rhythm) ?? (weekdays.length === 0 ? 'Scegli almeno un giorno' : null)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      await onCreate({ name: `Ogni ${intervalLabel(rhythm.every)}`, weekdays, enabled: true, minutes: times }, overlaps && disableOthers)
    } catch {
      setError('Salvataggio non riuscito. Controlla la connessione e riprova')
      setBusy(false)
    }
  }

  return (
    <form className="section" onSubmit={submit} noValidate>
      <h2>Ricordamelo ogni…</h2>
      <IntervalFields
        value={rhythm}
        onChange={(next) => {
          setRhythm(next)
          setError(null)
        }}
      />
      <DayPicker
        value={weekdays}
        onChange={(next) => {
          setWeekdays(next)
          setError(null)
        }}
      />

      {times.length > 0 && (
        <>
          <p className="hint num">{preview(times)}</p>
          <p className="hint">
            {times.length} promemoria × {drinkMl} ml = {formatLiters(times.length * drinkMl)} su {formatLiters(goalMl)}
          </p>
        </>
      )}

      {overlaps && (
        <label className="row">
          Disattiva gli altri programmi, per non ricevere notifiche doppie
          <input type="checkbox" checked={disableOthers} onChange={(e) => setDisableOthers(e.target.checked)} />
        </label>
      )}

      {error && <p role="alert" className="error">{error}</p>}
      <button className="primary" disabled={busy}>Crea promemoria</button>
      <button type="button" className="ghost" onClick={onManual}>Preferisco scegliere gli orari a mano</button>
      {onCancel && <button type="button" className="ghost" onClick={onCancel}>Annulla</button>}
    </form>
  )
}
