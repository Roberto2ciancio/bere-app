import { goalForDate, type GoalChange } from '../domain/goals'
import { addDays } from '../domain/time'

export interface DayTotal {
  day: string
  total_ml: number
  drinks: number
}

export interface DayResult {
  day: string
  totalMl: number
  goalMl: number
  met: boolean
}

export interface Stats {
  totalMl: number
  drinks: number
  daysTracked: number
  completionRate: number
  bestStreak: number
  currentStreak: number
  averageMl: number
  lowDays: number
}

const isMet = (total: number, goal: number) => total >= goal

export function dayResults(totals: DayTotal[], goals: GoalChange[], today: string, count: number): DayResult[] {
  const byDay = new Map(totals.map((t) => [t.day, t.total_ml]))
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(today, i - count + 1)
    const totalMl = byDay.get(day) ?? 0
    const goalMl = goalForDate(goals, day)
    return { day, totalMl, goalMl, met: isMet(totalMl, goalMl) }
  })
}

export function computeStats(totals: DayTotal[], goals: GoalChange[], today: string): Stats {
  const sorted = [...totals].sort((a, b) => a.day.localeCompare(b.day))
  const metDays = new Set(sorted.filter((t) => isMet(t.total_ml, goalForDate(goals, t.day))).map((t) => t.day))

  let bestStreak = 0
  let run = 0
  let previous: string | null = null
  for (const day of [...metDays]) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1
    bestStreak = Math.max(bestStreak, run)
    previous = day
  }

  // Oggi può ancora arrivare all'obiettivo: se non è raggiunto, la serie si conta da ieri.
  let currentStreak = 0
  let cursor = metDays.has(today) ? today : addDays(today, -1)
  while (metDays.has(cursor)) {
    currentStreak += 1
    cursor = addDays(cursor, -1)
  }

  const totalMl = sorted.reduce((sum, t) => sum + t.total_ml, 0)
  const daysTracked = sorted.length
  return {
    totalMl,
    drinks: sorted.reduce((sum, t) => sum + t.drinks, 0),
    daysTracked,
    completionRate: daysTracked ? Math.round((metDays.size / daysTracked) * 100) : 0,
    bestStreak,
    currentStreak,
    averageMl: daysTracked ? Math.round(totalMl / daysTracked) : 0,
    lowDays: sorted.filter((t) => t.total_ml < goalForDate(goals, t.day) / 2).length,
  }
}

export interface Achievement {
  id: string
  label: string
  description: string
  earned: boolean
}

export function achievements(stats: Stats): Achievement[] {
  const list: [string, string, string, boolean][] = [
    ['first-drink', 'Prima bevuta', 'Hai segnato la tua prima bevuta', stats.drinks >= 1],
    ['first-goal', 'Primo obiettivo', 'Hai raggiunto il tuo obiettivo per la prima volta', stats.bestStreak >= 1],
    ['streak-3', 'Tre di fila', 'Obiettivo raggiunto 3 giorni di seguito', stats.bestStreak >= 3],
    ['streak-7', 'Settimana piena', 'Obiettivo raggiunto 7 giorni di seguito', stats.bestStreak >= 7],
    ['streak-30', 'Un mese intero', 'Obiettivo raggiunto 30 giorni di seguito', stats.bestStreak >= 30],
    ['liters-10', '10 litri', 'Hai bevuto 10 litri in tutto', stats.totalMl >= 10_000],
    ['liters-100', '100 litri', 'Hai bevuto 100 litri in tutto', stats.totalMl >= 100_000],
    ['liters-500', '500 litri', 'Hai bevuto 500 litri in tutto', stats.totalMl >= 500_000],
    ['drinks-100', '100 bevute', 'Hai segnato 100 bevute', stats.drinks >= 100],
  ]
  return list.map(([id, label, description, earned]) => ({ id, label, description, earned }))
}

export interface Challenge {
  id: string
  label: string
  progress: number
  target: number
  done: boolean
}

export function challenges(totals: DayTotal[], goals: GoalChange[], weekStart: string, today: string): Challenge[] {
  const week = totals.filter((t) => t.day >= weekStart && t.day <= today)
  const stats = computeStats(week, goals, today)
  const metDays = week.filter((t) => isMet(t.total_ml, goalForDate(goals, t.day))).length
  const make = (id: string, label: string, value: number, target: number): Challenge => ({
    id,
    label,
    progress: Math.min(value, target),
    target,
    done: value >= target,
  })
  return [
    make('five-days', 'Raggiungi il tuo obiettivo 5 giorni', metDays, 5),
    make('three-row', 'Raggiungilo 3 giorni di fila', stats.bestStreak, 3),
    make('liters', 'Bevi 15 litri', Math.floor(stats.totalMl / 1000), 15),
  ]
}
