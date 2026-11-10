import { type GoalChange } from '../domain/goals'
import { goalWithBoosts } from '../goal/boosts'
import { addDays, weekdayOf } from '../domain/time'

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
  /** Giorni consecutivi più lunghi senza scendere sotto metà obiettivo (un giorno senza bevute conta come sotto). */
  bestHalfRun: number
  /** Giorni mancati coperti dal salva-serie. */
  savedDays: Set<string>
}

const isMet = (total: number, goal: number) => total >= goal

/** boosts: aumenti per giorno (caldo, allenamento) da sommare all'obiettivo scelto. */
export function dayResults(totals: DayTotal[], goals: GoalChange[], today: string, count: number, boosts?: Map<string, number>): DayResult[] {
  const byDay = new Map(totals.map((t) => [t.day, t.total_ml]))
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(today, i - count + 1)
    const totalMl = byDay.get(day) ?? 0
    const goalMl = goalWithBoosts(goals, day, boosts)
    return { day, totalMl, goalMl, met: isMet(totalMl, goalMl) }
  })
}

/** Il lunedì della settimana di `day`: il salva-serie vale una volta da lunedì a domenica. */
export const mondayOf = (day: string) => addDays(day, 1 - weekdayOf(day))

interface Streaks {
  best: number
  current: number
  /** Giorni mancati che il salva-serie ha coperto senza rompere la serie. */
  saved: Set<string>
}

/**
 * Serie di giorni con l'obiettivo raggiunto, dal primo giorno raggiunto fino a oggi.
 * - Giorni in pausa: non rompono la serie e non la allungano (se in pausa raggiungi l'obiettivo, conta).
 * - Salva-serie (`jolly`): il primo giorno mancato di ogni settimana non rompe la serie e non la allunga.
 *   Se la serie si rompe comunque poco dopo, il salva-serie non risulta usato.
 * - Oggi può ancora arrivare all'obiettivo: se non è raggiunto, la serie si conta fino a ieri.
 */
function streaks(metDays: Set<string>, today: string, paused: Set<string>, jolly: boolean): Streaks {
  const first = [...metDays].sort()[0]
  const saved = new Set<string>()
  if (!first) return { best: 0, current: 0, saved }
  const last = metDays.has(today) ? today : addDays(today, -1)
  const usedWeeks = new Set<string>()
  let pending: string[] = []
  let run = 0
  let best = 0
  for (let day = first; day <= last; day = addDays(day, 1)) {
    if (metDays.has(day)) {
      run += 1
      best = Math.max(best, run)
      for (const d of pending) saved.add(d)
      pending = []
    } else if (paused.has(day)) {
      continue
    } else if (jolly && run > 0 && !usedWeeks.has(mondayOf(day))) {
      usedWeeks.add(mondayOf(day))
      pending.push(day)
    } else {
      for (const d of pending) usedWeeks.delete(mondayOf(d))
      pending = []
      run = 0
    }
  }
  // Ieri mancato e coperto: la serie è ancora viva, quindi il salva-serie è usato davvero.
  for (const d of pending) saved.add(d)
  return { best, current: run, saved }
}

/**
 * paused: giorni in pausa. jolly: salva-serie attivo (spento per le sfide «di fila» della settimana).
 */
export function computeStats(
  totals: DayTotal[],
  goals: GoalChange[],
  today: string,
  boosts?: Map<string, number>,
  paused: Set<string> = new Set(),
  jolly = true,
): Stats {
  const sorted = [...totals].sort((a, b) => a.day.localeCompare(b.day))
  const metDays = new Set(sorted.filter((t) => isMet(t.total_ml, goalWithBoosts(goals, t.day, boosts))).map((t) => t.day))
  const { best: bestStreak, current: currentStreak, saved: savedDays } = streaks(metDays, today, paused, jolly)

  let bestHalfRun = 0
  let halfRun = 0
  let lastHalf: string | null = null
  for (const t of sorted) {
    if (t.total_ml < goalWithBoosts(goals, t.day, boosts) / 2) {
      halfRun = 0
      lastHalf = null
      continue
    }
    halfRun = lastHalf && addDays(lastHalf, 1) === t.day ? halfRun + 1 : 1
    bestHalfRun = Math.max(bestHalfRun, halfRun)
    lastHalf = t.day
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
    lowDays: sorted.filter((t) => t.total_ml < goalWithBoosts(goals, t.day, boosts) / 2).length,
    bestHalfRun,
    savedDays,
  }
}

/** Il salva-serie di questa settimana: il giorno in cui è stato usato, oppure null se è ancora disponibile. */
export function jollyThisWeek(savedDays: Set<string>, today: string): string | null {
  const monday = mondayOf(today)
  return [...savedDays].find((d) => d >= monday && d <= today) ?? null
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
    ['half-30', 'Mai sotto metà', '30 giorni di fila sempre sopra metà obiettivo', stats.bestHalfRun >= 30],
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

/** Caffeina per giorno della settimana, in mg: serve alla sfida «sotto i 200 mg». */
export type CaffeineByDay = Map<string, number>

export const CAFFEINE_CHALLENGE_MG = 200

export function challenges(totals: DayTotal[], goals: GoalChange[], weekStart: string, today: string, caffeine?: CaffeineByDay, boosts?: Map<string, number>): Challenge[] {
  const week = totals.filter((t) => t.day >= weekStart && t.day <= today)
  // «Di fila» nelle sfide vuol dire davvero di fila: qui il salva-serie non vale.
  const stats = computeStats(week, goals, today, boosts, new Set(), false)
  const metDays = week.filter((t) => isMet(t.total_ml, goalWithBoosts(goals, t.day, boosts))).length
  const make = (id: string, label: string, value: number, target: number): Challenge => ({
    id,
    label,
    progress: Math.min(value, target),
    target,
    done: value >= target,
  })
  const list = [
    make('five-days', 'Raggiungi il tuo obiettivo 5 giorni', metDays, 5),
    make('three-row', 'Raggiungilo 3 giorni di fila', stats.bestStreak, 3),
    make('seven-days', 'Tutti i 7 giorni senza saltare', metDays, 7),
    make('liters', 'Bevi 15 litri', Math.floor(stats.totalMl / 1000), 15),
  ]
  if (caffeine) {
    // Conta i giorni già passati (oggi compreso) restati sotto il limite: un giorno senza caffè vale.
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) => d <= today)
    const under = days.filter((d) => (caffeine.get(d) ?? 0) < CAFFEINE_CHALLENGE_MG).length
    list.push(make('caffeine-week', `Caffeina sotto i ${CAFFEINE_CHALLENGE_MG} mg ogni giorno della settimana`, under, 7))
  }
  return list
}
