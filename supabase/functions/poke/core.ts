import { sendToDevices, type Deps, type Subscription } from '../send-reminders/core.ts'

export interface PokeDeps extends Pick<Deps, 'push' | 'removeSubscription' | 'touchSubscription'> {
  claim(from: string, to: string): Promise<string>
  senderName(id: string): Promise<string>
  subscriptions(id: string): Promise<Subscription[]>
  /** In pausa: nessuna notifica, nemmeno dagli amici. */
  isPaused?(id: string): Promise<boolean>
}

export type PokeResult = 'sent' | 'no-device' | 'failed' | 'limit' | 'cooldown' | 'blocked' | 'self' | 'paused'

export async function runPoke(deps: PokeDeps, from: string, to: string): Promise<PokeResult> {
  // Prima del conteggio: uno sprone a chi è in pausa non consuma i 3 al giorno.
  if (from !== to && (await deps.isPaused?.(to))) return 'paused'
  const claim = await deps.claim(from, to)
  if (claim !== 'ok') return claim as PokeResult
  const name = await deps.senderName(from)
  const status = await sendToDevices(deps, await deps.subscriptions(to), {
    title: `${name} ti sprona`,
    body: 'È ora di bere!',
    url: '#/home',
    logId: '',
  })
  return status === 'sent' || status === 'no-device' ? status : 'failed'
}
