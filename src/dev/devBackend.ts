/**
 * Sostituisce Supabase nell'app di prova: tutto resta nella memoria del telefono e nulla
 * raggiunge il server vero, quindi niente account e niente tracce nella classifica vera.
 */
import { effectiveMl } from '../domain/hydration'
import { addDays } from '../domain/time'
import { pointsFromDays } from '../levels/levels'
import { readCache } from '../lib/cache'
import { storageKey } from '../lib/storageKey'
import { notificationOptions } from '../push/notification'

type Row = Record<string, unknown>
type DbError = { message: string } | null
interface Result {
  data: unknown
  error: DbError
}
interface Db {
  tables: Record<string, Row[]>
  files: Record<string, string>
  signedOut: boolean
  email: string
}

export const DEV_USER_ID = '00000000-0000-4000-8000-00000000de00'
const DB_KEY = storageKey('bere.dev.db')

function seed(): Db {
  return {
    tables: {
      profiles: [{
        id: DEV_USER_ID,
        display_name: 'Prova',
        avatar_path: null,
        background_path: null,
        home_style: 'bottle',
        sound: 'goccia',
        drink_ml: 200,
        tz: new Intl.DateTimeFormat().resolvedOptions().timeZone,
      }],
      goal_changes: [{ user_id: DEV_USER_ID, effective_from: '2020-01-01', goal_ml: 3000 }],
    },
    files: {},
    signedOut: false,
    email: 'prova@bere.dev',
  }
}

function load(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY)
    return raw ? (JSON.parse(raw) as Db) : seed()
  } catch {
    return seed()
  }
}

function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    // Memoria piena, per esempio per le foto: i dati restano validi finché l'app è aperta.
  }
}

let db = load()
// Salvato subito, non alla prima modifica: i test su telefono simulato lo preparano prima di aprire la pagina.
try {
  if (localStorage.getItem(DB_KEY) === null) persist()
} catch {
  // Senza spazio salvato l'app di prova funziona lo stesso, in memoria.
}

export function resetDevData() {
  db = seed()
  persist()
}

const rowsOf = (table: string) => (db.tables[table] ??= [])

class Query implements PromiseLike<Result> {
  private filters: ((row: Row) => boolean)[] = []
  private sort: { column: string; ascending: boolean } | null = null
  private max: number | null = null
  private skip = 0
  private one = false
  private action: () => Row[] | null = () => null
  private readonly table: string

  constructor(table: string) {
    this.table = table
  }

