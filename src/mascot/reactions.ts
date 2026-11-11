// Regole pure delle reazioni di Glu (sete, caffè, allenamento, serie di giorni).
export const REACTIONS = {
  thirstStartH: 2,
  thirstMaxH: 4,
  coffeeMin: 20,
  streakTiers: [7, 14, 30],
  workoutSceneMs: 6000,
  defaultDayStartMin: 480,
} as const

const HOUR_MS = 3_600_000

/** Sete da 0 a 1: sale linearmente tra 2 e 4 ore dall'ultima bevuta. */
export function thirstLevel(lastDrinkAt: Date | null, now: Date, dayStart: Date): number {
  // Una bevuta di ieri sera non conta: si parte dall'inizio della giornata.
  const from = lastDrinkAt && lastDrinkAt > dayStart ? lastDrinkAt : dayStart
  const hours = (now.getTime() - from.getTime()) / HOUR_MS
  const { thirstStartH, thirstMaxH } = REACTIONS
  return Math.min(1, Math.max(0, (hours - thirstStartH) / (thirstMaxH - thirstStartH)))
}

export function coffeeActive(lastCoffeeAt: Date | null, now: Date): boolean {
  if (!lastCoffeeAt) return false
  const min = (now.getTime() - lastCoffeeAt.getTime()) / 60_000
  return min >= 0 && min <= REACTIONS.coffeeMin
}

export type CrownTier = 0 | 7 | 14 | 30

export function streakAccessory(currentStreak: number): CrownTier {
  const tiers = REACTIONS.streakTiers
  for (let i = tiers.length - 1; i >= 0; i--) if (currentStreak >= tiers[i]) return tiers[i]
  return 0
}

/**
 * Quale traguardo festeggiare ora (il più alto raggiunto e non ancora festeggiato)
 * e cosa memorizzare. Sotto i 7 giorni si azzera, così al ritorno a 7 si festeggia di nuovo.
 */
export function nextStreakReward(
  currentStreak: number,
  celebrated: CrownTier,
): { celebrate: CrownTier | null; store: CrownTier } {
  const tier = streakAccessory(currentStreak)
  if (tier === 0) return { celebrate: null, store: 0 }
  if (tier > celebrated) return { celebrate: tier, store: tier }
  return { celebrate: null, store: celebrated }
}
