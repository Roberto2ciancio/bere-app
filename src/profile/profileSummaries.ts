// Riepiloghi delle righe del Profilo: funzioni pure, i dati arrivano da ProfilePage.
import { formatAmount, formatVolume, type Units } from '../domain/hydration'
import type { PushState } from '../push/subscribe'

/** «2,7 L al giorno»; «—» finché l'obiettivo non è arrivato. */
export function goalSummary(goalMl: number | null, units: Units | undefined): string {
  return goalMl === null ? '—' : `${formatVolume(goalMl, units)} al giorno`
}

/** «200 ml · litri»: quantità del pulsante e unità di misura scelta. */
export function drinkSummary(drinkMl: number, units: Units | undefined): string {
  return `${formatAmount(drinkMl, units)} · ${units === 'oz' ? 'once' : 'litri'}`
}

/** «2026-11-14» → «14/11». */
export function pauseUntilLabel(end: string): string {
  return `${end.slice(8, 10)}/${end.slice(5, 7)}`
}

export interface NotificationInfo {
  /** Come PushToggle: cosa permette questo browser. */
  support: PushState
  /** Spente a mano su questo telefono (PushToggle). */
  off: boolean
  /** Fine della pausa in corso (PauseForm), se c'è. */
  pauseEnd: string | null
  /** Orari dei programmi attivi (SchedulesPage); null finché non arrivano. */
  reminders: number | null
}

export function notificationSummary({ support, off, pauseEnd, reminders }: NotificationInfo): string {
  if (support === 'unsupported') return 'Non disponibili su questo browser'
  if (support === 'needs-install') return "Installa l'app per attivarle"
  if (support === 'denied') return 'Bloccate dal telefono'
  if (support !== 'granted' || off) return 'Spente'
  if (pauseEnd) return `In pausa fino al ${pauseUntilLabel(pauseEnd)}`
  if (reminders === null) return 'Attive'
  return `Attive · ${reminders === 0 ? 'nessun' : reminders} promemoria`
}
