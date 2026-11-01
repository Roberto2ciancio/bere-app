import { localParts } from '../domain/time'
import { createOfflineQueue } from '../lib/offlineQueue'
import { CAFFEINE_MG, type CaffeineKind } from './caffeine'

export interface QueuedCaffeine {
  client_id: string
  user_id: string
  kind: CaffeineKind
  mg: number
  taken_at: string
  local_date: string
}

const queue = createOfflineQueue<QueuedCaffeine>('bere.caffeineQueue')

export const pendingCaffeine = queue.pending
export const removeQueuedCaffeine = queue.remove
export const flushCaffeine = queue.flush

export function enqueueCaffeine(input: { userId: string; kind: CaffeineKind; tz: string }) {
  const now = new Date()
  queue.add({
    client_id: crypto.randomUUID(),
    user_id: input.userId,
    kind: input.kind,
    mg: CAFFEINE_MG[input.kind],
    taken_at: now.toISOString(),
    local_date: localParts(now, input.tz).date,
  })
}
