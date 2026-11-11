import { useEffect, useRef, useState } from 'react'
import { goalForDate, type GoalChange } from '../domain/goals'
import { addDays, localParts } from '../domain/time'
import { readCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { usePauses } from '../pause/usePauses'
import { pickMood, type GluMood } from './mood'

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
}

interface DayTotal {
  day: string
  total_ml: number
}

/** L'umore di Glu: i segnali del giorno (bevute, pause, ieri) messi in ordine da `pickMood`. */
export function useGluMood({ userId, tz, totalMl, goalMl, expectedMl, todayMinutes, pulse, goals, levelUp = false }: Input): GluMood {
  const [now, setNow] = useState(() => new Date())
  const [justDrank, setJustDrank] = useState(false)
  const [firstOpenToday, setFirstOpenToday] = useState(false)
  const [sadShown, setSadShown] = useState(false)
  const [yesterday, setYesterday] = useState<{ day: string; totals: DayTotal[] } | null>(null)

  const { date: today, minutes: nowMinutes } = localParts(now, tz)
  const { current: pause } = usePauses(userId, today)

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
    if (!userId || greeted.current === userId) return
    greeted.current = userId
    const key = `bere.gluHello.${userId}`
    if (readCache<string>(key) !== today) {
      writeCache(key, today)
      setFirstOpenToday(true)
      setTimeout(() => setFirstOpenToday(false), HELLO_MS)
    }
    setTimeout(() => setSadShown(true), SAD_MS)
  }, [userId, today])

  // Ieri: serve solo il totale di quel giorno. Dopo un errore l'umore triste semplicemente non c'è.
  const yesterdayDate = addDays(today, -1)
  useEffect(() => {
    if (!userId) return
    let active = true
    Promise.resolve(supabase.rpc('daily_totals')).then(({ data, error }) => {
      if (!active) return
      setYesterday(error ? null : { day: yesterdayDate, totals: (data ?? []) as DayTotal[] })
    })
    return () => {
      active = false
    }
  }, [userId, yesterdayDate])

  return pickMood({
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
  })
}

// Senza nessun giorno registrato prima di oggi (account nuovo) non c'è un «ieri» da rimpiangere.
function yesterdayMet(yesterday: { day: string; totals: DayTotal[] } | null, goals: GoalChange[]): boolean | null {
  if (!yesterday) return null
  const { day, totals } = yesterday
  if (!totals.some((t) => t.day <= day)) return null
  const total = totals.find((t) => t.day === day)?.total_ml ?? 0
  return total >= goalForDate(goals, day)
}
