// Divisione dell'obiettivo sulla fascia attiva: stessa logica nell'app e nella funzione che invia i promemoria.

export const DEFAULT_ACTIVE_START = 8 * 60
export const DEFAULT_ACTIVE_END = 18 * 60
export const MIN_ACTIVE_MINUTES = 60
/** Entro questo scarto dalla tabella di marcia si è "in linea": nessuno è indietro per un sorso. */
export const ON_TRACK_MARGIN_ML = 100
/** Più di così in un'ora non conviene: il ritmo richiesto non lo supera mai. */
export const MAX_HOURLY_ML = 1000

export interface ActiveHours {
  start: number
  end: number
}

/** Messaggio d'errore se la fascia non ha senso, altrimenti null. Inizio e fine in minuti dalla mezzanotte. */
export function activeHoursError(start: number, end: number): string | null {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 24 * 60) return 'Scegli orari validi'
  if (end <= start) return 'L\'ora di fine deve venire dopo l\'ora di inizio'
  if (end - start < MIN_ACTIVE_MINUTES) return 'La fascia attiva deve durare almeno un\'ora'
  return null
}

export const inActiveHours = (minutes: number, hours: ActiveHours) => minutes >= hours.start && minutes < hours.end

export type Pace =
  | { phase: 'done' }
  | { phase: 'before'; resumesAt: number }
  | { phase: 'after'; remainingMl: number }
  | {
      phase: 'active'
      /** Quanto si dovrebbe aver bevuto a quest'ora. */
      expectedMl: number
      /** Bevuto meno dovuto: negativo se si è indietro. */
      diffMl: number
      status: 'on-track' | 'behind' | 'ahead'
      remainingMl: number
      /** Quanto bere ogni ora da adesso: quello che manca diviso sulle ore che restano. */
      hourlyMl: number
      /** Il ritmo pieno supererebbe MAX_HOURLY_ML ed è stato limitato. */
      capped: boolean
    }

const round10 = (ml: number) => Math.round(ml / 10) * 10

export function activePace(input: { goalMl: number; drunkMl: number; nowMinutes: number; hours: ActiveHours }): Pace {
  const { goalMl, drunkMl, nowMinutes, hours } = input
  if (drunkMl >= goalMl) return { phase: 'done' }
  const remainingMl = goalMl - drunkMl
  if (nowMinutes < hours.start) return { phase: 'before', resumesAt: hours.start }
  if (nowMinutes >= hours.end) return { phase: 'after', remainingMl }

  const total = hours.end - hours.start
  const expectedMl = Math.round((goalMl * (nowMinutes - hours.start)) / total)
  const diffMl = drunkMl - expectedMl
  const status = Math.abs(diffMl) <= ON_TRACK_MARGIN_ML ? 'on-track' : diffMl < 0 ? 'behind' : 'ahead'
  // Nell'ultima ora non si divide sui pochi minuti rimasti: ne verrebbero quantità assurde.
  const hoursLeft = Math.max((hours.end - nowMinutes) / 60, 1)
  const full = remainingMl / hoursLeft
  const capped = full > MAX_HOURLY_ML
  return { phase: 'active', expectedMl, diffMl, status, remainingMl, hourlyMl: round10(Math.min(full, MAX_HOURLY_ML)), capped }
}

/**
 * Quanto bere adesso, al momento di un promemoria: il ritmo orario per il tempo fino al prossimo
 * promemoria della fascia. Mai più di un'ora di ritmo in un colpo solo e mai più di quanto manca;
 * all'ultimo promemoria della fascia è un'ora di ritmo, che nell'ultima ora è tutto ciò che manca.
 */
export function amountForNow(pace: Pace, nowMinutes: number, nextMinutes: number | null, hours: ActiveHours): number {
  if (pace.phase !== 'active') return 0
  const hasNext = nextMinutes !== null && nextMinutes > nowMinutes && nextMinutes < hours.end
  const window = hasNext ? Math.min(nextMinutes - nowMinutes, 60) : 60
  return Math.min(pace.remainingMl, Math.max(10, round10((pace.hourlyMl * window) / 60)))
}
