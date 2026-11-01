import { intervalLabel, intervalMinutes, MAX_INTERVAL, MIN_INTERVAL } from '../domain/intervals'

const PRESETS = [30, 60, 90, 120, 180]

export interface IntervalValue {
  every: number
  custom: boolean
  from: string
  to: string
}

export const DEFAULT_INTERVAL: IntervalValue = { every: 60, custom: false, from: '08:00', to: '22:00' }

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export const toClock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export function intervalError(value: IntervalValue): string | null {
  if (!(value.every >= MIN_INTERVAL && value.every <= MAX_INTERVAL)) return `L'intervallo deve essere tra ${MIN_INTERVAL} e ${MAX_INTERVAL} minuti`
  if (!value.from || !value.to) return "Scegli l'ora di inizio e quella di fine"
  if (toMinutes(value.to) <= toMinutes(value.from)) return "L'ora di fine deve essere dopo quella di inizio"
  return null
}

export function intervalTimes(value: IntervalValue): number[] {
  if (intervalError(value)) return []
  return intervalMinutes(toMinutes(value.from), toMinutes(value.to), value.every)
}

export function IntervalFields({ value, onChange }: { value: IntervalValue; onChange(next: IntervalValue): void }) {
  return (
    <>
      <div className="choices" role="group" aria-label="Ogni quanto">
        {PRESETS.map((every) => (
          <button
            key={every}
            type="button"
            className="choice"
            aria-pressed={!value.custom && value.every === every}
            onClick={() => onChange({ ...value, every, custom: false })}
          >
            {intervalLabel(every)}
          </button>
        ))}
        <button type="button" className="choice" aria-pressed={value.custom} onClick={() => onChange({ ...value, custom: true })}>
          Altro
        </button>
      </div>

      {value.custom && (
        <label className="interval-field">
          Minuti
          <input
            type="number"
            inputMode="numeric"
            min={MIN_INTERVAL}
            max={MAX_INTERVAL}
            value={Number.isNaN(value.every) ? '' : value.every}
            onChange={(e) => onChange({ ...value, every: e.target.valueAsNumber })}
          />
        </label>
      )}

      <div className="interval-window">
        <label className="interval-field">
          Dalle
          <input type="time" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
        </label>
        <label className="interval-field">
          Alle
          <input type="time" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </label>
      </div>
    </>
  )
}
