import { addDays } from '../domain/time'

export interface PausePeriod {
  id: string
  start_date: string
  end_date: string
}

export const PAUSE_CHOICES = [1, 3, 7, 14] as const
export const MAX_PAUSE_DAYS = 30

/** La pausa in corso oggi, se c'è. */
export function currentPause(periods: PausePeriod[], today: string): PausePeriod | null {
  return periods.find((p) => p.start_date <= today && today <= p.end_date) ?? null
}

/** Una pausa di `days` giorni comprende oggi: «1 giorno» vale fino a stasera. */
export function pauseRange(today: string, days: number): { start_date: string; end_date: string } {
  const length = Math.min(Math.max(Math.round(days), 1), MAX_PAUSE_DAYS)
  return { start_date: today, end_date: addDays(today, length - 1) }
}

/** Tutti i giorni in pausa fino a oggi compreso: la serie li salta. */
export function pausedDays(periods: PausePeriod[], today: string): Set<string> {
  const days = new Set<string>()
  for (const p of periods) {
    for (let day = p.start_date; day <= p.end_date && day <= today; day = addDays(day, 1)) days.add(day)
  }
  return days
}

/** «fino a domenica 15 novembre» o «fino a stasera». */
export function pauseEndLabel(end: string, today: string): string {
  if (end === today) return 'fino a stasera'
  if (end === addDays(today, 1)) return 'fino a domani sera'
  const date = new Date(`${end}T12:00:00Z`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return `fino a ${date} compreso`
}
