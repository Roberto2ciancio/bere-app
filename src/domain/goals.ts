import { addDays, localParts } from './time'

export const DEFAULT_GOAL_ML = 3000
export const DEFAULT_DRINK_ML = 200
export const LEADERBOARD_MIN_GOAL_ML = 1500

export interface GoalChange {
  effectiveFrom: string
  goalMl: number
}

export function goalForDate(changes: GoalChange[], date: string): number {
  let current: GoalChange | null = null
  for (const change of changes) {
    if (change.effectiveFrom <= date && (!current || change.effectiveFrom > current.effectiveFrom)) {
      current = change
    }
  }
  return current ? current.goalMl : DEFAULT_GOAL_ML
}

export function goalChangeDate(now: Date, tz: string): string {
  return addDays(localParts(now, tz).date, 1)
}

/** Interpreta i litri scritti dall'utente, con punto o virgola; null se fuori dai limiti. */
export function parseGoalLiters(text: string): number | null {
  const liters = Number(text.trim().replace(',', '.'))
  if (!Number.isFinite(liters) || liters < 0.1 || liters > 10) return null
  return Math.round(liters * 1000)
}
