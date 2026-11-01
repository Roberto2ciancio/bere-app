import { localParts } from '../domain/time'
import { createOfflineQueue } from '../lib/offlineQueue'

export interface QueuedDrink {
  client_id: string
  user_id: string
  amount_ml: number
  drunk_at: string
  local_date: string
}

const queue = createOfflineQueue<QueuedDrink>('bere.drinkQueue')

export const pendingDrinks = queue.pending
export const removeQueued = queue.remove
export const flushQueue = queue.flush

export function enqueueDrink(input: { userId: string; amountMl: number; tz: string; now?: Date }): QueuedDrink {
  const now = input.now ?? new Date()
  const drink: QueuedDrink = {
    client_id: crypto.randomUUID(),
    user_id: input.userId,
    amount_ml: input.amountMl,
    drunk_at: now.toISOString(),
    local_date: localParts(now, input.tz).date,
  }
  queue.add(drink)
  return drink
}
