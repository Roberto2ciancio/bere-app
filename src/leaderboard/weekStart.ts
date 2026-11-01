import { addDays, localParts } from '../domain/time'

/** Lunedì della settimana corrente, nel fuso dell'utente. */
export function weekStart(now: Date, tz: string): string {
  const { date, weekday } = localParts(now, tz)
  return addDays(date, 1 - weekday)
}
