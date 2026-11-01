import { useEffect, useState } from 'react'
import { goalForDate, type GoalChange } from '../domain/goals'
import { localParts } from '../domain/time'
import { supabase } from '../lib/supabase'

export function useGoalMl(userId: string | null, tz: string): number {
  const [goalMl, setGoalMl] = useState(3000)

  useEffect(() => {
    if (!userId) return
    Promise.resolve(supabase.from('goal_changes').select('effective_from, goal_ml').eq('user_id', userId)).then(({ data }) => {
      if (!data) return
      const rows = (data as { effective_from: string; goal_ml: number }[]).map(
        (r): GoalChange => ({ effectiveFrom: r.effective_from, goalMl: r.goal_ml }),
      )
      setGoalMl(goalForDate(rows, localParts(new Date(), tz).date))
    })
  }, [userId, tz])

  return goalMl
}
