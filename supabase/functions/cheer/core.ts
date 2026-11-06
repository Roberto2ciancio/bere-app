import { sendToDevices, type Deps, type Subscription } from '../send-reminders/core.ts'

export interface CheerDeps extends Pick<Deps, 'push' | 'removeSubscription' | 'touchSubscription'> {
  /** Dalla notifica: il biglietto vale una volta. Restituisce destinatario e nome di chi manda, o null. */
  claimToken(token: string): Promise<{ to_user: string; from_name: string } | null>
  /** Dalla classifica: 'ok', 'already', 'no-goal' o 'self'. */
  claim(from: string, to: string): Promise<string>
  name(id: string): Promise<string>
  subscriptions(id: string): Promise<Subscription[]>
}

export type CheerInput = { token: string } | { from: string; to: string }
export type CheerResult = 'sent' | 'no-device' | 'failed' | 'already' | 'no-goal' | 'self' | 'invalid'

export async function runCheer(deps: CheerDeps, input: CheerInput): Promise<CheerResult> {
  let to: string
  let fromName: string
  if ('token' in input) {
    const claimed = await deps.claimToken(input.token)
    // Biglietto già usato, scaduto o inventato: per chi tocca è come «già fatto».
    if (!claimed) return 'already'
    to = claimed.to_user
    fromName = claimed.from_name
  } else {
    const result = await deps.claim(input.from, input.to)
    if (result !== 'ok') return result as CheerResult
    to = input.to
    fromName = await deps.name(input.from)
  }
  const status = await sendToDevices(deps, await deps.subscriptions(to), {
    title: `${fromName || 'Un amico'} ti fa i complimenti 👏`,
    body: "Hai raggiunto l'obiettivo di oggi. Continua così!",
    url: '#/classifica',
    logId: '',
  })
  return status === 'sent' || status === 'no-device' ? status : 'failed'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Il corpo arriva dal telefono: biglietto (dalla notifica) o destinatario (dalla classifica, con l'accesso). */
export function parseCheer(body: unknown, userId: string | null): CheerInput | null {
  const data = (body ?? {}) as { token?: unknown; to?: unknown }
  if (typeof data.token === 'string') return UUID.test(data.token) ? { token: data.token } : null
  if (typeof data.to === 'string' && userId) return UUID.test(data.to) ? { from: userId, to: data.to } : null
  return null
}
