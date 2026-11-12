import { useCallback, useSyncExternalStore } from 'react'
import { readCache, removeCache, writeCache } from '../lib/cache'

const key = (userId: string) => `bere.glu3d.${userId}`
const listeners = new Set<() => void>()

/** «Glu in 3D»: acceso di default, si salva solo quando lo spegni. */
export function isGlu3dOn(userId: string): boolean {
  return readCache<boolean>(key(userId)) !== false
}

export function setGlu3dOn(userId: string, on: boolean): void {
  if (on) removeCache(key(userId))
  else writeCache(key(userId), false)
  for (const fn of listeners) fn()
}

/** Avvisa a ogni cambio della preferenza (in questa scheda del browser). */
export function subscribeGlu3dPref(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** La preferenza, aggiornata subito quando cambia. Senza utente: spenta. */
export function useGlu3dOn(userId: string | null): boolean {
  const get = useCallback(() => !!userId && isGlu3dOn(userId), [userId])
  return useSyncExternalStore(subscribeGlu3dPref, get, get)
}
