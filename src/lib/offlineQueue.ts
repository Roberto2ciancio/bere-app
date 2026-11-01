import { storageKey } from './storageKey'

interface Queued {
  client_id: string
  user_id: string
}

/** Coda sul telefono: i dati partono in ordine e riprovano con lo stesso client_id, così il server non li duplica. */
export function createOfflineQueue<T extends Queued>(name: string) {
  const key = storageKey(name)
  const inFlight = new Map<string, Promise<void>>()

  function read(): T[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }

  function write(queue: T[]) {
    try {
      localStorage.setItem(key, JSON.stringify(queue))
    } catch {
      // Memoria piena o bloccata: la voce non resta in coda e si perde se manca anche la rete.
    }
  }

  const pending = (userId: string) => read().filter((item) => item.user_id === userId)

  function remove(clientId: string): boolean {
    const queue = read()
    const next = queue.filter((item) => item.client_id !== clientId)
    write(next)
    return next.length !== queue.length
  }

  return {
    pending,
    remove,
    add(item: T) {
      write([...read(), item])
    },
    flush(userId: string, send: (item: T) => Promise<void>): Promise<void> {
      const running = inFlight.get(userId)
      if (running) return running
      const run = (async () => {
        // Al primo errore ci si ferma e si riprova più tardi.
        // Si rilegge la coda a ogni giro: una voce segnata durante l'invio parte subito dopo.
        for (let item = pending(userId)[0]; item; item = pending(userId)[0]) {
          await send(item)
          remove(item.client_id)
        }
      })()
        .catch(() => {})
        .finally(() => inFlight.delete(userId))
      inFlight.set(userId, run)
      return run
    },
  }
}
