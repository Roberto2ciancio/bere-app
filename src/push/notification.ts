import { formatAmount, formatVolume, type Units } from '../domain/hydration'

export interface NotificationPayload {
  title: string
  body: string
  url: string
  logId?: string
}

export const DRINK_ACTION = 'drink'

type Options = NotificationOptions & { actions?: { action: string; title: string }[] }

/**
 * Niente tag: un tag fisso sostituirebbe in silenzio un promemoria ancora non letto.
 * Solo i promemoria (con logId) hanno «Bevuto ✓»: gli sproni non sono legati a un invio registrato.
 */
export function notificationOptions(payload: NotificationPayload): Options {
  const options: Options = {
    body: payload.body,
    icon: 'icon-192.png',
    data: payload.logId ? { url: payload.url, logId: payload.logId } : { url: payload.url },
  }
  if (payload.logId) options.actions = [{ action: DRINK_ACTION, title: 'Bevuto ✓' }]
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
