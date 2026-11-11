import { readCache, removeCache, writeCache } from '../lib/cache'

const key = (userId: string) => `bere.gluCalm.${userId}`

/** «Glu tranquillo»: solo sul telefono, niente scenette né tremarelle. */
export function isGluCalm(userId: string): boolean {
  return readCache<boolean>(key(userId)) === true
}

export function setGluCalm(userId: string, on: boolean): void {
  if (on) writeCache(key(userId), true)
  else removeCache(key(userId))
}
