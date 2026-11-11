import { useState } from 'react'
import { useOptionalAuth } from '../auth/AuthProvider'
import { readCache, writeCache } from '../lib/cache'
import { streakAccessory, type CrownTier } from './reactions'

const streakKey = (userId: string) => `bere.gluStreak.${userId}`

/** Ricorda l'ultima serie vista: i Glu piccoli delle altre pagine non rifanno i conti. */
export function saveStreak(userId: string, streak: number): void {
  writeCache(streakKey(userId), streak)
}

interface Accessories {
  crown: CrownTier
  headband: boolean
}

// I Glu piccoli possono stare anche fuori da AuthProvider: senza accesso, nessun accessorio.
function useUserId(): string | null {
  return useOptionalAuth()?.user?.id ?? null
}

/** Accessori fermi dei Glu piccoli, letti da quello che l'app ha già salvato (nessuna richiesta di rete). */
export function useGluAccessories(): Accessories {
  const userId = useUserId()
  const [today] = useState(() => new Date().toLocaleDateString('sv-SE'))
  if (!userId) return { crown: 0, headband: false }
  const crown = streakAccessory(readCache<number>(streakKey(userId)) ?? 0)
  const boosts = readCache<{ local_date: string; kind: string }[]>(`bere.boosts.${userId}`) ?? []
  return { crown, headband: boosts.some((b) => b.kind === 'workout' && b.local_date === today) }
}