  select(_columns?: string) {
    return this
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]))
    return this
  }
  gte(column: string, value: string) {
    this.filters.push((row) => String(row[column]) >= value)
    return this
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.sort = { column, ascending: options?.ascending ?? true }
    return this
  }
  range(from: number, to: number) {
    this.skip = from
    this.max = to - from + 1
    return this
  }
  limit(max: number) {
    this.max = max
    return this
  }
  single() {
    this.one = true
    return this
  }
  maybeSingle() {
    return this.single()
  }
  insert(values: Row | Row[]) {
    this.action = () => {
      const added = [values].flat().map((row) => ({ id: crypto.randomUUID(), ...row }))
      rowsOf(this.table).push(...added)
      return added
    }
    return this
  }
  upsert(values: Row | Row[], options: { onConflict: string; ignoreDuplicates?: boolean }) {
    this.action = () => {
      const keys = options.onConflict.split(',')
      for (const value of [values].flat()) {
        const existing = rowsOf(this.table).find((row) => keys.every((key) => row[key] === value[key]))
        if (!existing) rowsOf(this.table).push({ id: crypto.randomUUID(), ...value })
        else if (!options.ignoreDuplicates) Object.assign(existing, value)
      }
      return []
    }
    return this
  }
  update(patch: Row) {
    this.action = () => {
      const matched = rowsOf(this.table).filter(this.matches)
      matched.forEach((row) => Object.assign(row, patch))
      return matched
    }
    return this
  }
  delete() {
    this.action = () => {
      db.tables[this.table] = rowsOf(this.table).filter((row) => !this.matches(row))
      return []
    }
    return this
  }

  private matches = (row: Row) => this.filters.every((filter) => filter(row))

  private run(): Result {
    if (this.table === 'service_status') {
      return { data: this.wrap([{ last_run_at: new Date().toISOString() }]), error: null }
    }
    const changed = this.action()
    if (changed) {
      persist()
      return { data: this.wrap(changed), error: null }
    }
    let rows = rowsOf(this.table).filter(this.matches)
    if (this.sort) {
      const { column, ascending } = this.sort
      rows = [...rows].sort((a, b) => ((a[column] as number) < (b[column] as number) ? -1 : 1) * (ascending ? 1 : -1))
    }
    if (this.max !== null) rows = rows.slice(this.skip, this.skip + this.max)
    return { data: this.wrap(rows), error: null }
  }

  private wrap(rows: Row[]) {
    return this.one ? (rows[0] ?? null) : rows
  }

  then<A = Result, B = never>(done?: ((value: Result) => A | PromiseLike<A>) | null, failed?: ((reason: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(done, failed)
  }
}

type Listener = (event: string, session: unknown) => void
const listeners = new Set<Listener>()
const currentSession = () => (db.signedOut ? null : { user: { id: DEV_USER_ID, email: db.email } })

function signIn(email: string) {
  db.signedOut = false
  db.email = email
  persist()
  listeners.forEach((listener) => listener('SIGNED_IN', currentSession()))
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function goalOn(day: string): number {
  const goals = rowsOf('goal_changes')
    .filter((g) => (g.effective_from as string) <= day)
    .sort((a, b) => ((a.effective_from as string) < (b.effective_from as string) ? 1 : -1))
  return (goals[0]?.goal_ml as number | undefined) ?? 3000
}

function leaderboard(week: string): Row[] {
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  let daysMet = 0
  let streak = 0
  let run = 0
  for (const day of days) {
    const total = rowsOf('drinks').filter((d) => d.local_date === day).reduce((sum, d) => sum + effectiveMl(d.amount_ml as number, (d.hydration_pct as number | undefined) ?? 100), 0)
    const goal = goalOn(day)
    run = total >= goal && goal >= 1500 ? run + 1 : 0
    if (run > 0) daysMet += 1
    streak = Math.max(streak, run)
  }
  const profile = rowsOf('profiles')[0]
  return [
    {
      user_id: DEV_USER_ID,
      display_name: String(profile?.display_name ?? 'Prova'),
      avatar_path: profile?.avatar_path ?? null,
      days_met: daysMet,
      streak,
    },
    { user_id: 'finto-1', display_name: 'Marta (finta)', avatar_path: null, days_met: 5, streak: 3 },
    { user_id: 'finto-2', display_name: 'Luca (finto)', avatar_path: null, days_met: 3, streak: 2 },
    { user_id: 'finto-3', display_name: 'Sara (finta)', avatar_path: null, days_met: 1, streak: 1 },
  ].sort((a, b) => b.days_met - a.days_met || b.streak - a.streak || a.display_name.localeCompare(b.display_name))
}

/** Stesse regole della funzione SQL get_levels; gli amici finti hanno punti fissi. */
function levels() {
  const points = pointsFromDays(dailyTotals().map((d) => ({ day: d.day, totalMl: d.total_ml, goalMl: goalOn(d.day) })))
  return [
    { user_id: DEV_USER_ID, points },
    { user_id: 'finto-1', points: 2350 },
    { user_id: 'finto-2', points: 640 },
    { user_id: 'finto-3', points: 90 },
  ]
}

function dailyTotals() {
  const days = new Map<string, { day: string; total_ml: number; drinks: number }>()
  for (const drink of rowsOf('drinks')) {
    const day = drink.local_date as string
    const entry = days.get(day) ?? { day, total_ml: 0, drinks: 0 }
    entry.total_ml += effectiveMl(drink.amount_ml as number, (drink.hydration_pct as number | undefined) ?? 100)
    entry.drinks += 1
    days.set(day, entry)
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day))
}

async function showLocal(title: string, body: string): Promise<'sent' | 'no-device' | 'failed'> {
  if (readCache<boolean>('bere.pushOff') || typeof Notification === 'undefined' || Notification.permission !== 'granted') return 'no-device'
  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('nessun service worker')), 3000)),
    ])
    await registration.showNotification(title, notificationOptions({ title, body, url: '#/home' }))
    return 'sent'
  } catch {
    return 'failed'
  }
}

function log(status: string, extra: Row = {}) {
  const now = new Date().toISOString()
  rowsOf('push_log').push({
    id: crypto.randomUUID(),
    user_id: DEV_USER_ID,
    scheduled_at: now,
    sent_at: status === 'sent' ? now : null,
    received_at: status === 'sent' ? now : null,
    status,
    ...extra,
  })
  persist()
}

