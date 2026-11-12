import { useEffect, useState } from 'react'
import { readCache, writeCache } from '../lib/cache'
import { localParts } from '../domain/time'
import type { GluExtras } from './Glu'
import { coffeeActive, nextStreakReward, REACTIONS, streakAccessory, thirstLevel, type CrownTier } from './reactions'

const CELEBRATE_MS = 6000

interface Input {
  userId: string | null
  tz: string
  lastDrinkAt: Date | null
  lastCoffeeAt: Date | null
  workoutActive: boolean
  /** Quando l'allenamento è stato acceso in questa sessione (non al caricamento). */
  workoutStartedAt: number | null
  /** null se la serie non è (ancora) nota: nessuna corona. */
  currentStreak: number | null
  dayStartMin: number
  /** Obiettivo raggiunto: Glu ha sete ma non rimprovera. */
  goalMet: boolean
  asleep: boolean
  calm: boolean
}

interface Output {
  extras: GluExtras
  mood: { coffee: boolean; workoutJustStarted: boolean; thirst: number }
  streakCelebrate: CrownTier | null
}

/** Le reazioni di Glu ai dati veri: sete, caffè, allenamento, serie. Si ricalcola ogni minuto. */
export function useGluReactions(input: Input): Output {
  const { userId, tz, lastDrinkAt, lastCoffeeAt, workoutActive, workoutStartedAt, currentStreak, dayStartMin, goalMet, asleep, calm } = input
  const [clock, setClock] = useState(() => new Date())
  const [sceneDone, setSceneDone] = useState<number | null>(null)
  const [coffeeDone, setCoffeeDone] = useState<number | null>(null)
  const [celebrate, setCelebrate] = useState<CrownTier | null>(null)

  // La sete cresce anche se i dati non cambiano: orologio al minuto.
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  // Una bevuta o un caffè appena segnati non possono stare nel futuro rispetto all'orologio.
  const now = new Date(Math.max(clock.getTime(), lastDrinkAt?.getTime() ?? 0, lastCoffeeAt?.getTime() ?? 0))

  // L'effetto del caffè dura 4 s da quando lo si segna: poi un timer lo spegne (l'orologio va al minuto).
  const coffeeAt = lastCoffeeAt?.getTime() ?? null
  useEffect(() => {
    if (coffeeAt === null) return
    const left = Math.max(0, coffeeAt + REACTIONS.coffeeMs - Date.now())
    const timer = setTimeout(() => setCoffeeDone(coffeeAt), left)
    return () => clearTimeout(timer)
  }, [coffeeAt])

  // La scenetta dell'allenamento dura 6 s dal momento in cui lo si accende.
  useEffect(() => {
    if (workoutStartedAt === null) return
    const timer = setTimeout(() => setSceneDone(workoutStartedAt), REACTIONS.workoutSceneMs)
    return () => clearTimeout(timer)
  }, [workoutStartedAt])
  const scene = workoutStartedAt !== null && sceneDone !== workoutStartedAt
  // La corona cade la prima volta che si raggiunge un traguardo; di notte si aspetta la mattina.
  useEffect(() => {
    if (!userId || currentStreak === null || asleep) return
    const key = `bere.streakReward.${userId}`
    const celebrated = (readCache<number>(key) ?? 0) as CrownTier
    const { celebrate: tier, store } = nextStreakReward(currentStreak, celebrated)
    if (store !== celebrated) writeCache(key, store)
    if (!tier) return
    // I timer non si fermano al cleanup: lo StrictMode rilancia l'effetto e la seconda volta il traguardo risulta già segnato.
    setTimeout(() => setCelebrate(tier), 0)
    setTimeout(() => setCelebrate(null), CELEBRATE_MS)
  }, [userId, currentStreak, asleep])

  const quiet = asleep || calm
  const { minutes } = localParts(now, tz)
  // Inizio giornata in questo fuso: ora corrente meno i minuti passati da quel momento.
  const dayStart = new Date(now.getTime() - (minutes - dayStartMin) * 60_000 - (now.getTime() % 60_000))
  const thirst = quiet || goalMet ? 0 : thirstLevel(lastDrinkAt, now, dayStart)
  const coffee = !quiet && coffeeDone !== coffeeAt && coffeeActive(lastCoffeeAt, now)
  const workoutJustStarted = !quiet && scene
  const crown = currentStreak === null ? 0 : streakAccessory(currentStreak)

  return {
    extras: {
      thirst,
      jitter: coffee,
      headband: workoutActive,
      sweat: workoutJustStarted,
      crown,
      crownDrop: !calm && celebrate !== null,
      fan: thirst >= 1,
    },
    mood: { coffee, workoutJustStarted, thirst },
    streakCelebrate: celebrate,
  }
}
