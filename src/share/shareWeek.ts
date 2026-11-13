import type { Units } from '../domain/hydration'
import type { DayResult } from '../history/stats'
import { drawWeekCard } from './drawWeekCard'
import { shareImage, type ShareOutcome } from './shareImage'
import { weekCardData } from './weekCard'

/** Tutto il lavoro di «Condividi la settimana»: si carica solo quando si tocca il bottone. */
export async function shareWeek(week: DayResult[], currentStreak: number, units: Units | undefined, today: string): Promise<ShareOutcome> {
  const data = weekCardData(week, currentStreak, units, today)
  const blob = await drawWeekCard(data)
  return shareImage(blob, 'bere-settimana.png', data.title)
}
