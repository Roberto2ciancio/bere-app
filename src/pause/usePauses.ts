import { useCallback, useEffect, useState } from 'react'
import { readCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { addDays } from '../domain/time'
import { currentPause, pauseRange, type PausePeriod } from './pauses'

/** Le pause dell'utente: le legge il server per non inviare notifiche, lo storico per non rompere la serie. */
export function usePauses(userId: string | null, today: string) {
  const cacheKey = `bere.pauses.${userId}`
  const [periods, setPeriods] = useState<PausePeriod[]>(() => (userId ? readCache<PausePeriod[]>(cacheKey) ?? [] : []))

  const store = useCallback(
    (next: PausePeriod[]) => {
      setPeriods(next)
      writeCache(cacheKey, next)
    },
    [cacheKey],
  )

  useEffect(() => {
    if (!userId) return
    let active = true
    void supabase
      .from('pause_periods')
      .select('id, start_date, end_date')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (active && !error && data) store(data as PausePeriod[])
      })
    return () => {
      active = false
    }
  }, [userId, store])

  const start = useCallback(
    async (days: number) => {
      if (!userId) return false
      const period: PausePeriod = { id: crypto.randomUUID(), ...pauseRange(today, days) }
      const { error } = await supabase.from('pause_periods').insert({ user_id: userId, ...period })
      if (error) return false
      store([...periods, period])
      return true
    },
    [userId, today, periods, store],
  )

  /** Riprendere oggi: le notifiche ripartono subito, i giorni già passati in pausa restano tali. */
  const resume = useCallback(async () => {
    const running = currentPause(periods, today)
    if (!userId || !running) return false
    const startedToday = running.start_date === today
    const query = supabase.from('pause_periods')
    const { error } = startedToday
      ? await query.delete().eq('id', running.id)
      : await query.update({ end_date: addDays(today, -1) }).eq('id', running.id)
    if (error) return false
    store(startedToday ? periods.filter((p) => p.id !== running.id) : periods.map((p) => (p.id === running.id ? { ...p, end_date: addDays(today, -1) } : p)))
    return true
  }, [userId, today, periods, store])

  return { periods, current: currentPause(periods, today), start, resume }
}
