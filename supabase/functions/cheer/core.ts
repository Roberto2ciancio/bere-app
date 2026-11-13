import { sendToDevices, type Deps, type Subscription } from '../send-reminders/core.ts'

export interface CheerDeps extends Pick<Deps, 'push' | 'removeSubscription' | 'touchSubscription'> {
  /** Dalla notifica: il biglietto vale una volta. Restituisce destinatario e nome di chi manda, o null. */
  claimToken(token: string): Promise<{ to_user: string; from_name: string } | null>
  /** Dalla classifica: 'ok', 'already', 'no-goal', 'self' o 'invalid'. */
  claim(from: string, to: string, reaction: Reaction): Promise<string>
  name(id: string): Promise<string>
  subscriptions(id: string): Promise<Subscription[]>
}

export const REACTIONS = ['👏', '💪', '🔥'] as const
export type Reaction = (typeof REACTIONS)[number]

const TITLES: Record<Reaction, (name: string) => string> = {
  '👏': (name) => `${name} ti fa i complimenti 👏`,
  '💪': (name) => `${name} ti dice: che forza! 💪`,
  '🔥': (name) => `${name} ti dice: sei on fire! 🔥`,
}

export type CheerInput = { token: string } | { from: string; to: string; reaction?: Reaction }
export type CheerResult = 'sent' | 'no-device' | 'failed' | 'already' | 'no-goal' | 'self' | 'invalid'

export async function runCheer(deps: CheerDeps, input: CheerInput): Promise<CheerResult> {
  let to: string
  let fromName: string
  let reaction: Reaction = '👏'
  if ('token' in input) {
    const claimed = await deps.claimToken(input.token)
    // Biglietto già usato, scaduto o inventato: per chi tocca è come «già fatto».
    if (!claimed) return 'already'
    to = claimed.to_user
    fromName = claimed.from_name
  } else {
    reaction = input.reaction ?? '👏'
    const result = await deps.claim(input.from, input.to, reaction)
    if (result !== 'ok') return result as CheerResult
    to = input.to
    fromName = await deps.name(input.from)
  }
  const status = await sendToDevices(deps, await deps.subscriptions(to), {
    title: TITLES[reaction](fromName || 'Un amico'),
    body: "Hai raggiunto l'obiettivo di oggi. Continua così!",
    url: '#/classifica',
    logId: '',
  })
  return status === 'sent' || status === 'no-device' ? status : 'failed'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Il corpo arriva dal telefono: biglietto (dalla notifica) o destinatario (dalla classifica, con l'accesso). */
export function parseCheer(body: unknown, userId: string | null): CheerInput | null {
  const data = (body ?? {}) as { token?: unknown; to?: unknown; reaction?: unknown }
  if (typeof data.token === 'string') return UUID.test(data.token) ? { token: data.token } : null
  if (typeof data.to === 'string' && userId && UUID.test(data.to)) {
    if (data.reaction === undefined) return { from: userId, to: data.to }
    return REACTIONS.includes(data.reaction as Reaction) ? { from: userId, to: data.to, reaction: data.reaction as Reaction } : null
  }
  return null
}
