import { formatLiters } from './format'

export type Units = 'ml' | 'oz'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'very'

/** Percentuali indicative: non sono misure mediche, e ognuno può creare le proprie bevande. */
export const BUILT_IN_DRINKS = [
  { id: 'water', label: 'Acqua', hydrationPct: 100 },
  { id: 'tea', label: 'Tè', hydrationPct: 90 },
  { id: 'milk', label: 'Latte', hydrationPct: 90 },
  { id: 'juice', label: 'Succo', hydrationPct: 85 },
  { id: 'coffee', label: 'Caffè', hydrationPct: 80 },
  { id: 'soda', label: 'Bibita', hydrationPct: 70 },
  { id: 'beer', label: 'Birra', hydrationPct: 50 },
]

export const DEFAULT_CUPS = [
  { name: 'Bicchiere', amount_ml: 200, drink_type: 'water', hydration_pct: 100 },
  { name: 'Tazza', amount_ml: 250, drink_type: 'water', hydration_pct: 100 },
  { name: 'Bottiglia', amount_ml: 500, drink_type: 'water', hydration_pct: 100 },
]

export const ACTIVITIES: { id: Activity; label: string; extraMl: number }[] = [
  { id: 'sedentary', label: 'Sedentaria', extraMl: 0 },
  { id: 'light', label: 'Leggera', extraMl: 300 },
  { id: 'moderate', label: 'Moderata', extraMl: 600 },
  { id: 'very', label: 'Intensa', extraMl: 1000 },
]

/** Oltre questa quantità in un giorno l'app invita alla prudenza. */
export const HIGH_INTAKE_ML = 5000
export const HOT_DAY_CELSIUS = 28

const ML_PER_KG = 33
const HOT_EXTRA_ML = 500
const ML_PER_OZ = 29.5735

export const effectiveMl = (amountMl: number, hydrationPct: number) => Math.round((amountMl * hydrationPct) / 100)

export const drinkLabel = (type: string) => BUILT_IN_DRINKS.find((d) => d.id === type)?.label ?? type

export function suggestGoal(weightKg: number, activity: Activity, hot: boolean): number {
  const extra = ACTIVITIES.find((a) => a.id === activity)?.extraMl ?? 0
  const ml = weightKg * ML_PER_KG + extra + (hot ? HOT_EXTRA_ML : 0)
  return Math.min(6000, Math.max(1000, Math.round(ml / 100) * 100))
}

/** Quanto dovresti aver bevuto a quest'ora, in proporzione agli orari dei promemoria di oggi. */
export function expectedByNow(minutesToday: number[], goalMl: number, nowMinutes: number): number | null {
  if (minutesToday.length === 0) return null
  const first = Math.min(...minutesToday)
  const last = Math.max(...minutesToday)
  if (nowMinutes >= last) return goalMl
  if (nowMinutes <= first) return 0
  return Math.round((goalMl * (nowMinutes - first)) / (last - first))
}

const oz = (ml: number) => `${String(Math.round((ml / ML_PER_OZ) * 10) / 10).replace('.', ',')} oz`

export const formatVolume = (ml: number, units: Units | undefined) => (units === 'oz' ? oz(ml) : formatLiters(ml))
export const formatAmount = (ml: number, units: Units | undefined) => (units === 'oz' ? oz(ml) : `${ml} ml`)
