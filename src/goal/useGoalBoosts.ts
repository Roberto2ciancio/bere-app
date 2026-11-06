import { useCallback, useEffect, useState } from 'react'
import { readCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { boostsByDay, heatBoostMl, maxTemperature, WORKOUT_BOOST_ML, type GoalBoost } from './boosts'

interface HeatPlace {
  enabled: boolean
  lat: number | null | undefined
  lon: number | null | undefined
}

/**
 * Aumenti dell'obiettivo dell'utente. Se il caldo è acceso, una volta al giorno legge la massima di oggi
 * e salva l'aumento: l'app lo vede subito, il server lo usa per promemoria e classifica.
 */
export function useGoalBoosts(userId: string | null, today: string, heat?: HeatPlace) {
  const cacheKey = `bere.boosts.${userId}`
  const [boosts, setBoosts] = useState<GoalBoost[]>(() => (userId ? readCache<GoalBoost[]>(cacheKey) ?? [] : []))

  const load = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase.from('goal_boosts').select('local_date, kind, extra_ml, note').eq('user_id', userId)
    if (error || !data) return
    setBoosts(data as GoalBoost[])
    writeCache(cacheKey, data)
  }, [userId, cacheKey])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(
    async (boost: GoalBoost) => {
      if (!userId) return false
      const { error } = await supabase.from('goal_boosts').upsert({ user_id: userId, ...boost }, { onConflict: 'user_id,local_date,kind' })
      if (error) return false
      setBoosts((list) => {
        const next = [...list.filter((b) => !(b.local_date === boost.local_date && b.kind === boost.kind)), boost]
        writeCache(cacheKey, next)
        return next
      })
      return true
    },
    [userId, cacheKey],
  )

  const remove = useCallback(
    async (day: string, kind: GoalBoost['kind']) => {
      if (!userId) return false
      const { error } = await supabase.from('goal_boosts').delete().eq('user_id', userId).eq('local_date', day).eq('kind', kind)
      if (error) return false
      setBoosts((list) => {
        const next = list.filter((b) => !(b.local_date === day && b.kind === kind))
        writeCache(cacheKey, next)
        return next
      })
      return true
    },
    [userId, cacheKey],
  )

  const setWorkout = useCallback(
    (day: string, on: boolean) => (on ? save({ local_date: day, kind: 'workout', extra_ml: WORKOUT_BOOST_ML, note: null }) : remove(day, 'workout')),
    [save, remove],
  )

  // Il meteo si legge una volta al giorno per posto: riaprire l'app non lo richiede di nuovo.
  const heatOn = heat?.enabled ?? false
  const lat = heat?.lat ?? null
  const lon = heat?.lon ?? null
  useEffect(() => {
    if (!userId || !heatOn || lat === null || lon === null) return
    const checkKey = `bere.heatChecked.${userId}`
    const stamp = `${today}:${lat},${lon}`
    try {
      if (localStorage.getItem(checkKey) === stamp) return
    } catch {
      // Senza spazio salvato si legge il meteo a ogni apertura.
    }
    let active = true
    maxTemperature(lat, lon)
      .then(async (celsius) => {
        if (!active) return
        const ml = heatBoostMl(celsius)
        const ok = ml > 0 ? await save({ local_date: today, kind: 'heat', extra_ml: ml, note: `${Math.round(celsius)} °C` }) : await remove(today, 'heat')
        if (ok) localStorage.setItem(checkKey, stamp)
      })
      .catch(() => {
        // Senza meteo l'obiettivo resta quello scelto: si riprova alla prossima apertura.
      })
    return () => {
      active = false
    }
  }, [userId, heatOn, lat, lon, today, save, remove])

  // Spento il caldo, l'aumento di oggi non vale più.
  const heatToday = boosts.some((b) => b.local_date === today && b.kind === 'heat')
  const heatDisabled = heat?.enabled === false
  useEffect(() => {
    if (userId && heatDisabled && heatToday) void remove(today, 'heat')
  }, [userId, heatDisabled, heatToday, today, remove])

  const todays = boosts.filter((b) => b.local_date === today)
  return {
    boosts,
    byDay: boostsByDay(boosts),
    heat: todays.find((b) => b.kind === 'heat') ?? null,
    workout: todays.find((b) => b.kind === 'workout') ?? null,
    setWorkout,
  }
}