/** Senza server i promemoria partono solo mentre l'app di prova è aperta. */
export async function checkDueReminders(now: Date) {
  const weekday = ((now.getDay() + 6) % 7) + 1
  const minutes = now.getHours() * 60 + now.getMinutes()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const active = rowsOf('schedules').filter((s) => s.enabled && (s.weekdays as number[]).includes(weekday))
  const due = rowsOf('schedule_times').filter((t) => t.minutes === minutes && active.some((s) => s.id === t.schedule_id))
  for (const time of due) {
    const done = rowsOf('push_log').some((l) => l.schedule_time_id === time.id && l.scheduled_date === date)
    if (done) continue
    // Si registra prima di attendere: due controlli ravvicinati non devono avvisare due volte.
    const entry = { schedule_time_id: time.id, scheduled_date: date }
    log('pending', entry)
    const status = await showLocal('È ora di bere', "Promemoria dell'app di prova")
    const row = rowsOf('push_log').find((l) => l.schedule_time_id === time.id && l.scheduled_date === date)
    if (row) Object.assign(row, { status, sent_at: status === 'sent' ? now.toISOString() : null, received_at: status === 'sent' ? now.toISOString() : null })
    persist()
  }
}

if (import.meta.env.MODE === 'devapp') {
  setInterval(() => void checkDueReminders(new Date()), 20_000)
}

const cheeredToday = new Set<string>()

export const supabase = {
  from: (table: string) => new Query(table),
  async rpc(name: string, args?: { week_start?: string }): Promise<Result> {
    if (name === 'daily_totals') return { data: dailyTotals(), error: null }
    if (name === 'get_levels') return { data: levels(), error: null }
    // Marta (finta) ha già raggiunto l'obiettivo oggi: così si vedono i complimenti in classifica.
    if (name === 'cheerable_today') return { data: [{ user_id: 'finto-1', cheered: cheeredToday.has('finto-1') }], error: null }
    return { data: name === 'get_leaderboard' ? leaderboard(args?.week_start ?? '') : null, error: null }
  },
  functions: {
    async invoke(name: string, _options?: unknown): Promise<Result> {
      if (name === 'poke') return { data: { status: 'sent' }, error: null }
      if (name === 'cheer') {
        const to = (_options as { body?: { to?: string } } | undefined)?.body?.to ?? ''
        if (cheeredToday.has(to)) return { data: { status: 'already' }, error: null }
        cheeredToday.add(to)
        return { data: { status: 'sent' }, error: null }
      }
      if (name === 'delete-account') {
        resetDevData()
        return { data: {}, error: null }
      }
      const status = await showLocal('È ora di bere', "Notifica di prova dell'app di prova")
      if (status !== 'no-device') log(status)
      return { data: { status }, error: null }
    },
  },
  storage: {
    from(bucket: string) {
      const key = (path: string) => `${bucket}/${path}`
      return {
        async upload(path: string, blob: Blob, _options?: unknown): Promise<{ error: DbError }> {
          db.files[key(path)] = await readAsDataUrl(blob)
          persist()
          return { error: null }
        },
        async remove(paths: string[]) {
          paths.forEach((path) => delete db.files[key(path)])
          persist()
          return { error: null }
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: db.files[key(path)] ?? '' } }),
        async createSignedUrl(path: string, _expires: number) {
          return { data: { signedUrl: db.files[key(path)] ?? '' }, error: null }
        },
      }
    },
  },
  auth: {
    getSession: async () => ({ data: { session: currentSession() }, error: null as ({ name: string; message: string } | null) }),
    onAuthStateChange(listener: Listener) {
      listeners.add(listener)
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      if (password === 'sbagliata') return { data: { session: null }, error: { message: 'Invalid login credentials' } as DbError }
      signIn(email)
      return { data: { session: currentSession() }, error: null as DbError }
    },
    async signUp({ email }: { email: string; password: string; options?: unknown }) {
      db.email = email
      persist()
      return { data: { session: null, user: { id: DEV_USER_ID, identities: [{}] as unknown[] } }, error: null as DbError }
    },
    async verifyOtp({ email, token }: { email: string; token: string; type: string }) {
      if (token === '000000') return { data: { session: null }, error: { message: 'Token has expired or is invalid' } as DbError }
      signIn(email)
      return { data: { session: currentSession() }, error: null as DbError }
    },
    resend: async (_: { type: string; email: string }) => ({ data: {}, error: null as DbError }),
    resetPasswordForEmail: async (_email: string, _options?: unknown) => ({ data: {}, error: null as DbError }),
    updateUser: async (_: unknown) => ({ data: {}, error: null as DbError }),
    async signOut() {
      db.signedOut = true
      persist()
      listeners.forEach((listener) => listener('SIGNED_OUT', null))
      return { error: null }
    },
  },
}
