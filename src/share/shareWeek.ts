import type { Units } from '../domain/hydration'
import type { DayResult } from '../history/stats'
import { drawWeekCard } from './drawWeekCard'
import { shareImage, type ShareOutcome } from './shareImage'
import { weekCardData } from './weekCard'

export interface PreparedWeek {
  blob: Blob
  title: string
}

/** Disegna l'immagine della settimana: si fa in anticipo, così al tocco si condivide subito. */
export async function prepareWeek(week: DayResult[], currentStreak: number, units: Units | undefined, today: string): Promise<PreparedWeek> {
  const data = weekCardData(week, currentStreak, units, today)
  return { blob: await drawWeekCard(data), title: data.title }
}

/**
 * Condivide (o scarica) l'immagine già pronta. navigator.share parte senza attese: su Safari
 * la condivisione vale solo subito dopo il tocco.
 */
export function shareWeekImage(prepared: PreparedWeek): Promise<ShareOutcome> {
  return shareImage(prepared.blob, 'bere-settimana.png', prepared.title)
}
