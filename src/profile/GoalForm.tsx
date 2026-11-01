import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { formatLiters } from '../domain/format'
import { goalChangeDate, goalForDate, LEADERBOARD_MIN_GOAL_ML, parseGoalLiters } from '../domain/goals'
import { supabase } from '../lib/supabase'

function deviceOrProfileTz(tz?: string) {
  return tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
}

export async function setGoal(userId: string, goalMl: number, now: Date, tz: string) {
  const { error } = await supabase
    .from('goal_changes')
    .upsert({ user_id: userId, effective_from: goalChangeDate(now, tz), goal_ml: goalMl }, { onConflict: 'user_id,effective_from' })
  if (error) throw new Error(error.message)
}

export function GoalForm() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const userId = user?.id ?? null
  const tz = deviceOrProfileTz(profile?.tz)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [savedMl, setSavedMl] = useState<number | null>(null)

  useEffect(() => {
    if (!userId) return
    Promise.resolve(supabase.from('goal_changes').select('effective_from, goal_ml').eq('user_id', userId)).then(({ data }) => {
      if (!data) return
      const rows = (data as { effective_from: string; goal_ml: number }[]).map((r) => ({
        effectiveFrom: r.effective_from,
        goalMl: r.goal_ml,
      }))
      const current = goalForDate(rows, goalChangeDate(new Date(), tz))
      setText(formatLiters(current).replace(' L', ''))
    })
  }, [userId, tz])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSavedMl(null)
    const goalMl = parseGoalLiters(text)
    if (goalMl === null) return setError('Inserisci un obiettivo tra 0,1 e 10 litri')
    if (!userId) return
    setError(null)
    try {
      await setGoal(userId, goalMl, new Date(), tz)
      setSavedMl(goalMl)
    } catch {
      setError('Salvataggio non riuscito. Controlla la connessione e riprova')
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <label>
        Obiettivo giornaliero (litri)
        <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      {savedMl !== null && <p role="status" className="hint">Valido da domani: {formatLiters(savedMl)} al giorno.</p>}
      {savedMl !== null && savedMl < LEADERBOARD_MIN_GOAL_ML && (
        <p className="hint">Con un obiettivo sotto 1,5 L non entri in classifica.</p>
      )}
      <button className="secondary">Salva obiettivo</button>
    </form>
  )
}
