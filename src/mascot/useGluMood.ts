import { useEffect, useMemo, useRef, useState } from 'react'
import { goalForDate, type GoalChange } from '../domain/goals'
import { addDays, localParts } from '../domain/time'
import { readCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { usePauses } from '../pause/usePauses'
import { computeStats, type DayTotal } from '../history/stats'
import { pausedDays, type PausePeriod } from '../pause/pauses'
import { saveStreak } from './accessories'
import { isGluCalm } from './calm'
import type { GluExtras } from './Glu'
import { isAsleep, pickMood, type GluMood } from './mood'
import { REACTIONS, type CrownTier } from './reactions'
import { useGluReactions } from './useGluReactions'

const JUST_DRANK_MS = 1500
const HELLO_MS = 3000
const SAD_MS = 4000

interface Input {
  userId: string | null
  tz: string
  totalMl: number
  goalMl: number
  expectedMl: number | null
  todayMinutes: number[]
  /** Aumenta a ogni bevuta. */
  pulse: number
  /** Obiettivi in vigore, per sapere se ieri è andata a buon fine. */
  goals: GoalChange[]
  levelUp?: boolean
  /** Solo con lo stile Glu: altrimenti nessuna richiesta e nessun timer. */
  enabled?: boolean
  lastDrinkAt?: Date | null
  lastCoffeeAt?: Date | null
  workoutActive?: boolean
  /** Quando l'allenamento è stato acceso in questa sessione. */
  workoutStartedAt?: number | null
  /** Aumenti dell'obiettivo per giorno, per contare la serie come lo Storico. */
  boosts?: Map<string, number>
  /** Gli obiettivi arrivati dal server (non quelli della cache): senza, la serie non si calcola. */
  goalsLoaded?: boolean
}

export interface GluState {
  mood: GluMood
  extras: GluExtras
  streakCelebrate: CrownTier | null
}

/** L'umore di Glu: i segnali del giorno (bevute, pause, ieri) messi in ordine da `pickMood`. */
export function useGluMood({
  userId,
  tz,
  totalMl,
  goalMl,
  expectedMl,
  todayMinutes,
  pulse,
  goals,
  levelUp = false,
  enabled = true,
  lastDrinkAt = null,
  lastCoffeeAt = null,
  workoutActive = false,
  workoutStartedAt = null,
  boosts,
  goalsLoaded = true,
}: Input): GluState {
  const [now, setNow] = useState(() => new Date())
  const [justDrank, setJustDrank] = useState(false)
  const [firstOpenToday, setFirstOpenToday] = useState(false)
  const [sadShown, setSadShown] = useState(() => !!userId && readCache<string>(`bere.gluSad.${userId}`) === localParts(new Date(), tz).date)
  const [yesterday, setYesterday] = useState<{ day: string; totals: DayTotal[] } | null>(null)

  const today = localParts(now, tz).date
  const nowMinutes = localParts(now, tz).minutes
  const pauses = usePauses(enabled ? userId : null, today)
  const { loaded: pausesLoaded, current: pause } = pauses

  // Il fumetto e l'umore dipendono dall'ora: si ricalcola ogni minuto.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  // Ogni bevuta fa «glu glu» per un attimo (la bevuta nuova riparte da capo il conto).
  const [seenPulse, setSeenPulse] = useState(pulse)
  if (pulse !== seenPulse) {
    setSeenPulse(pulse)
    if (pulse > 0) setJustDrank(true)
  }
  useEffect(() => {
    if (!justDrank) return
    const timer = setTimeout(() => setJustDrank(false), JUST_DRANK_MS)
    return () => clearTimeout(timer)
  }, [justDrank, seenPulse])

  // Il saluto spetta una volta al giorno. I timer non si fermano al cleanup: lo StrictMode rilancia l'effetto
  // e la seconda volta il giorno risulta già segnato.
  const greeted = useRef<string | null>(null)
  useEffect(() => {
    if (!enabled || !userId || greeted.current === `${userId}:${today}`) return
    greeted.current = `${userId}:${today}`
    const key = `bere.gluHello.${userId}`
    if (readCache<string>(key) !== today) {
      writeCache(key, today)
      setFirstOpenToday(true)
      setTimeout(() => setFirstOpenToday(false), HELLO_MS)
    }
  }, [enabled, userId, today])

  // Ieri: serve solo il totale di quel giorno. Dopo un errore l'umore triste semplicemente non c'è.
  const yesterdayDate = addDays(today, -1)
  useEffect(() => {
    if (!enabled || !userId) return
    let active = true
    Promise.resolve(supabase.rpc('daily_totals')).then(({ data, error }) => {
      if (!active) return
      setYesterday(error ? null : { day: yesterdayDate, totals: (data ?? []) as DayTotal[] })
    })
    return () => {
      active = false
    }
  }, [enabled, userId, yesterdayDate])

  // La serie viene dai totali già letti per «ieri», con la bevuta di oggi aggiunta (il 7º giorno la corona arriva subito).
  // Senza totali, obiettivi o pause dal server (errore o non ancora arrivati) niente corona: i segnaposto darebbero una serie più bassa.
  const yesterdayTotals = yesterday?.totals ?? null
  const currentStreak = useMemo(
    () => (yesterdayTotals && goalsLoaded && pausesLoaded ? streakWithToday(yesterdayTotals, totalMl, goals, today, boosts, pauses.periods) : null),
    [yesterdayTotals, goalsLoaded, pausesLoaded, totalMl, goals, today, boosts, pauses.periods],
  )
  useEffect(() => {
    if (userId && currentStreak !== null) saveStreak(userId, currentStreak)
  }, [userId, currentStreak])

  const asleep = isAsleep({ paused: !!pause, todayMinutes, nowMinutes })
  const calm = useMemo(() => !!userId && isGluCalm(userId), [userId])
  const reactions = useGluReactions({
    userId: enabled ? userId : null,
    tz,
    lastDrinkAt,
    lastCoffeeAt,
    workoutActive,
    workoutStartedAt,
    currentStreak,
    dayStartMin: todayMinutes.length ? Math.min(...todayMinutes) : REACTIONS.defaultDayStartMin,
    asleep,
    calm,
  })

  const mood = pickMood({
    nowMinutes,
    totalMl,
    goalMl,
    expectedMl,
    todayMinutes,
    paused: !!pause,
    justDrank,
    levelUp,
    firstOpenToday,
    yesterdayMet: yesterdayMet(yesterday, goals),
    sadShown,
    ...reactions.mood,
  })

  // La tristezza dura 4 s e si vede una volta al giorno: il giorno si segna quando compare davvero
  // (dopo il saluto, se c'è) e resta segnato anche se si cambia scheda.
  const sad = enabled && mood === 'sad'
  useEffect(() => {
    if (!sad || !userId) return
    writeCache(`bere.gluSad.${userId}`, today)
    const timer = setTimeout(() => setSadShown(true), SAD_MS)
    return () => clearTimeout(timer)
  }, [sad, userId, today])

  return { mood, extras: reactions.extras, streakCelebrate: reactions.streakCelebrate }
}

// Senza nessun giorno registrato prima di oggi (account nuovo) non c'è un «ieri» da rimpiangere.
function yesterdayMet(yesterday: { day: string; totals: DayTotal[] } | null, goals: GoalChange[]): boolean | null {
  if (!yesterday) return null
  const { day, totals } = yesterday
  if (!totals.some((t) => t.day <= day)) return null
  const total = totals.find((t) => t.day === day)?.total_ml ?? 0
  return total >= goalForDate(goals, day)
}

/** Serie con la bevuta di oggi (se più alta del totale già letto) aggiunta ai giorni passati. */
function streakWithToday(totals: DayTotal[], totalMl: number, goals: GoalChange[], today: string, boosts: Map<string, number> | undefined, periods: PausePeriod[]): number {
  const withToday = totals.some((t) => t.day === today)
    ? totals.map((t) => (t.day === today ? { ...t, total_ml: Math.max(t.total_ml, totalMl) } : t))
    : [...totals, { day: today, total_ml: totalMl, drinks: 0 }]
  return computeStats(withToday, goals, today, boosts, pausedDays(periods, today)).currentStreak
}
