import { type GoalChange } from '../domain/goals'
import { addDays, weekdayOf } from '../domain/time'
import { goalWithBoosts } from '../goal/boosts'
import { type DayTotal } from './stats'

/** Com'è andato un giorno, dal più al meno: decide il colore nel calendario. */
export type DayLevel = 'met' | 'saved' | 'paused' | 'half' | 'low' | 'none' | 'before' | 'future'

export interface CalendarDay {
  day: string
  level: DayLevel
  totalMl: number
  goalMl: number
}

export interface PeriodSummary {
  totalMl: number
  daysMet: number
  /** Giorni passati del periodo da quando usi l'app (oggi compreso). */
  daysCounted: number
  averageMl: number
  /** Serie più lunga dentro il periodo: pausa e salva-serie non la rompono. */
  bestRun: number
  bestDay: { day: string; totalMl: number } | null
}

export interface Inputs {
  totals: DayTotal[]
  goals: GoalChange[]
  today: string
  boosts?: Map<string, number>
  paused?: Set<string>
  saved?: Set<string>
}

/** «2026-11» → giorni del mese, dal primo all'ultimo. */
export function monthDays(month: string): string[] {
  const days: string[] = []
  for (let day = `${month}-01`; day.startsWith(month); day = addDays(day, 1)) days.push(day)
  return days
}

export const addMonths = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number)
  const index = y * 12 + (m - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

function levels({ totals, goals, today, boosts, paused = new Set(), saved = new Set() }: Inputs) {
  const byDay = new Map(totals.map((t) => [t.day, t.total_ml]))
  const first = totals.length ? totals.reduce((min, t) => (t.day < min ? t.day : min), totals[0].day) : today
  return (day: string): CalendarDay => {
    const totalMl = byDay.get(day) ?? 0
    const goalMl = goalWithBoosts(goals, day, boosts)
    const level: DayLevel =
      day > today ? 'future'
      : totalMl >= goalMl ? 'met'
      : saved.has(day) ? 'saved'
      : paused.has(day) ? 'paused'
      : day < first ? 'before'
      : totalMl >= goalMl / 2 ? 'half'
      : totalMl > 0 ? 'low'
      : 'none'
    return { day, level, totalMl, goalMl }
  }
}

/** Le settimane del mese, da lunedì a domenica; null nelle caselle fuori dal mese. */
export function monthGrid(month: string, inputs: Inputs): (CalendarDay | null)[][] {
  const of = levels(inputs)
  const days = monthDays(month)
  const cells: (CalendarDay | null)[] = [...Array<null>(weekdayOf(days[0]) - 1).fill(null), ...days.map(of)]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}

export function summarize(days: string[], inputs: Inputs): PeriodSummary {
  const of = levels(inputs)
  const counted = days.map(of).filter((d) => d.level !== 'future' && d.level !== 'before')
  const totalMl = counted.reduce((sum, d) => sum + d.totalMl, 0)
  let run = 0
  let bestRun = 0
  let bestDay: PeriodSummary['bestDay'] = null
  for (const d of counted) {
    if (d.level === 'met') bestRun = Math.max(bestRun, ++run)
    else if (d.level !== 'saved' && d.level !== 'paused') run = 0
    if (d.totalMl > 0 && (!bestDay || d.totalMl > bestDay.totalMl)) bestDay = { day: d.day, totalMl: d.totalMl }
  }
  return {
    totalMl,
    daysMet: counted.filter((d) => d.level === 'met').length,
    daysCounted: counted.length,
    averageMl: counted.length ? Math.round(totalMl / counted.length) : 0,
    bestRun,
    bestDay,
  }
}

export const monthSummary = (month: string, inputs: Inputs) => summarize(monthDays(month), inputs)

export function yearSummary(year: string, inputs: Inputs): { total: PeriodSummary; months: { month: string; summary: PeriodSummary }[] } {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  return {
    total: summarize(months.flatMap(monthDays), inputs),
    months: months.map((month) => ({ month, summary: monthSummary(month, inputs) })),
  }
}
