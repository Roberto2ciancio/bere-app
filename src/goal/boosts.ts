import { goalForDate, type GoalChange } from '../domain/goals'

export type BoostKind = 'heat' | 'workout'

export interface GoalBoost {
  local_date: string
  kind: BoostKind
  extra_ml: number
  note?: string | null
}

export const WORKOUT_BOOST_ML = 500

/** Più fa caldo, più acqua: sotto i 25 °C l'obiettivo non cambia. */
export function heatBoostMl(maxCelsius: number): number {
  if (maxCelsius >= 35) return 750
  if (maxCelsius >= 30) return 500
  if (maxCelsius >= 25) return 250
  return 0
}

/** Aumenti per giorno, sommati: serve a calcolare l'obiettivo di ogni giorno. */
export function boostsByDay(boosts: GoalBoost[]): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const b of boosts) byDay.set(b.local_date, (byDay.get(b.local_date) ?? 0) + b.extra_ml)
  return byDay
}

/** L'obiettivo di un giorno: quello scelto più gli aumenti di quel giorno (come goal_for nel database). */
export function goalWithBoosts(goals: GoalChange[], day: string, boosts?: Map<string, number>): number {
  return goalForDate(goals, day) + (boosts?.get(day) ?? 0)
}

/** Una cifra decimale: circa 10 km, abbastanza per il meteo senza rivelare l'indirizzo. */
export const roundCoord = (value: number) => Math.round(value * 10) / 10

export async function maxTemperature(lat: number, lon: number, fetcher: typeof fetch = fetch): Promise<number> {
  const response = await fetcher(
    `https://api.open-meteo.com/v1/forecast?latitude=${roundCoord(lat)}&longitude=${roundCoord(lon)}&daily=temperature_2m_max&forecast_days=1&timezone=auto`,
  )
  if (!response.ok) throw new Error(`meteo ${response.status}`)
  const data = (await response.json()) as { daily?: { temperature_2m_max?: number[] } }
  const value = data.daily?.temperature_2m_max?.[0]
  if (typeof value !== 'number') throw new Error('meteo senza temperatura')
  return value
}

export interface City {
  name: string
  lat: number
  lon: number
}

export async function findCity(query: string, fetcher: typeof fetch = fetch): Promise<City | null> {
  const response = await fetcher(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=1&language=it&format=json`)
  if (!response.ok) throw new Error(`ricerca ${response.status}`)
  const data = (await response.json()) as { results?: { name: string; admin1?: string; latitude: number; longitude: number }[] }
  const hit = data.results?.[0]
  if (!hit) return null
  const name = hit.admin1 && hit.admin1 !== hit.name ? `${hit.name} (${hit.admin1})` : hit.name
  return { name: name.slice(0, 80), lat: roundCoord(hit.latitude), lon: roundCoord(hit.longitude) }
}
