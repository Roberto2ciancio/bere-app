import { addDays, localParts, weekdayOf } from './time.ts'

export interface Reminder {
  weekdays: number[]
  minutes: number
}

const MINUTE_MS = 60_000

/** Data locale prevista e minuti di ritardo, se il promemoria è scaduto da meno di `windowMin` minuti. */
export function dueLateness(reminder: Reminder, now: Date, tz: string, windowMin: number): { date: string; late: number } | null {
  for (let late = 0; late < windowMin; late++) {
    const { date, minutes, weekday } = localParts(new Date(now.getTime() - late * MINUTE_MS), tz)
    if (minutes === reminder.minutes && reminder.weekdays.includes(weekday)) return { date, late }
  }
  return null
}

export function isDue(reminder: Reminder, now: Date, tz: string, windowMin = 5): string | null {
  return dueLateness(reminder, now, tz, windowMin)?.date ?? null
}

export function nextReminder(reminders: Reminder[], now: Date, tz: string): { date: string; minutes: number } | null {
  const today = localParts(now, tz)
  for (let offset = 0; offset <= 7; offset++) {
    const date = addDays(today.date, offset)
    const weekday = weekdayOf(date)
    const candidates = reminders
      .filter((r) => r.weekdays.includes(weekday) && (offset > 0 || r.minutes > today.minutes))
      .map((r) => r.minutes)
    if (candidates.length > 0) return { date, minutes: Math.min(...candidates) }
  }
  return null
}
