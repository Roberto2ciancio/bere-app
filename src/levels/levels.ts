import { addDays, weekdayOf } from '../domain/time'

/**
 * Punti (stesse regole della funzione SQL get_levels, migrazione 0022):
 * - 1 punto ogni 100 ml d'acqua equivalente, fino all'obiettivo del giorno (oltre non conta: bere troppo non premia);
 * - +20 per ogni giorno con l'obiettivo raggiunto;
 * - +50 per una settimana (lunedì–domenica) con almeno 5 giorni a obiettivo, +150 se sono tutti e 7.
 * Come in classifica, gli obiettivi sotto 1,5 L non danno bonus.
 */
export const POINTS = { perMl: 100, goalDay: 20, week5: 50, week7: 150, minGoalMl: 1500 } as const

export interface DayInput {
  day: string
  totalMl: number
  goalMl: number
}

const isMet = (d: DayInput) => d.totalMl >= d.goalMl && d.goalMl >= POINTS.minGoalMl

export function pointsFromDays(days: DayInput[]): number {
  const metByWeek = new Map<string, number>()
  let points = 0
  for (const d of days) {
    points += Math.floor(Math.min(d.totalMl, d.goalMl) / POINTS.perMl)
    if (isMet(d)) {
      points += POINTS.goalDay
      const monday = addDays(d.day, 1 - weekdayOf(d.day))
      metByWeek.set(monday, (metByWeek.get(monday) ?? 0) + 1)
    }
  }
  for (const met of metByWeek.values()) points += met >= 7 ? POINTS.week7 : met >= 5 ? POINTS.week5 : 0
  return points
}

/** Punti per arrivare al livello n: 0, 100, 300, 600, 1000… (ogni livello chiede 100 punti in più del precedente). */
export const pointsForLevel = (level: number) => 50 * (level - 1) * level

const TIERS: [from: number, name: string, emoji: string][] = [
  [1, 'Goccia', '💧'],
  [3, 'Sorso', '🥤'],
  [5, 'Ruscello', '🏞️'],
  [8, 'Fiume', '🌊'],
  [12, 'Lago', '🏔️'],
  [16, 'Mare', '⛵'],
  [20, 'Oceano', '🐋'],
]

export interface Level {
  level: number
  name: string
  emoji: string
  points: number
  /** Punti all'inizio di questo livello e all'inizio del prossimo. */
  from: number
  to: number
  /** Punti che mancano al prossimo livello. */
  missing: number
  /** Da 0 a 100: quanto manca al prossimo livello. */
  progress: number
}

export function levelOf(points: number): Level {
  const safe = Math.max(0, Math.floor(points))
  let level = 1
  while (pointsForLevel(level + 1) <= safe) level += 1
  const [, name, emoji] = [...TIERS].reverse().find(([from]) => level >= from) ?? TIERS[0]
  const from = pointsForLevel(level)
  const to = pointsForLevel(level + 1)
  return { level, name, emoji, points: safe, from, to, missing: to - safe, progress: Math.floor(((safe - from) / (to - from)) * 100) }
}
