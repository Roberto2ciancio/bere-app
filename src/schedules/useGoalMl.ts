import { useEffect, useState } from 'react'
import { DEFAULT_GOAL_ML, goalForDate, type GoalChange } from '../domain/goals'
import { localParts } from '../domain/time'
import { readCache } from '../lib/cache'
import { supabase } from '../lib/supabase'

/** L'obiettivo di oggi; null finché non si sa (prima la copia salvata dalla Home, poi il server). */
export function useTodayGoalMl(userId: string | null, tz: string): number | null {
  const [goalMl, setGoalMl] = useState<number | null>(() => {
    const cached = userId ? readCache<GoalChange[]>(`bere.goals.${userId}`) : null
    return cached?.length ? goalForDate(cached, localParts(new Date(), tz).date) : null
  })

  useEffect(() => {
    if (!userId) return
    let active = true
    Promise.resolve(supabase.from('goal_changes').select('effective_from, goal_ml').eq('user_id', userId)).then(({ data }) => {
      if (!active || !data) return
      const rows = (data as { effective_from: string; goal_ml: number }[]).map(
        (r): GoalChange => ({ effectiveFrom: r.effective_from, goalMl: r.goal_ml }),
      )
      setGoalMl(goalForDate(rows, localParts(new Date(), tz).date))
    })
    return () => {
      active = false
    }
  }, [userId, tz])

  return goalMl
}

export function useGoalMl(userId: string | null, tz: string): number {
  return useTodayGoalMl(userId, tz) ?? DEFAULT_GOAL_ML
}
