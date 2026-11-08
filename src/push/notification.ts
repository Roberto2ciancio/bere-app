import { formatAmount, formatVolume, type Units } from '../domain/hydration'

export interface NotificationPayload {
  title: string
  body: string
  url: string
  logId?: string
  /** Avviso «obiettivo raggiunto» di un amico: il biglietto per i complimenti. */
  cheerToken?: string
  /** Ha scelto le due quantità: i pulsanti «Bevuto …» al posto di «Bevuto ✓». */
  amounts?: number[]
  units?: Units
}

export const DRINK_ACTION = 'drink'
export const CHEER_ACTION = 'cheer'
export const SNOOZE_ACTION = 'snooze'

/** «Bevuto 500 ml» ha l'azione «drink:500». */
const amountAction = (ml: number) => `${DRINK_ACTION}:${ml}`

/** La quantità scelta dal pulsante: null per «Bevuto ✓» (quella del profilo), undefined se non è un pulsante «Bevuto». */
export function drinkAmountOf(action: string): number | null | undefined {
  if (action === DRINK_ACTION) return null
  const match = /^drink:(\d+)$/.exec(action)
  return match ? Number(match[1]) : undefined
}

type Options = NotificationOptions & { actions?: { action: string; title: string }[] }

/**
 * Niente tag: un tag fisso sostituirebbe in silenzio un promemoria ancora non letto.
 * Solo i promemoria (con logId) hanno «Bevuto ✓» e «Tra 15 min»: gli sproni non sono legati a un invio registrato.
 * Chi ha scelto le due quantità ha «Bevuto 200 ml», «Bevuto 500 ml» e poi «Tra 15 min»: Android mostra solo i primi due.
 * Gli avvisi «obiettivo raggiunto» degli amici hanno «Complimenti».
 */
export function notificationOptions(payload: NotificationPayload): Options {
  const options: Options = {
    body: payload.body,
    icon: 'icon-192.png',
    data: payload.logId ? { url: payload.url, logId: payload.logId } : { url: payload.url },
  }
  if (payload.logId) {
    const amounts = (payload.amounts ?? []).filter((ml) => Number.isInteger(ml) && ml > 0).slice(0, 2)
    options.actions = amounts.length > 0
      ? [...amounts.map((ml) => ({ action: amountAction(ml), title: `Bevuto ${formatAmount(ml, payload.units)}` })), { action: SNOOZE_ACTION, title: 'Tra 15 min' }]
      : [
          { action: DRINK_ACTION, title: 'Bevuto ✓' },
          { action: SNOOZE_ACTION, title: 'Tra 15 min' },
        ]
  }
  if (payload.cheerToken) {
    options.data = { url: payload.url, cheerToken: payload.cheerToken }
    options.actions = [{ action: CHEER_ACTION, title: '👏 Complimenti' }]
  }
  return options
}

export interface DrinkFromPushResult {
  ok: boolean
  added?: boolean
  amount_ml?: number
  drunk_ml?: number
  goal_ml?: number
  units?: Units
}

/** Cosa mostrare dopo «Bevuto ✓»: la notifica di conferma sostituisce la precedente (stesso tag). */
export function drinkConfirmation(result: DrinkFromPushResult | null): { title: string; options: Options } {
  if (!result?.ok || result.drunk_ml === undefined || result.goal_ml === undefined) {
    return {
      title: 'Bevuta non segnata',
      options: { body: 'Tocca qui per aprire Bere e segnarla da lì.', icon: 'icon-192.png', data: { url: '#/home' } },
    }
  }
  const { units, drunk_ml: drunk, goal_ml: goal } = result
  const title = drunk >= goal
    ? 'Obiettivo raggiunto 🎉'
    : result.added ? `Segnati ${formatAmount(result.amount_ml ?? 0, units)}` : 'Già segnata'
  return {
    title,
    options: {
      body: `${formatVolume(drunk, units)} su ${formatVolume(goal, units)} oggi`,
      icon: 'icon-192.png',
      tag: 'bere-bevuto',
      silent: true,
      data: { url: '#/home' },
    },
  }
}

/** Dopo «Complimenti» dalla notifica. */
export function cheerConfirmation(status: string | null): { title: string; options: Options } {
  const quiet = { icon: 'icon-192.png', tag: 'bere-complimenti', silent: true, data: { url: '#/classifica' } }
  if (status === 'sent' || status === 'no-device') return { title: 'Complimenti inviati 👏', options: { ...quiet, body: 'Un bel gesto!' } }
  if (status === 'already') return { title: 'Complimenti già inviati', options: { ...quiet, body: 'Ne basta uno al giorno 😉' } }
  return {
    title: 'Complimenti non inviati',
    options: { body: 'Tocca qui per aprire la classifica e riprovare da lì.', icon: 'icon-192.png', data: { url: '#/classifica' } },
  }
}

export interface SnoozeFromPushResult {
  ok: boolean
  times?: number
  reason?: 'invalid' | 'limit'
}

/** Dopo «Tra 15 min»: una conferma silenziosa che sparisce sotto il promemoria rimandato (stesso tag). */
export function snoozeConfirmation(result: SnoozeFromPushResult | null): { title: string; options: Options } {
  const quiet = { icon: 'icon-192.png', tag: 'bere-rimanda', silent: true, data: { url: '#/home' } }
  if (result?.ok) return { title: 'Te lo ricordo tra 15 minuti', options: { ...quiet, body: 'Nel frattempo niente fretta 💧' } }
  if (result?.reason === 'limit') {
    return { title: 'Rimandato già 3 volte', options: { ...quiet, body: 'Tocca qui per aprire Bere e segnare la bevuta.' } }
  }
  return {
    title: 'Promemoria non rimandato',
    options: { body: 'Controlla la connessione: il prossimo promemoria arriverà comunque.', icon: 'icon-192.png', data: { url: '#/home' } },
  }
}
