import { dueLateness } from '../_shared/reminders.ts'
import { localParts } from '../_shared/time.ts'

/** Entro questa finestra un promemoria in ritardo parte ancora; dopo viene registrato come mancato. */
export const SEND_WINDOW_MIN = 5
const LOOKBACK_MIN = 60
const PUSH_TIMEOUT_MS = 10_000
const MINUTE_MS = 60_000

export interface Subscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface ReminderRow {
  schedule_time_id: string
  user_id: string
  minutes: number
  weekdays: number[]
  tz: string
  drink_ml: number
  created_at?: string
  subscriptions: Subscription[]
  goal_reached?: boolean
}

export interface PushPayload {
  title: string
  body: string
  url: string
  logId: string
}

export type LogStatus = 'pending' | 'sent' | 'failed' | 'missed' | 'no-device'

export interface Claim {
  userId: string
  scheduleTimeId: string
  date: string
  scheduledAt: Date
  status: LogStatus
}

export interface Deps {
  load(): Promise<ReminderRow[]>
  /** Registra l'invio previsto; restituisce null se esiste già. */
  claim(claim: Claim): Promise<string | null>
  /** Riprende un invio fallito o interrotto; restituisce null se non è ripartibile. */
  reclaim(claim: Pick<Claim, 'userId' | 'scheduleTimeId' | 'scheduledAt'>): Promise<string | null>
  /** Registra che il job è vivo, anche quando non c'è nulla da inviare. */
  heartbeat(): Promise<void>
  /** Invia e restituisce lo stato HTTP del servizio push. */
  push(subscription: Subscription, payload: PushPayload): Promise<number>
  removeSubscription(id: string): Promise<void>
  touchSubscription(id: string): Promise<void>
  markResult(logId: string, status: LogStatus, sentAt?: Date): Promise<void>
}

export interface Send {
  row: ReminderRow
  date: string
  late: number
  scheduledAt: Date
  kind: 'send' | 'missed'
}

export interface Summary {
  sent: number
  missed: number
  failed: number
  errors: number
}

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return 'indirizzo non valido'
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`nessuna risposta in ${ms} ms`)), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

export function planSends(rows: ReminderRow[], now: Date, onError: (error: unknown) => void = () => {}): Send[] {
  const minuteStart = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS
  const sends: Send[] = []
  for (const row of rows) {
    // Un dato errato in una riga non deve fermare i promemoria di tutti gli altri.
    try {
      const due = dueLateness(row, now, row.tz, LOOKBACK_MIN)
      if (!due) continue
      const scheduledAt = new Date(minuteStart - due.late * MINUTE_MS)
      // Un orario aggiunto dopo il suo momento non è un promemoria mancato.
      if (row.created_at && Date.parse(row.created_at) > scheduledAt.getTime()) continue
      // Nella notte del cambio ora la stessa ora locale si ripete: conta solo la prima volta.
      const hourBefore = localParts(new Date(scheduledAt.getTime() - 60 * MINUTE_MS), row.tz)
      if (hourBefore.date === due.date && hourBefore.minutes === row.minutes) continue
      sends.push({ row, date: due.date, late: due.late, scheduledAt, kind: due.late < SEND_WINDOW_MIN ? 'send' : 'missed' })
    } catch (error) {
      onError(error)
    }
  }
  return sends
}

/** Invia a ogni dispositivo: basta che uno sia raggiunto perché l'invio risulti riuscito. */
export async function sendToDevices(
  deps: Pick<Deps, 'push' | 'removeSubscription' | 'touchSubscription'>,
  subscriptions: Subscription[],
  payload: PushPayload,
): Promise<LogStatus> {
  if (subscriptions.length === 0) return 'no-device'
  const outcomes = await Promise.all(
    subscriptions.map(async (subscription): Promise<'ok' | 'gone' | 'error'> => {
      try {
        const status = await withTimeout(deps.push(subscription, payload), PUSH_TIMEOUT_MS)
        if (status === 404 || status === 410) {
          await deps.removeSubscription(subscription.id)
          return 'gone'
        }
        if (status >= 200 && status < 300) {
          await deps.touchSubscription(subscription.id)
          return 'ok'
        }
        console.error(`push rifiutato con stato ${status}`, hostOf(subscription.endpoint))
        return 'error'
      } catch (error) {
        console.error(`push non riuscito: ${error instanceof Error ? error.message : 'errore'}`, hostOf(subscription.endpoint))
        return 'error'
      }
    }),
  )
  if (outcomes.includes('ok')) return 'sent'
  return outcomes.includes('error') ? 'failed' : 'no-device'
}

export async function runSendReminders(deps: Deps, now: Date): Promise<Summary> {
  const summary: Summary = { sent: 0, missed: 0, failed: 0, errors: 0 }
  await deps.heartbeat().catch((error) => console.error('segno di vita non registrato', error))
  // Chi ha raggiunto l'obiettivo e ha chiesto di fermarsi non deve risultare neppure come promemoria mancato.
  const rows = (await deps.load()).filter((row) => !row.goal_reached)
  const plans = planSends(rows, now, (error) => {
    summary.errors++
    console.error('riga non valida', error)
  })
  await Promise.all(
    plans.map(async ({ row, date, scheduledAt, kind }) => {
      try {
        const target = { userId: row.user_id, scheduleTimeId: row.schedule_time_id, scheduledAt }
        let logId = await deps.claim({ ...target, date, status: kind === 'missed' ? 'missed' : 'pending' })
        // Già registrato: entro la finestra si riprova se il tentativo precedente non è andato a buon fine.
        if (!logId && kind === 'send') logId = await deps.reclaim(target)
        if (!logId) return
        if (kind === 'missed') {
          summary.missed++
          return
        }
        const status = await sendToDevices(deps, row.subscriptions, {
          title: 'È ora di bere',
          body: `${row.drink_ml} ml`,
          url: '#/home',
          logId,
        })
        await deps.markResult(logId, status, status === 'sent' ? now : undefined)
        if (status === 'sent') summary.sent++
        if (status === 'failed') summary.failed++
      } catch (error) {
        // Un errore su un utente non deve fermare gli altri.
        summary.errors++
        console.error('invio interrotto', error)
      }
    }),
  )
  return summary
}

export async function handleRequest(request: Request, secret: string, run: () => Promise<Summary>): Promise<Response> {
  if (!secret || request.headers.get('x-cron-secret') !== secret) {
    return new Response('unauthorized', { status: 401 })
  }
  const summary = await run()
  return Response.json(summary)
}
