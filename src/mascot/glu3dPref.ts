import { readCache, removeCache, writeCache } from '../lib/cache'

const key = (userId: string) => `bere.glu3d.${userId}`

/** «Glu in 3D»: acceso di default, si salva solo quando lo spegni. */
export function isGlu3dOn(userId: string): boolean {
  return readCache<boolean>(key(userId)) !== false
}

export function setGlu3dOn(userId: string, on: boolean): void {
  if (on) removeCache(key(userId))
  else writeCache(key(userId), false)
}
