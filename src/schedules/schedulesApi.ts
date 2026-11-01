import { supabase } from '../lib/supabase'

export interface Schedule {
  id: string
  name: string
  weekdays: number[]
  enabled: boolean
  times: { id: string; minutes: number }[]
}

export async function listSchedules(userId: string): Promise<Schedule[]> {
  const { data: schedules, error } = await supabase.from('schedules').select('*').eq('user_id', userId)
  if (error) throw new Error(error.message)
  const rows = (schedules ?? []) as Omit<Schedule, 'times'>[]
  if (rows.length === 0) return []
  const { data: times, error: timesError } = await supabase
    .from('schedule_times')
    .select('*')
    .in('schedule_id', rows.map((s) => s.id))
    .order('minutes')
  if (timesError) throw new Error(timesError.message)
  const list = (times ?? []) as { id: string; schedule_id: string; minutes: number }[]
  return rows.map((s) => ({
    ...s,
    times: list.filter((t) => t.schedule_id === s.id).map((t) => ({ id: t.id, minutes: t.minutes })),
  }))
}

export function toReminders(schedules: Schedule[]) {
  return schedules
    .filter((s) => s.enabled)
    .flatMap((s) => s.times.map((t) => ({ weekdays: s.weekdays, minutes: t.minutes })))
}

/** Due programmi attivi con lo stesso orario nello stesso giorno mandano due notifiche identiche. */
export function hasDuplicateReminders(schedules: Schedule[]): boolean {
  const seen = new Set<string>()
  for (const reminder of toReminders(schedules)) {
    for (const day of reminder.weekdays) {
      const key = `${day}-${reminder.minutes}`
      if (seen.has(key)) return true
      seen.add(key)
    }
  }
  return false
}

export interface ScheduleDraft {
  id?: string
  name: string
  weekdays: number[]
  enabled: boolean
  minutes: number[]
}

export async function saveSchedule(userId: string, draft: ScheduleDraft): Promise<string> {
  const fields = { name: draft.name, weekdays: draft.weekdays, enabled: draft.enabled }
  let id = draft.id
  if (id) {
    const { error } = await supabase.from('schedules').update(fields).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await supabase.from('schedules').insert({ ...fields, user_id: userId }).select().single()
    if (error) throw new Error(error.message)
    id = (data as { id: string }).id
  }
  const { data: rows, error } = await supabase.from('schedule_times').select('*').eq('schedule_id', id)
  if (error) throw new Error(error.message)
  // Gli orari rimasti tengono il loro id: il registro delle notifiche resta collegato.
  const existing = (rows ?? []) as { id: string; minutes: number }[]
  const removed = existing.filter((t) => !draft.minutes.includes(t.minutes)).map((t) => t.id)
  const added = draft.minutes.filter((m) => !existing.some((t) => t.minutes === m))
  if (removed.length > 0) {
    const { error } = await supabase.from('schedule_times').delete().in('id', removed)
    if (error) throw new Error(error.message)
  }
  if (added.length > 0) {
    const { error } = await supabase.from('schedule_times').insert(added.map((minutes) => ({ schedule_id: id, minutes })))
    if (error) throw new Error(error.message)
  }
  return id
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('schedules').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
