import { formatVolume, type Units } from '../domain/hydration'
import { weekdayOf } from '../domain/time'
import type { DayResult } from '../history/stats'

export type WeekMood = 'festa' | 'tranquillo' | 'assetato'

export interface WeekBar {
  label: string
  /** Altezza della barra, da 0 a 1: stessa scala del grafico dello Storico. */
  ratio: number
  met: boolean
}

export interface WeekCardData {
  title: string
  bars: WeekBar[]
  metLine: string
  litersLine: string
  /** null con la serie a zero: nell'immagine non compare. */
  streakLine: string | null
  mood: WeekMood
}

const LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const days = (n: number) => (n === 1 ? '1 giorno' : `${n} giorni`)

/** Il Glu dell'immagine: in festa da 5 giorni a obiettivo, tranquillo con 3-4, assetato con meno. */
const moodOf = (met: number): WeekMood => (met >= 5 ? 'festa' : met >= 3 ? 'tranquillo' : 'assetato')

/** Cosa scrivere e disegnare nell'immagine «La mia settimana su Bere». Niente nome né foto. */
export function weekCardData(week: DayResult[], currentStreak: number, units: Units | undefined, today: string): WeekCardData {
  const scale = Math.max(...week.map((d) => Math.max(d.totalMl, d.goalMl)), 1)
  const met = week.filter((d) => d.met).length
  const total = week.reduce((sum, d) => sum + d.totalMl, 0)
  return {
    title: 'La mia settimana su Bere',
    bars: week.map((d) => ({
      label: d.day === today ? 'Oggi' : LETTERS[weekdayOf(d.day) - 1],
      ratio: Math.min(1, Math.max(0, d.totalMl / scale)),
      met: d.met,
    })),
    metLine: `${days(met)} su ${week.length} a obiettivo`,
    litersLine: `${formatVolume(total, units)} bevuti`,
    streakLine: currentStreak > 0 ? `Serie: ${days(currentStreak)}` : null,
    mood: moodOf(met),
  }
}
