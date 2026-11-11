import { supabase } from '../lib/supabase'
import { setGoal } from '../profile/GoalForm'

/**
 * Obiettivo valido da oggi se il server lo permette (utente appena registrato, senza bevute);
 * altrimenti si ripiega sul cambio ordinario, valido da domani. Lancia solo se anche quello fallisce.
 */
export async function setInitialGoal(userId: string, goalMl: number, tz: string): Promise<'today' | 'tomorrow'> {
  try {
    const { error } = await supabase.rpc('set_initial_goal', { p_goal_ml: goalMl })
    if (!error) return 'today'
  } catch {
    // Offline o funzione assente: provo il cambio ordinario.
  }
  await setGoal(userId, goalMl, new Date(), tz)
  return 'tomorrow'
}
