import { supabase } from '../lib/supabase'
import { setGoal } from '../profile/GoalForm'

/** Obiettivo valido da oggi: il server lo accetta solo per un utente appena registrato, senza bevute. */
export async function setInitialGoalToday(goalMl: number): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('set_initial_goal', { p_goal_ml: goalMl })
    return !error
  } catch {
    // Offline o funzione assente.
    return false
  }
}

/**
 * Obiettivo valido da oggi se il server lo permette; altrimenti si ripiega sul cambio ordinario,
 * valido da domani. Lancia solo se anche quello fallisce.
 */
export async function setInitialGoal(userId: string, goalMl: number, tz: string): Promise<'today' | 'tomorrow'> {
  if (await setInitialGoalToday(goalMl)) return 'today'
  await setGoal(userId, goalMl, new Date(), tz)
  return 'tomorrow'
}
