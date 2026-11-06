import { sendToDevices, type Deps, type PushPayload, type Subscription } from './core.ts'

export interface GoalAlertRow {
  event_id: string
  achiever: string
  to_user: string
  token: string
  subscriptions: Subscription[] | null
}

export interface NudgeRow {
  user_id: string
  display_name: string
  days_away: number
  /** 0, 1, 2: primo, secondo e ultimo promemoria dall'ultima apertura. */
  stage: number
  goal_ml: number
  subscriptions: Subscription[] | null
}

export interface EveningRow {
  user_id: string
  display_name: string
  drunk_ml: number
  goal_ml: number
  subscriptions: Subscription[] | null
}

export interface WeeklyRow {
  user_id: string
  display_name: string
  week_start: string
  days_met: number
  average_ml: number
  rank: number
  players: number
  subscriptions: Subscription[] | null
}

export interface SocialDeps extends Pick<Deps, 'push' | 'removeSubscription' | 'touchSubscription'> {
  /** Prende (una volta sola) gli avvisi da mandare agli amici di chi ha appena raggiunto l'obiettivo. */
  takeGoalAlerts(): Promise<GoalAlertRow[]>
  /** Prende (una volta sola) i promemoria per chi non apre l'app. */
  takeNudges(): Promise<NudgeRow[]>
  /** Prende (una volta sola) i riepiloghi serali di chi è rimasto parecchio sotto l'obiettivo. */
  takeEveningSummaries(): Promise<EveningRow[]>
  /** Prende (una volta sola) i resoconti del lunedì. */
  takeWeeklyReports(): Promise<WeeklyRow[]>
}

export interface SocialSummary {
  alerts: number
  nudges: number
  evenings: number
  weeklies: number
}

function formatGoal(ml: number): string {
  return `${String(Math.round(ml / 100) / 10).replace('.', ',')} L`
}

function formatMl(ml: number): string {
  return ml < 1000 ? `${ml} ml` : formatGoal(ml)
}

export function goalAlertPayload(row: GoalAlertRow): PushPayload {
  return {
    title: `🎉 ${row.achiever} ha raggiunto l'obiettivo di oggi`,
    body: 'Tocca «Complimenti» per farglielo sapere 👏',
    url: '#/classifica',
    logId: '',
    cheerToken: row.token,
  }
}

/** Promemoria personalizzato: nome, giorni di assenza e obiettivo. Diventa più leggero a ogni passo. */
export function nudgePayload(row: NudgeRow): PushPayload {
  const name = row.display_name.trim() || 'Ciao'
  const texts = [
    { title: `${name}, da ieri non ti vediamo 💧`, body: `Un bicchiere d'acqua adesso? Il tuo obiettivo è ${formatGoal(row.goal_ml)} al giorno.` },
    { title: `${name}, sono ${row.days_away} giorni che non segni niente`, body: 'Riparti con un bicchiere: basta un tocco su «Ho bevuto».' },
    { title: `Ci manchi, ${name} 💧`, body: 'Bere è qui per ricordarti di bere, quando vuoi. Ti aspettiamo!' },
  ]
  return { ...texts[Math.min(Math.max(row.stage, 0), 2)], url: '#/home', logId: '' }
}

/** Riepilogo serale: com'è andata e un invito leggero per domani. */
export function eveningPayload(row: EveningRow): PushPayload {
  const name = row.display_name.trim()
  const missing = Math.max(row.goal_ml - row.drunk_ml, 0)
  return {
    title: `${name ? `${name}, oggi` : 'Oggi'} ${formatGoal(row.drunk_ml)} su ${formatGoal(row.goal_ml)}`,
    body: `Ti sono mancati ${formatMl(missing)}: domani recuperi? 💧`,
    url: '#/storico',
    logId: '',
  }
}

/** Resoconto del lunedì: giorni a obiettivo, media e posto in classifica della settimana appena finita. */
export function weeklyPayload(row: WeeklyRow): PushPayload {
  const average = `media ${formatGoal(row.average_ml)} al giorno`
  const place = row.players > 1 ? ` · ${row.rank}° posto su ${row.players} in classifica` : ''
  if (row.days_met === 0) {
    return { title: 'Nuova settimana, nuova occasione 💧', body: `La scorsa: ${average}${place}. Si riparte da oggi!`, url: '#/storico', logId: '' }
  }
  const days = row.days_met === 1 ? '1 giorno' : `${row.days_met} giorni`
  return {
    title: row.days_met === 7 ? 'Settimana perfetta: 7 giorni su 7 🏆' : `La tua settimana: ${days} su 7 a obiettivo`,
    body: `${average.charAt(0).toUpperCase()}${average.slice(1)}${place}. Buona settimana!`,
    url: '#/storico',
    logId: '',
  }
}

export async function runSocial(deps: SocialDeps): Promise<SocialSummary> {
  const summary: SocialSummary = { alerts: 0, nudges: 0, evenings: 0, weeklies: 0 }
  // Una parte che fallisce non deve fermare le altre.
  const safe = <T>(what: string, take: () => Promise<T[]>) =>
    take().catch((error) => {
      console.error(`${what} non letti`, error)
      return [] as T[]
    })
  const [alerts, nudges, evenings, weeklies] = await Promise.all([
    safe('avvisi obiettivo', () => deps.takeGoalAlerts()),
    safe('promemoria di assenza', () => deps.takeNudges()),
    safe('riepiloghi serali', () => deps.takeEveningSummaries()),
    safe('resoconti settimanali', () => deps.takeWeeklyReports()),
  ])
  const send = async (key: keyof SocialSummary, subscriptions: Subscription[] | null, payload: PushPayload) => {
    if ((await sendToDevices(deps, subscriptions ?? [], payload)) === 'sent') summary[key]++
  }
  await Promise.all([
    ...alerts.map((row) => send('alerts', row.subscriptions, goalAlertPayload(row))),
    ...nudges.map((row) => send('nudges', row.subscriptions, nudgePayload(row))),
    ...evenings.map((row) => send('evenings', row.subscriptions, eveningPayload(row))),
    ...weeklies.map((row) => send('weeklies', row.subscriptions, weeklyPayload(row))),
  ])
  return summary
}
