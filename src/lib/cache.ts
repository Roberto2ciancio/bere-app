import { storageKey } from './storageKey'

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey(key))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function removeCache(key: string) {
  try {
    localStorage.removeItem(storageKey(key))
  } catch {
    // Niente da fare: la memoria locale non è disponibile.
  }
}

export function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value))
  } catch {
    // Senza memoria locale l'app funziona lo stesso, ma solo online.
  }
}
