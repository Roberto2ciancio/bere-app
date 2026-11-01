import { useState, type FormEvent } from 'react'
import { formatLiters, formatTime } from '../domain/format'
import { DayPicker } from './DayPicker'
import { DEFAULT_INTERVAL, IntervalFields, intervalError, intervalTimes, toClock, type IntervalValue } from './IntervalFields'
import type { ScheduleDraft } from './schedulesApi'

interface Props {
  initial: ScheduleDraft
  drinkMl: number
  goalMl: number
  onSave(draft: ScheduleDraft): Promise<void>
  onDelete?: () => Promise<void>
  onClose(): void
}

function startingInterval(minutes: number[]): IntervalValue {
  if (minutes.length < 2) return DEFAULT_INTERVAL
  return { ...DEFAULT_INTERVAL, from: toClock(minutes[0]), to: toClock(minutes.at(-1)!) }
}

export function ScheduleEditor({ initial, drinkMl, goalMl, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState(initial)
  const [newTime, setNewTime] = useState('')
  const [rhythm, setRhythm] = useState(() => startingInterval(initial.minutes))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const change = (patch: Partial<ScheduleDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError(null)
  }

  function addTime() {
    const [h, m] = newTime.split(':').map(Number)
    if (!newTime || Number.isNaN(h) || Number.isNaN(m)) return setError("Scegli un orario prima di aggiungerlo")
    const minutes = h * 60 + m
    if (draft.minutes.includes(minutes)) return setError('Questo orario è già presente')
    change({ minutes: [...draft.minutes, minutes].sort((a, b) => a - b) })
    setNewTime('')
  }

  function applyRhythm() {
    const problem = intervalError(rhythm)
    if (problem) return setError(problem)
    change({ minutes: intervalTimes(rhythm) })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.name.trim()) return setError('Dai un nome al programma')
    if (draft.weekdays.length === 0) return setError('Scegli almeno un giorno')
    if (draft.minutes.length === 0) return setError('Aggiungi almeno un orario')
    setBusy(true)
    try {
      await onSave({ ...draft, name: draft.name.trim() })
    } catch {
      setError('Salvataggio non riuscito. Controlla la connessione e riprova')
      setBusy(false)
    }
  }

  return (
    <form className="section" onSubmit={submit} noValidate>
      <div className="stack">
        <label>
          Nome del programma
          <input maxLength={60} value={draft.name} onChange={(e) => change({ name: e.target.value })} />
        </label>
      </div>

      <DayPicker value={draft.weekdays} onChange={(weekdays) => change({ weekdays })} />

      <details className="interval-fill">
        <summary>Riempi a intervalli</summary>
        <div className="section">
          <IntervalFields
            value={rhythm}
            onChange={(next) => {
              setRhythm(next)
              setError(null)
            }}
          />
          <button type="button" className="secondary" onClick={applyRhythm}>Usa questi orari</button>
        </div>
      </details>

      <ul className="choices" aria-label="Orari" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {draft.minutes.map((minutes) => (
          <li key={minutes}>
            <button
              type="button"
              className="choice num"
              aria-label={`Togli ${formatTime(minutes)}`}
              onClick={() => change({ minutes: draft.minutes.filter((m) => m !== minutes) })}
            >
              {formatTime(minutes)} ×
            </button>
          </li>
        ))}
      </ul>

      <div className="row">
        <input
          type="time"
          aria-label="Nuovo orario"
          value={newTime}
          onChange={(e) => {
            setNewTime(e.target.value)
            setError(null)
          }}
        />
        <button type="button" className="secondary" onClick={addTime}>Aggiungi orario</button>
      </div>

      <p className="hint">
        {draft.minutes.length} promemoria × {drinkMl} ml = {formatLiters(draft.minutes.length * drinkMl)} su {formatLiters(goalMl)}
      </p>

      {error && <p role="alert" className="error">{error}</p>}

      <button className="primary" disabled={busy}>Salva programma</button>
      <button type="button" className="ghost" onClick={onClose}>Chiudi</button>
      {onDelete && <button type="button" className="ghost" onClick={() => void onDelete()}>Elimina programma</button>}
    </form>
  )
}
