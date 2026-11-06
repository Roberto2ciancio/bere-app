import { createClient } from 'npm:@supabase/supabase-js@2'
import { pushMessage } from '../_shared/webpush.ts'
import { handleRequest, runSendReminders, type Deps, type ReminderRow } from './core.ts'
import { runSocial, type EveningRow, type GoalAlertRow, type NudgeRow, type WeeklyRow } from './social.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

const deps: Deps = {
  async load() {
    const { data, error } = await db.rpc('reminder_rows')
    fail(error)
    return (data ?? []) as ReminderRow[]
  },
  async claim({ userId, scheduleTimeId, date, scheduledAt, status }) {
    const { data, error } = await db
      .from('push_log')
      .upsert(
        { user_id: userId, schedule_time_id: scheduleTimeId, scheduled_date: date, scheduled_at: scheduledAt.toISOString(), status },
        { onConflict: 'user_id,schedule_time_id,scheduled_at', ignoreDuplicates: true },
      )
      .select('id')
    fail(error)
    return (data?.[0]?.id as string | undefined) ?? null
  },
  async reclaim({ userId, scheduleTimeId, scheduledAt }) {
    const { data, error } = await db.rpc('reclaim_push', { p_user: userId, p_time: scheduleTimeId, p_at: scheduledAt.toISOString() })
    fail(error)
    return (data as string | null) ?? null
  },
  async heartbeat() {
    fail((await db.from('service_status').update({ last_run_at: new Date().toISOString() }).eq('id', 1)).error)
  },
  push: pushMessage,
  async removeSubscription(id) {
    fail((await db.from('push_subscriptions').delete().eq('id', id)).error)
  },
  async touchSubscription(id) {
    fail((await db.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', id)).error)
  },
  async markResult(logId, status, sentAt) {
    fail((await db.from('push_log').update({ status, sent_at: sentAt?.toISOString() ?? null }).eq('id', logId)).error)
  },
}

// In parallelo: se i promemoria falliscono, gli avvisi sociali partono lo stesso (e viceversa).
async function run() {
  const [reminders, social] = await Promise.all([runSendReminders(deps, new Date()), runSocial({
    ...deps,
    async takeGoalAlerts() {
      const { data, error } = await db.rpc('take_goal_alerts')
      fail(error)
      return (data ?? []) as GoalAlertRow[]
    },
    async takeNudges() {
      const { data, error } = await db.rpc('take_inactivity_nudges')
      fail(error)
      return (data ?? []) as NudgeRow[]
    },
    async takeEveningSummaries() {
      const { data, error } = await db.rpc('take_evening_summaries')
      fail(error)
      return (data ?? []) as EveningRow[]
    },
    async takeWeeklyReports() {
      const { data, error } = await db.rpc('take_weekly_reports')
      fail(error)
      return (data ?? []) as WeeklyRow[]
    },
  })])
  return { ...reminders, ...social }
}

Deno.serve((request) => handleRequest(request, Deno.env.get('CRON_SECRET') ?? '', run))
