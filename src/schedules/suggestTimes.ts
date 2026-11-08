import { inActiveHours, type ActiveHours } from '../domain/activeHours'
import { localParts } from '../domain/time'

/** Quante settimane di bevute si guardano. */
export const LEARN_DAYS = 28
const SLOT_MIN = 30
const MIN_DAYS_WITH_DATA = 7
/** Un'abitudine: almeno 4 giorni e almeno il 40% dei giorni in cui hai segnato qualcosa. */
const MIN_HABIT_DAYS = 4
const MIN_HABIT_SHARE = 0.4
/** Un promemoria entro questa distanza copre già l'abitudine. */
const COVERED_MIN = 45
/** Due proposte più vicine di così sono la stessa abitudine. */
const MIN_GAP_MIN = 60
const MAX_SUGGESTIONS = 3

interface Slot {
  days: Set<string>
  minutes: number[]
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Gli orari in cui bevi di solito ma non ti arriva un promemoria.
 * `drunkAt` sono gli istanti delle bevute (ISO), `reminders` i minuti dei promemoria attivi.
 */
export function suggestTimes(drunkAt: string[], tz: string, reminders: number[], hours?: ActiveHours): number[] {
  const slots = new Map<number, Slot>()
  const allDays = new Set<string>()
  for (const iso of drunkAt) {
    const { date, minutes } = localParts(new Date(iso), tz)
    allDays.add(date)
    const index = Math.floor(minutes / SLOT_MIN)
    const slot = slots.get(index) ?? { days: new Set(), minutes: [] }
    slot.days.add(date)
    slot.minutes.push(minutes)
    slots.set(index, slot)
  }
  if (allDays.size < MIN_DAYS_WITH_DATA) return []

  const threshold = Math.max(MIN_HABIT_DAYS, Math.ceil(allDays.size * MIN_HABIT_SHARE))
  const count = (index: number) => slots.get(index)?.days.size ?? 0
  const habits = [...slots.entries()]
    .filter(([index, slot]) => slot.days.size >= threshold && count(index - 1) <= slot.days.size && count(index + 1) < slot.days.size)
    .map(([index, slot]) => {
      // Le bevute a cavallo di due mezz'ore (10:20 e 10:40) fanno parte della stessa abitudine.
      const near = [index - 1, index, index + 1].flatMap((i) => (count(i) >= threshold ? slots.get(i)!.minutes : []))
      return { minutes: Math.min(1425, Math.round(median(near) / 15) * 15), days: slot.days.size }
    })
    .sort((a, b) => b.days - a.days || a.minutes - b.minutes)

  const picked: number[] = []
  for (const { minutes } of habits) {
    if (picked.length === MAX_SUGGESTIONS) break
    if (hours && !inActiveHours(minutes, hours)) continue
    if (reminders.some((r) => Math.abs(r - minutes) <= COVERED_MIN)) continue
    if (picked.some((p) => Math.abs(p - minutes) < MIN_GAP_MIN)) continue
    picked.push(minutes)
  }
  return picked.sort((a, b) => a - b)
}
