import { formatTime } from '../domain/format'
import { describeDays } from '../domain/intervals'
import type { Schedule } from './schedulesApi'

function describe(schedule: Schedule): string {
  const minutes = schedule.times.map((t) => t.minutes).sort((a, b) => a - b)
  const days = describeDays(schedule.weekdays)
  if (minutes.length === 0) return `${days} · nessun orario`
  if (minutes.length === 1) return `${days} · 1 promemoria · ${formatTime(minutes[0])}`
  return `${days} · ${minutes.length} promemoria · ${formatTime(minutes[0])}-${formatTime(minutes.at(-1)!)}`
}

interface Props {
  schedule: Schedule
  onToggle(enabled: boolean): void
  onEdit(): void
}

export function ScheduleCard({ schedule, onToggle, onEdit }: Props) {
  return (
    <li className={schedule.enabled ? 'schedule-card' : 'schedule-card off'}>
      <input
        type="checkbox"
        aria-label={`${schedule.name} attivo`}
        checked={schedule.enabled}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span className="grow">
        <strong>{schedule.name}</strong>
        <span className="hint schedule-summary">{describe(schedule)}</span>
      </span>
      <button className="ghost" aria-label={`Modifica ${schedule.name}`} onClick={onEdit}>Modifica</button>
    </li>
  )
}
