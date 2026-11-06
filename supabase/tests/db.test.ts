// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

const MIGRATIONS = ['0001_schema.sql', '0002_rls.sql', '0003_leaderboard.sql', '0006_reminder_rows.sql', '0007_resilience.sql', '0008_caffeine.sql', '0009_leaderboard_caffeine.sql', '0010_waterminder.sql', '0011_can_character.sql', '0012_remove_energy_drinks.sql', '0013_poke_cooldown.sql', '0014_active_hours.sql', '0015_drink_from_push.sql', '0016_social_notifications.sql', '0017_motivation.sql', '0018_client_errors.sql']
const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const WEEK = '2026-11-02'
const TODAY_ROME = `(now() at time zone 'Europe/Rome')::date`

let db: PGlite

const STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  grant usage on schema auth to authenticated, anon;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to authenticated, anon;
  grant usage on schema public to authenticated, anon, service_role;
  alter default privileges in schema public grant all on tables to authenticated, anon, service_role;
  alter default privileges in schema public grant all on functions to authenticated, anon, service_role;
`

async function asUser<T>(id: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.sub', '${id}', false); set role authenticated;`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.sub', '', false);`)
  }
}

async function addUser(id: string, name: string) {
  await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`, [id, JSON.stringify({ display_name: name })])
  // l'obiettivo iniziale decorre da molto prima della settimana di test
  await db.query(`update goal_changes set effective_from = '2026-01-01' where user_id = $1`, [id])
}

async function drink(id: string, date: string, ml: number) {
  await db.query(
    `insert into drinks (user_id, client_id, amount_ml, drunk_at, local_date) values ($1, gen_random_uuid(), $2, $3::date::timestamptz, $3::date)`,
    [id, ml, date],
  )
}

async function drinkFull(id: string, date: string, ml: number) {
  let left = ml
  while (left > 0) {
    await drink(id, date, Math.min(left, 2000))
    left -= 2000
  }
}

const count = async (sql: string) => Number((await db.query<{ n: string }>(sql)).rows[0].n)
const board = async () =>
  asUser(A, async () => (await db.query<Record<string, unknown>>(`select * from get_leaderboard('${WEEK}')`)).rows)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUBS)
  for (const file of MIGRATIONS) {
    await db.exec(readFileSync(join(process.cwd(), 'supabase/migrations', file), 'utf8'))
  }
}, 60_000)

beforeEach(async () => {
  await db.exec(`reset role; delete from auth.users;`)
  await addUser(A, 'Anna')
  await addUser(B, 'Bruno')
})

describe('registrazione', () => {
  it('crea profilo e obiettivo 3000', async () => {
    const id = '00000000-0000-0000-0000-00000000000c'
    await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"display_name":"Carla","tz":"Europe/Paris"}')`, [id])
    const profile = (await db.query(`select * from profiles where id = $1`, [id])).rows[0]
    expect(profile).toMatchObject({ display_name: 'Carla', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Paris' })
    const goals = (await db.query(`select goal_ml from goal_changes where user_id = $1`, [id])).rows
    expect(goals).toEqual([{ goal_ml: 3000 }])
  })
})

describe('RLS', () => {
  it('utente A non legge drinks di B', async () => {
    await drink(B, WEEK, 200)
    expect(await asUser(A, () => count(`select count(*) n from drinks`))).toBe(0)
  })
  it('utente A non scrive drinks a nome di B', async () => {
    await expect(
      asUser(A, () => db.query(`insert into drinks (user_id, client_id, amount_ml, drunk_at, local_date) values ('${B}', gen_random_uuid(), 200, now(), '${WEEK}')`)),
    ).rejects.toThrow(/row-level security/)
  })
  it('utente A non legge né modifica profili altrui', async () => {
    expect(await asUser(A, () => count(`select count(*) n from profiles`))).toBe(1)
    await asUser(A, () => db.exec(`update profiles set display_name = 'x' where id = '${B}'`))
    const row = (await db.query<{ display_name: string }>(`select display_name from profiles where id = '${B}'`)).rows[0]
    expect(row.display_name).toBe('Bruno')
  })
  it('utente A non legge né scrive schedules di B', async () => {
    await db.query(`insert into schedules (user_id, name, weekdays) values ($1, 'b', '{1}')`, [B])
    expect(await asUser(A, () => count(`select count(*) n from schedules`))).toBe(0)
    await expect(asUser(A, () => db.query(`insert into schedules (user_id, name, weekdays) values ('${B}', 'x', '{1}')`))).rejects.toThrow(/row-level security/)
  })
  it('utente A non aggiunge orari ai programmi di B', async () => {
    const s = (await db.query<{ id: string }>(`insert into schedules (user_id, name, weekdays) values ($1, 'b', '{1}') returning id`, [B])).rows[0].id
    await expect(asUser(A, () => db.query(`insert into schedule_times (schedule_id, minutes) values ('${s}', 480)`))).rejects.toThrow(/row-level security/)
  })
  it('utente legge il proprio push_log ma non quello di B, e non lo scrive', async () => {
    await db.query(`insert into push_log (user_id, scheduled_date, scheduled_at, status) values ($1, $2, now(), 'sent'), ($3, $2, now(), 'sent')`, [A, WEEK, B])
    expect(await asUser(A, () => count(`select count(*) n from push_log`))).toBe(1)
    await expect(
      asUser(A, () => db.query(`insert into push_log (user_id, scheduled_date, scheduled_at, status) values ('${A}', '${WEEK}', now(), 'sent')`)),
    ).rejects.toThrow(/row-level security/)
  })
  it('utente può inserire feedback ma non leggerli, nemmeno i propri', async () => {
    await asUser(A, () => db.query(`insert into feedback (user_id, message) values ('${A}', 'ciao')`))
    expect(await asUser(A, () => count(`select count(*) n from feedback`))).toBe(0)
    expect(await count(`select count(*) n from feedback`)).toBe(1)
  })
  it('utente non inserisce feedback a nome di altri', async () => {
    await expect(asUser(A, () => db.query(`insert into feedback (user_id, message) values ('${B}', 'ciao')`))).rejects.toThrow(/row-level security/)
  })
  it('un obiettivo non può valere da oggi', async () => {
    await expect(
      asUser(A, () => db.query(`insert into goal_changes (user_id, effective_from, goal_ml) values ('${A}', ${TODAY_ROME}, 1500)`)),
    ).rejects.toThrow(/row-level security/)
  })
  it('un obiettivo può valere da domani', async () => {
    await asUser(A, () => db.query(`insert into goal_changes (user_id, effective_from, goal_ml) values ('${A}', ${TODAY_ROME} + 1, 2000)`))
    expect(await count(`select count(*) n from goal_changes where user_id = '${A}'`)).toBe(2)
  })
})

describe('caffeina', () => {
  const insert = (user: string, kind = 'redbull', mg = 80, client = 'gen_random_uuid()') =>
    `insert into caffeine_intakes (user_id, client_id, kind, mg, taken_at, local_date) values ('${user}', ${client}, '${kind}', ${mg}, now(), '${WEEK}') on conflict (user_id, client_id) do nothing`

  it('utente A non legge la caffeina di B', async () => {
    await db.exec(insert(B))
    expect(await asUser(A, () => count(`select count(*) n from caffeine_intakes`))).toBe(0)
  })
  it('utente A non scrive a nome di B', async () => {
    await expect(asUser(A, () => db.exec(insert(B)))).rejects.toThrow(/row-level security/)
  })
  it('utente A non cancella la caffeina di B', async () => {
    await db.exec(insert(B))
    await asUser(A, () => db.exec(`delete from caffeine_intakes`))
    expect(await count(`select count(*) n from caffeine_intakes`)).toBe(1)
  })
  it('utente A cancella la propria', async () => {
    await asUser(A, async () => {
      await db.exec(insert(A))
      await db.exec(`delete from caffeine_intakes`)
    })
    expect(await count(`select count(*) n from caffeine_intakes`)).toBe(0)
  })
  it('stesso client_id due volte produce una sola riga', async () => {
    const same = insert(A, 'redbull', 80, `'11111111-1111-1111-1111-111111111111'`)
    await asUser(A, async () => {
      await db.exec(same)
      await db.exec(same)
    })
    expect(await count(`select count(*) n from caffeine_intakes`)).toBe(1)
  })
  it('rifiuta tipo e milligrammi non validi', async () => {
    await expect(db.exec(insert(A, 'grappa'))).rejects.toThrow(/check/)
    await expect(db.exec(insert(A, 'coffee', 0))).rejects.toThrow(/check/)
    await expect(db.exec(insert(A, 'coffee', 1001))).rejects.toThrow(/check/)
  })
  it('accetta la Monster', async () => {
    await db.exec(insert(A, 'monster', 160))
    expect(await count(`select count(*) n from caffeine_intakes where kind = 'monster'`)).toBe(1)
  })

  it('non entra più nella classifica, che resta visibile a tutti', async () => {
    await db.exec(insert(B, 'redbull'))
    await db.exec(insert(B, 'monster', 160))
    const row = (await board()).find((r) => r.user_id === B)!
    expect(row).not.toHaveProperty('redbulls')
    expect(row).not.toHaveProperty('monster_until')
  })

  it('sparisce con il profilo', async () => {
    await db.exec(insert(A))
    await db.exec(`delete from auth.users where id = '${A}'`)
    expect(await count(`select count(*) n from caffeine_intakes`)).toBe(0)
  })
})

describe('tipi di bevanda', () => {
  const drinkAs = (id: string, ml: number, pct: number, date = WEEK) =>
    db.query(`insert into drinks (user_id, client_id, amount_ml, drunk_at, local_date, drink_type, hydration_pct) values ($1, gen_random_uuid(), $2, now(), $3, 'x', $4)`, [id, ml, date, pct])

  it('una bevuta senza tipo resta acqua al 100%', async () => {
    await drink(A, WEEK, 200)
    expect((await db.query(`select drink_type, hydration_pct from drinks`)).rows).toEqual([{ drink_type: 'water', hydration_pct: 100 }])
  })
  it('la classifica conta l\'acqua equivalente, non il volume', async () => {
    await drinkAs(A, 2000, 50)
    await drinkAs(A, 2000, 50)
    expect((await board()).find((r) => r.user_id === A)).toMatchObject({ days_met: 0 })
    await drinkAs(A, 1000, 100)
    expect((await board()).find((r) => r.user_id === A)).toMatchObject({ days_met: 1 })
  })
  it('i totali per giorno riguardano solo chi li chiede', async () => {
    await drinkAs(A, 1000, 50)
    await drinkAs(A, 300, 100)
    await drinkAs(B, 999, 100)
    const rows = await asUser(A, async () => (await db.query(`select day::text, total_ml, drinks from daily_totals()`)).rows)
    expect(rows).toEqual([{ day: WEEK, total_ml: 800, drinks: 2 }])
  })
  it('tazze e bevande personalizzate sono private', async () => {
    await db.query(`insert into cups (user_id, name, amount_ml) values ($1, 'b', 500)`, [B])
    await db.query(`insert into drink_types (user_id, name, hydration_pct) values ($1, 'b', 50)`, [B])
    expect(await asUser(A, () => count(`select count(*) n from cups`))).toBe(0)
    expect(await asUser(A, () => count(`select count(*) n from drink_types`))).toBe(0)
    await expect(asUser(A, () => db.query(`insert into cups (user_id, name, amount_ml) values ('${B}', 'x', 500)`))).rejects.toThrow(/row-level security/)
  })
  it('rifiuta percentuali fuori intervallo', async () => {
    await expect(drinkAs(A, 200, 151)).rejects.toThrow(/check/)
  })
})

describe('promemoria fermati all\'obiettivo', () => {
  const today = `(now() at time zone 'Europe/Rome')::date`
  const reached = async () => (await db.query<{ goal_reached: boolean }>(`select goal_reached from reminder_rows()`)).rows[0].goal_reached

  beforeEach(async () => {
    const s = (await db.query<{ id: string }>(`insert into schedules (user_id, name, weekdays) values ($1, 'a', '{1,2,3,4,5,6,7}') returning id`, [A])).rows[0].id
    await db.query(`insert into schedule_times (schedule_id, minutes) values ($1, 480)`, [s])
    await db.query(`update profiles set tz = 'Europe/Rome' where id = $1`, [A])
  })
  const fill = () => db.exec(`insert into drinks (user_id, client_id, amount_ml, drunk_at, local_date) select '${A}', gen_random_uuid(), 1500, now(), ${today} from generate_series(1, 2)`)

  it('senza la scelta dell\'utente non si ferma mai', async () => {
    await fill()
    expect(await reached()).toBe(false)
  })
  it('con la scelta si ferma solo a obiettivo raggiunto', async () => {
    await db.query(`update profiles set stop_at_goal = true where id = $1`, [A])
    expect(await reached()).toBe(false)
    await fill()
    expect(await reached()).toBe(true)
  })
  it('non è accessibile agli utenti', async () => {
    await expect(asUser(A, () => db.query(`select * from reminder_rows()`))).rejects.toThrow(/permission denied/)
  })
})

describe('fascia attiva', () => {
  const today = `(now() at time zone 'Europe/Rome')::date`
  const setHours = (start: number, end: number) => db.query(`update profiles set active_start_min = $1, active_end_min = $2 where id = $3`, [start, end, A])

  it('di default è spenta, dalle 8 alle 18', async () => {
    const p = (await db.query<Record<string, unknown>>(`select active_split, active_start_min, active_end_min from profiles where id = $1`, [A])).rows[0]
    expect(p).toEqual({ active_split: false, active_start_min: 480, active_end_min: 1080 })
  })

  it("rifiuta una fine prima dell'inizio, uguale o a meno di un'ora", async () => {
    await expect(setHours(1080, 480)).rejects.toThrow(/check/)
    await expect(setHours(480, 480)).rejects.toThrow(/check/)
    await expect(setHours(480, 510)).rejects.toThrow(/check/)
    await expect(setHours(-60, 480)).rejects.toThrow(/check/)
    await expect(setHours(480, 1500)).rejects.toThrow(/check/)
    await setHours(540, 1320)
  })

  it('i promemoria ricevono fascia, bevuto e obiettivo di oggi', async () => {
    const s = (await db.query<{ id: string }>(`insert into schedules (user_id, name, weekdays) values ($1, 'a', '{1,2,3,4,5,6,7}') returning id`, [A])).rows[0].id
    await db.query(`insert into schedule_times (schedule_id, minutes) values ($1, 600)`, [s])
    await db.query(`update profiles set tz = 'Europe/Rome', active_split = true where id = $1`, [A])
    await db.query(`insert into goal_changes (user_id, effective_from, goal_ml) values ($1, '2026-02-01', 2500)`, [A])
    // 500 ml d'acqua e 200 ml di caffè all'80%: 660 ml
    await db.exec(`insert into drinks (user_id, client_id, amount_ml, drunk_at, local_date) values ('${A}', gen_random_uuid(), 500, now(), ${today})`)
    await db.exec(`insert into drinks (user_id, client_id, amount_ml, hydration_pct, drunk_at, local_date) values ('${A}', gen_random_uuid(), 200, 80, now(), ${today})`)
    // ieri non conta
    await db.exec(`insert into drinks (user_id, client_id, amount_ml, drunk_at, local_date) values ('${A}', gen_random_uuid(), 900, now(), ${today} - 1)`)
    const row = (await db.query<Record<string, unknown>>(`select active_split, active_start_min, active_end_min, drunk_ml, goal_ml, goal_reached from reminder_rows()`)).rows[0]
    expect(row).toEqual({ active_split: true, active_start_min: 480, active_end_min: 1080, drunk_ml: 660, goal_ml: 2500, goal_reached: false })
  })

  it('senza bevute il bevuto è zero', async () => {
    const s = (await db.query<{ id: string }>(`insert into schedules (user_id, name, weekdays) values ($1, 'a', '{1}') returning id`, [A])).rows[0].id
    await db.query(`insert into schedule_times (schedule_id, minutes) values ($1, 600)`, [s])
    expect((await db.query<{ drunk_ml: number }>(`select drunk_ml from reminder_rows()`)).rows[0].drunk_ml).toBe(0)
  })
})

describe('spronare un amico', () => {
  const poke = async (from = A, to = B) => (await db.query<{ r: string }>(`select claim_poke($1, $2) r`, [from, to])).rows[0].r
  const backdatedPoke = (hoursAgo: number, from = A, to = B) =>
    db.query(`insert into pokes (from_user, to_user, created_at) values ($1, $2, now() - ($3 || ' hours')::interval)`, [from, to, hoursAgo])

  it('bisogna aspettare un\'ora prima di spronare di nuovo la stessa persona', async () => {
    expect(await poke()).toBe('ok')
    expect(await poke()).toBe('cooldown')
    expect(await poke(B, A)).toBe('ok')
  })
  it('al massimo tre volte in un giorno per persona, passata l\'attesa', async () => {
    await backdatedPoke(5)
    await backdatedPoke(3)
    await backdatedPoke(1.5)
    expect(await poke()).toBe('limit')
    expect(await poke(B, A)).toBe('ok')
  })
  it('non a se stessi', async () => {
    expect(await poke(A, A)).toBe('self')
  })
  it('non chi ha detto di no, né chi non esiste', async () => {
    await db.query(`update profiles set allow_pokes = false where id = $1`, [B])
    expect(await poke()).toBe('blocked')
    expect(await poke(A, '00000000-0000-0000-0000-0000000000ff')).toBe('blocked')
  })
  it('gli utenti non possono chiamarla direttamente né leggere gli altri', async () => {
    await expect(asUser(A, () => db.query(`select claim_poke('${A}', '${B}')`))).rejects.toThrow(/permission denied/)
    await poke()
    expect(await asUser(A, () => count(`select count(*) n from pokes`))).toBe(0)
  })
})

describe('profilo esteso', () => {
  it('accetta i nuovi personaggi e rifiuta quelli inesistenti', async () => {
    await db.query(`update profiles set home_style = 'cat' where id = $1`, [A])
    await db.query(`update profiles set home_style = 'can' where id = $1`, [A])
    await expect(db.query(`update profiles set home_style = 'drago' where id = $1`, [A])).rejects.toThrow(/check/)
  })
  it('rifiuta un peso impossibile', async () => {
    await expect(db.query(`update profiles set weight_kg = 5 where id = $1`, [A])).rejects.toThrow(/check/)
  })
})

describe('bevute', () => {
  it('stesso client_id due volte produce una sola riga', async () => {
    const insert = `insert into drinks (user_id, client_id, amount_ml, drunk_at, local_date) values ('${A}', '11111111-1111-1111-1111-111111111111', 200, now(), '${WEEK}') on conflict (user_id, client_id) do nothing`
    await asUser(A, async () => {
      await db.exec(insert)
      await db.exec(insert)
    })
    expect(await count(`select count(*) n from drinks`)).toBe(1)
  })
  it('rifiuta quantità fuori intervallo', async () => {
    await expect(drink(A, WEEK, 0)).rejects.toThrow(/check/)
    await expect(drink(A, WEEK, 2001)).rejects.toThrow(/check/)
  })
})

describe('notifiche', () => {
  it('un dispositivo passa al nuovo utente che accede', async () => {
    const register = `select register_push_subscription('https://push/1', 'k', 'a')`
    await asUser(A, () => db.exec(register))
    await asUser(B, () => db.exec(register))
    const rows = (await db.query(`select user_id from push_subscriptions`)).rows
    expect(rows).toEqual([{ user_id: B }])
  })
  it('mark_push_received imposta received_at una sola volta', async () => {
    const id = (await db.query<{ id: string }>(`insert into push_log (user_id, scheduled_date, scheduled_at, status) values ($1, $2, now(), 'sent') returning id`, [A, WEEK])).rows[0].id
    await db.exec(`set role anon; select mark_push_received('${id}'); reset role;`)
    const first = (await db.query<{ received_at: Date }>(`select received_at from push_log where id = $1`, [id])).rows[0].received_at
    expect(first).not.toBeNull()
    await db.exec(`set role anon; select mark_push_received('${id}'); reset role;`)
    const second = (await db.query<{ received_at: Date }>(`select received_at from push_log where id = $1`, [id])).rows[0].received_at
    expect(second).toEqual(first)
  })
  it('lo stesso promemoria non viene registrato due volte nello stesso giorno', async () => {
    const s = (await db.query<{ id: string }>(`insert into schedules (user_id, name, weekdays) values ($1, 'a', '{1}') returning id`, [A])).rows[0].id
    const t = (await db.query<{ id: string }>(`insert into schedule_times (schedule_id, minutes) values ($1, 480) returning id`, [s])).rows[0].id
    const insert = `insert into push_log (user_id, schedule_time_id, scheduled_date, scheduled_at, status) values ('${A}', '${t}', '${WEEK}', '2026-11-02T07:00:00Z', 'pending') on conflict (user_id, schedule_time_id, scheduled_at) do nothing returning id`
    expect((await db.query(insert)).rows).toHaveLength(1)
    expect((await db.query(insert)).rows).toHaveLength(0)
  })
})

describe('bevuto dalla notifica', () => {
  const today = `(now() at time zone 'Europe/Rome')::date`
  const sentLog = async (age = '0 minutes') =>
    (await db.query<{ id: string }>(`insert into push_log (user_id, scheduled_date, scheduled_at, status) values ($1, ${today}, now() - interval '${age}', 'sent') returning id`, [A])).rows[0].id
  const tap = async (id: string) => {
    await db.exec('set role anon')
    try {
      return (await db.query<{ r: Record<string, unknown> }>(`select drink_from_push($1) r`, [id])).rows[0].r
    } finally {
      await db.exec('reset role')
    }
  }

  beforeEach(async () => {
    await db.query(`update profiles set tz = 'Europe/Rome', drink_ml = 250, units = 'ml' where id = $1`, [A])
    await db.query(`insert into goal_changes (user_id, effective_from, goal_ml) values ($1, '2026-02-01', 2500)`, [A])
  })

  it('segna una bevuta della quantità del profilo e restituisce il totale di oggi', async () => {
    await db.exec(`insert into drinks (user_id, client_id, amount_ml, drunk_at, local_date) values ('${A}', gen_random_uuid(), 500, now(), ${today})`)
    const id = await sentLog()
    expect(await tap(id)).toEqual({ ok: true, added: true, amount_ml: 250, drunk_ml: 750, goal_ml: 2500, units: 'ml' })
    const rows = (await db.query(`select user_id, amount_ml, drink_type, hydration_pct from drinks where client_id = $1`, [id])).rows
    expect(rows).toEqual([{ user_id: A, amount_ml: 250, drink_type: 'water', hydration_pct: 100 }])
  })

  it('toccare due volte non segna due bevute', async () => {
    const id = await sentLog()
    await tap(id)
    expect(await tap(id)).toMatchObject({ ok: true, added: false, drunk_ml: 250 })
    expect(await count(`select count(*) n from drinks where user_id = '${A}'`)).toBe(1)
  })

  it('un promemoria di più di 24 ore fa o inesistente non segna nulla', async () => {
    expect(await tap(await sentLog('25 hours'))).toEqual({ ok: false })
    expect(await tap('00000000-0000-0000-0000-0000000000ff')).toEqual({ ok: false })
    expect(await count(`select count(*) n from drinks`)).toBe(0)
  })
})

describe('notifiche sociali', () => {
  const C = '00000000-0000-0000-0000-00000000000c'
  const todayOf = (tz: string) => `(now() at time zone '${tz}')::date`
  const drinkToday = (id: string, ml: number) =>
    db.query(`insert into drinks (user_id, client_id, amount_ml, drunk_at, local_date) values ($1, gen_random_uuid(), $2, now(), ${todayOf('Europe/Rome')})`, [id, ml])
  const device = (id: string, n: number) =>
    db.query(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'k', 'a')`, [id, `https://push/${n}`])
  const events = () => db.query<{ user_id: string }>(`select user_id from goal_events`).then((r) => r.rows)
  // Mezzogiorno UTC: in UTC e a Roma è giorno.
  const noon = `date_trunc('day', now()) + interval '12 hours'`

  beforeEach(async () => {
    await db.query(`update profiles set tz = 'Europe/Rome'`)
    await db.query(`insert into goal_changes (user_id, effective_from, goal_ml) values ($1, '2026-02-01', 2000), ($2, '2026-02-01', 2000)`, [A, B])
  })

  it("superare l'obiettivo di oggi crea un evento, una volta sola", async () => {
    await drinkToday(A, 1500)
    expect(await events()).toEqual([])
    await drinkToday(A, 600)
    await drinkToday(A, 300)
    expect(await events()).toEqual([{ user_id: A }])
  })

  it('niente evento per obiettivi sotto 1,5 L, per giorni passati o per chi non vuole condividerlo', async () => {
    await db.query(`insert into goal_changes (user_id, effective_from, goal_ml) values ($1, '2026-03-01', 1000)`, [A])
    await drinkToday(A, 1200)
    await db.query(`insert into drinks (user_id, client_id, amount_ml, drunk_at, local_date) values ($1, gen_random_uuid(), 2000, now(), ${todayOf('Europe/Rome')} - 1)`, [B])
    await db.query(`update profiles set share_goal = false where id = $1`, [B])
    await drinkToday(B, 2000)
    expect(await events()).toEqual([])
  })

  it('una bevuta segna la persona come attiva', async () => {
    await db.query(`update profiles set last_seen_at = now() - interval '3 days' where id = $1`, [A])
    await drinkToday(A, 200)
    const seen = (await db.query<{ recent: boolean }>(`select last_seen_at > now() - interval '1 minute' as recent from profiles where id = $1`, [A])).rows[0]
    expect(seen.recent).toBe(true)
  })

  it('avvisa una volta gli amici svegli, con un dispositivo e che lo vogliono', async () => {
    await addUser(C, 'Carla')
    await db.query(`update profiles set tz = 'UTC' where id in ($1, $2)`, [B, C])
    await device(B, 1)
    await device(C, 2)
    await db.query(`update profiles set friend_goal_alerts = false where id = $1`, [C])
    await device(A, 3)
    await drinkToday(A, 2000)
    await db.exec(`update goal_events set created_at = ${noon} - interval '5 minutes'`)
    const rows = (await db.query<Record<string, unknown>>(`select achiever, to_user, token, subscriptions from take_goal_alerts(${noon})`)).rows
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ achiever: 'Anna', to_user: B, subscriptions: [{ endpoint: 'https://push/1', p256dh: 'k', auth: 'a' }] })
    expect((await db.query(`select * from take_goal_alerts(${noon})`)).rows).toEqual([])
  })

  it('di notte non avvisa', async () => {
    await db.query(`update profiles set tz = 'UTC' where id = $1`, [B])
    await device(B, 1)
    await drinkToday(A, 2000)
    const night = `date_trunc('day', now()) + interval '3 hours'`
    await db.exec(`update goal_events set created_at = ${night} - interval '5 minutes'`)
    expect((await db.query(`select * from take_goal_alerts(${night})`)).rows).toEqual([])
  })

  it('il biglietto della notifica vale una volta e dice a chi mandare i complimenti', async () => {
    await db.query(`update profiles set tz = 'UTC' where id = $1`, [B])
    await device(B, 1)
    await drinkToday(A, 2000)
    await db.exec(`update goal_events set created_at = ${noon} - interval '5 minutes'`)
    const token = (await db.query<{ token: string }>(`select token from take_goal_alerts(${noon})`)).rows[0].token
    await db.exec(`update goal_events set created_at = now()`)
    expect((await db.query(`select * from claim_cheer_token($1)`, [token])).rows).toEqual([{ to_user: A, from_name: 'Bruno' }])
    expect((await db.query(`select * from claim_cheer_token($1)`, [token])).rows).toEqual([])
  })

  it('dalla classifica: complimenti solo a chi ha raggiunto oggi, una volta', async () => {
    const claim = async (from: string, to: string) => (await db.query<{ r: string }>(`select claim_cheer($1, $2) r`, [from, to])).rows[0].r
    const cheerable = (id: string) => asUser(id, async () => (await db.query(`select * from cheerable_today()`)).rows)
    expect(await claim(B, A)).toBe('no-goal')
    await drinkToday(A, 2000)
    expect(await claim(A, A)).toBe('self')
    expect(await cheerable(B)).toEqual([{ user_id: A, cheered: false }])
    expect(await claim(B, A)).toBe('ok')
    expect(await claim(B, A)).toBe('already')
    expect(await cheerable(B)).toEqual([{ user_id: A, cheered: true }])
    expect(await cheerable(A)).toEqual([])
  })

  it('le tabelle non si leggono direttamente', async () => {
    await drinkToday(A, 2000)
    expect(await asUser(A, () => count(`select count(*) n from goal_events`))).toBe(0)
  })

  it("touch_last_seen aggiorna solo l'utente che apre l'app", async () => {
    await asUser(A, () => db.exec(`select touch_last_seen()`))
    const rows = (await db.query(`select id from profiles where last_seen_at is not null`)).rows
    expect(rows).toEqual([{ id: A }])
  })

  describe("promemoria a chi non apre l'app", () => {
    const take = async (at = noon) =>
      (await db.query<Record<string, unknown>>(`select user_id, display_name, days_away, stage, goal_ml from take_inactivity_nudges(${at})`)).rows
    const away = (days: number) =>
      db.query(`update profiles set tz = 'UTC', last_seen_at = ${noon} - interval '${days} days 1 hour' where id = $1`, [A])

    beforeEach(async () => {
      await device(A, 1)
    })

    it('dopo un giorno, con nome e obiettivo; non due volte di fila', async () => {
      await away(1)
      expect(await take()).toEqual([{ user_id: A, display_name: 'Anna', days_away: 1, stage: 0, goal_ml: 2000 }])
      expect(await take(`${noon} + interval '2 hours'`)).toEqual([])
    })

    it('poi dopo 3 e 7 giorni, e basta', async () => {
      await away(7)
      await db.query(`insert into nudges (user_id, sent_at) values ($1, ${noon} - interval '6 days'), ($1, ${noon} - interval '4 days')`, [A])
      expect(await take()).toMatchObject([{ days_away: 7, stage: 2 }])
      await away(9)
      expect(await take(`${noon} + interval '1 day'`)).toEqual([])
    })

    it('a 2 giorni aspetta il terzo', async () => {
      await away(2)
      await db.query(`insert into nudges (user_id, sent_at) values ($1, ${noon} - interval '1 day')`, [A])
      expect(await take()).toEqual([])
    })

    it("niente di notte, senza promemoria attivi o a chi non ha mai aperto la nuova versione", async () => {
      await away(1)
      expect(await take(`date_trunc('day', now()) + interval '22 hours'`)).toEqual([])
      await db.query(`update profiles set nudge_inactive = false where id = $1`, [A])
      expect(await take()).toEqual([])
      await db.query(`update profiles set nudge_inactive = true, last_seen_at = null where id = $1`, [A])
      expect(await take()).toEqual([])
    })

    it('rispetta la fascia attiva', async () => {
      await away(1)
      await db.query(`update profiles set active_split = true, active_start_min = 840, active_end_min = 1080 where id = $1`, [A])
      expect(await take()).toEqual([])
      expect(await take(`${noon} + interval '3 hours'`)).toHaveLength(1)
    })
  })
})

describe('motivazione', () => {
  const utcToday = `(now() at time zone 'UTC')::date`
  const drinkOn = (id: string, day: string, ml: number) =>
    db.query(`insert into drinks (user_id, client_id, amount_ml, drunk_at, local_date) values ($1, gen_random_uuid(), $2, now(), ${day})`, [id, ml])
  const device = (id: string) => db.query(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'k', 'a')`, [id, `https://push/${id}`])
  const boost = (id: string, day: string, kind: string, ml: number) =>
    db.query(`insert into goal_boosts (user_id, local_date, kind, extra_ml) values ($1, ${day}, $2, $3)`, [id, kind, ml])

  beforeEach(async () => {
    await db.query(`update profiles set tz = 'UTC'`)
    await db.query(`insert into goal_changes (user_id, effective_from, goal_ml) values ($1, '2026-02-01', 2000), ($2, '2026-02-01', 2000)`, [A, B])
  })

  describe('obiettivo che si adatta', () => {
    const goalFor = async (id: string, day: string) => (await db.query<{ g: number }>(`select goal_for($1, ${day}) g`, [id])).rows[0].g

    it('somma caldo e allenamento all\'obiettivo di quel giorno', async () => {
      expect(await goalFor(A, utcToday)).toBe(2000)
      await boost(A, utcToday, 'heat', 500)
      await boost(A, utcToday, 'workout', 500)
      expect(await goalFor(A, utcToday)).toBe(3000)
      expect(await goalFor(A, `${utcToday} - 1`)).toBe(2000)
    })

    it('ognuno vede e cambia solo i propri aumenti, uno per tipo al giorno', async () => {
      await asUser(A, () => db.exec(`insert into goal_boosts (user_id, local_date, kind, extra_ml) values ('${A}', '2026-11-02', 'workout', 500)`))
      await expect(asUser(A, () => db.exec(`insert into goal_boosts (user_id, local_date, kind, extra_ml) values ('${B}', '2026-11-02', 'workout', 500)`))).rejects.toThrow()
      await expect(boost(A, `'2026-11-02'`, 'workout', 300)).rejects.toThrow(/duplicate|unique/)
      await expect(boost(A, `'2026-11-03'`, 'meteo', 300)).rejects.toThrow(/check/)
      expect(await asUser(B, () => count(`select count(*) n from goal_boosts`))).toBe(0)
    })

    it("l'evento «obiettivo raggiunto» aspetta anche gli aumenti", async () => {
      await boost(A, utcToday, 'workout', 500)
      await drinkOn(A, utcToday, 2000)
      expect(await count(`select count(*) n from goal_events`)).toBe(0)
      await drinkOn(A, utcToday, 500)
      expect(await count(`select count(*) n from goal_events`)).toBe(1)
    })

    it('in classifica conta l\'obiettivo aumentato', async () => {
      await drinkOn(A, `'2026-11-02'`, 2000)
      await drinkOn(B, `'2026-11-02'`, 2000)
      await boost(B, `'2026-11-02'`, 'heat', 500)
      const rows = await board()
      expect(rows.find((r) => r.user_id === A)).toMatchObject({ days_met: 1 })
      expect(rows.find((r) => r.user_id === B)).toMatchObject({ days_met: 0 })
    })

    it('i promemoria ricevono l\'obiettivo aumentato', async () => {
      const s = (await db.query<{ id: string }>(`insert into schedules (user_id, name, weekdays) values ($1, 'a', '{1,2,3,4,5,6,7}') returning id`, [A])).rows[0].id
      await db.query(`insert into schedule_times (schedule_id, minutes) values ($1, 600)`, [s])
      await boost(A, utcToday, 'heat', 750)
      expect((await db.query<{ goal_ml: number }>(`select goal_ml from reminder_rows()`)).rows[0].goal_ml).toBe(2750)
    })
  })

  describe('riepilogo serale', () => {
    const at = (hhmm: string) => `date_trunc('day', now()) + interval '${hhmm}'`
    const take = async (when = at('21:05')) =>
      (await db.query<Record<string, unknown>>(`select user_id, display_name, drunk_ml, goal_ml from take_evening_summaries(${when})`)).rows

    beforeEach(async () => {
      await device(A)
    })

    it('alle 21, se mancano almeno 500 ml e un quinto, una volta sola', async () => {
      await drinkOn(A, utcToday, 1200)
      expect(await take(at('20:50'))).toEqual([])
      expect(await take()).toEqual([{ user_id: A, display_name: 'Anna', drunk_ml: 1200, goal_ml: 2000 }])
      expect(await take(at('21:15'))).toEqual([])
    })

    it('non disturba chi ci è andato vicino', async () => {
      await drinkOn(A, utcToday, 1650)
      expect(await take()).toEqual([])
    })

    it('con la fascia attiva arriva a fine fascia', async () => {
      await drinkOn(A, utcToday, 500)
      await db.query(`update profiles set active_split = true, active_start_min = 480, active_end_min = 1080 where id = $1`, [A])
      expect(await take()).toEqual([])
      expect(await take(at('18:10'))).toHaveLength(1)
    })

    it('non a chi lo ha spento o non apre l\'app da un giorno', async () => {
      await drinkOn(A, utcToday, 500)
      await db.query(`update profiles set evening_summary = false where id = $1`, [A])
      expect(await take()).toEqual([])
      await db.query(`update profiles set evening_summary = true, last_seen_at = now() - interval '3 days' where id = $1`, [A])
      expect(await take()).toEqual([])
    })
  })

  describe('resoconto del lunedì', () => {
    // Lunedì 9 novembre 2026, 10:00 UTC: la settimana appena finita parte lunedì 2.
    const MONDAY = `'2026-11-09T10:00:00Z'::timestamptz`
    const take = async (when = MONDAY) =>
      (await db.query<Record<string, unknown>>(`select user_id, week_start, days_met, average_ml, rank, players from take_weekly_reports(${when})`)).rows

    beforeEach(async () => {
      await device(A)
      await db.query(`update profiles set last_seen_at = '2026-11-08T12:00:00Z'`)
    })

    it('media, giorni a obiettivo e posto in classifica, una volta sola', async () => {
      for (const day of ['2026-11-02', '2026-11-03', '2026-11-04']) await drinkOn(A, `'${day}'`, 2000)
      for (const day of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']) await drinkOn(B, `'${day}'`, 2000)
      await db.query(`update profiles set last_seen_at = '2026-11-08T12:00:00Z'`)
      expect(await take()).toEqual([{ user_id: A, week_start: new Date('2026-11-02T00:00:00Z'), days_met: 3, average_ml: 857, rank: 2, players: 2 }])
      expect(await take(`'2026-11-09T11:00:00Z'::timestamptz`)).toEqual([])
    })

    it('solo il lunedì mattina', async () => {
      expect(await take(`'2026-11-09T08:30:00Z'::timestamptz`)).toEqual([])
      expect(await take(`'2026-11-09T12:30:00Z'::timestamptz`)).toEqual([])
      expect(await take(`'2026-11-10T10:00:00Z'::timestamptz`)).toEqual([])
    })

    it('non a chi lo ha spento o è sparito da due settimane', async () => {
      await db.query(`update profiles set weekly_report = false where id = $1`, [A])
      expect(await take()).toEqual([])
      await db.query(`update profiles set weekly_report = true, last_seen_at = '2026-10-20T12:00:00Z' where id = $1`, [A])
      expect(await take()).toEqual([])
    })
  })
})

describe('errori dai telefoni', () => {
  const report = (message = 'TypeError: boom') =>
    db.query<{ r: boolean }>(`select report_client_error('error', $1, 'stack', '#/home', '1.7.0', 'Safari') r`, [message]).then((x) => x.rows[0].r)

  // Gli errori sopravvivono alla cancellazione degli utenti (user_id diventa null): si svuota a mano.
  beforeEach(async () => {
    await db.exec(`delete from client_errors`)
  })

  it("un utente segnala un errore, legato al suo profilo; non può leggerli", async () => {
    expect(await asUser(A, () => report())).toBe(true)
    const rows = (await db.query(`select user_id, kind, message, route, app_version from client_errors`)).rows
    expect(rows).toEqual([{ user_id: A, kind: 'error', message: 'TypeError: boom', route: '#/home', app_version: '1.7.0' }])
    expect(await asUser(A, () => count(`select count(*) n from client_errors`))).toBe(0)
    await expect(asUser(A, () => db.exec(`select * from client_errors_recent`))).rejects.toThrow(/permission/)
  })

  it('anche senza accesso, ma senza utente', async () => {
    await db.exec(`set role anon`)
    try {
      expect(await report()).toBe(true)
    } finally {
      await db.exec(`reset role`)
    }
    expect((await db.query(`select user_id from client_errors`)).rows).toEqual([{ user_id: null }])
  })

  it('rifiuta tipi sconosciuti e messaggi vuoti, e taglia i testi lunghi', async () => {
    expect((await db.query<{ r: boolean }>(`select report_client_error('boh', 'x', null, null, null, null) r`)).rows[0].r).toBe(false)
    expect(await report('   ')).toBe(false)
    expect(await report('x'.repeat(2000))).toBe(true)
    expect((await db.query<{ n: number }>(`select char_length(message) n from client_errors`)).rows[0].n).toBe(500)
  })

  it('al massimo 30 all\'ora per utente', async () => {
    for (let i = 0; i < 30; i++) expect(await asUser(A, () => report(`errore ${i}`))).toBe(true)
    expect(await asUser(A, () => report('uno di troppo'))).toBe(false)
    expect(await asUser(B, () => report('altro utente'))).toBe(true)
  })

  it('il riassunto conta volte e persone per messaggio', async () => {
    await asUser(A, () => report())
    await asUser(A, () => report())
    await asUser(B, () => report())
    const rows = (await db.query(`select message, times, people, last_route from client_errors_recent`)).rows
    expect(rows).toEqual([{ message: 'TypeError: boom', times: 3, people: 2, last_route: '#/home' }])
  })

  it('cancella gli errori più vecchi di 30 giorni', async () => {
    await report('vecchio')
    await db.exec(`update client_errors set created_at = now() - interval '31 days'`)
    await report('nuovo')
    expect((await db.query(`select message from client_errors`)).rows).toEqual([{ message: 'nuovo' }])
  })
})

describe('fuso orario', () => {
  it('un utente non può impostare un fuso inesistente', async () => {
    await expect(asUser(A, () => db.query(`update profiles set tz = 'Not/AZone' where id = '${A}'`))).rejects.toThrow(/fuso orario/)
  })
  it('un fuso valido si può impostare', async () => {
    await asUser(A, () => db.query(`update profiles set tz = 'Asia/Tokyo' where id = '${A}'`))
    const row = (await db.query<{ tz: string }>(`select tz from profiles where id = '${A}'`)).rows[0]
    expect(row.tz).toBe('Asia/Tokyo')
  })
  it('una registrazione con fuso errato usa quello predefinito e non fallisce', async () => {
    const id = '00000000-0000-0000-0000-00000000000d'
    await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"display_name":"Dora","tz":"Not/AZone"}')`, [id])
    const row = (await db.query<{ tz: string }>(`select tz from profiles where id = $1`, [id])).rows[0]
    expect(row.tz).toBe('Europe/Rome')
  })
})

describe('registro degli invii', () => {
  async function time() {
    const s = (await db.query<{ id: string }>(`insert into schedules (user_id, name, weekdays) values ($1, 'a', '{1}') returning id`, [A])).rows[0].id
    return (await db.query<{ id: string }>(`insert into schedule_times (schedule_id, minutes) values ($1, 480) returning id`, [s])).rows[0].id
  }
  const insert = (t: string, at: string, status: string) =>
    db.query(`insert into push_log (user_id, schedule_time_id, scheduled_date, scheduled_at, status) values ($1, $2, $3, $4, $5)`, [A, t, WEEK, at, status])
  const reclaim = async (t: string, at: string) =>
    (await db.query<{ reclaim_push: string | null }>(`select reclaim_push($1, $2, $3)`, [A, t, at])).rows[0].reclaim_push

  it('lo stesso orario in un altro fuso è un invio distinto', async () => {
    const t = await time()
    await insert(t, '2026-11-02T07:00:00Z', 'sent')
    await insert(t, '2026-11-02T08:00:00Z', 'sent')
    expect(await count(`select count(*) n from push_log`)).toBe(2)
  })
  it('un invio fallito si può riprendere una sola volta', async () => {
    const t = await time()
    await insert(t, '2026-11-02T07:00:00Z', 'failed')
    expect(await reclaim(t, '2026-11-02T07:00:00Z')).toBeTruthy()
    expect(await reclaim(t, '2026-11-02T07:00:00Z')).toBeNull()
  })
  it('un invio riuscito non si riprende', async () => {
    const t = await time()
    await insert(t, '2026-11-02T07:00:00Z', 'sent')
    expect(await reclaim(t, '2026-11-02T07:00:00Z')).toBeNull()
  })
  it('un invio rimasto in corso si riprende solo dopo due minuti', async () => {
    const t = await time()
    await insert(t, '2026-11-02T07:00:00Z', 'pending')
    expect(await reclaim(t, '2026-11-02T07:00:00Z')).toBeNull()
    await db.exec(`update push_log set claimed_at = now() - interval '3 minutes'`)
    expect(await reclaim(t, '2026-11-02T07:00:00Z')).toBeTruthy()
  })
  it('gli utenti non possono riprendere invii', async () => {
    const t = await time()
    await expect(asUser(A, () => reclaim(t, '2026-11-02T07:00:00Z'))).rejects.toThrow(/permission denied/)
  })
})

describe('stato del servizio', () => {
  it('gli utenti leggono l\'ultimo segno di vita ma non lo scrivono', async () => {
    await db.exec(`update service_status set last_run_at = now()`)
    expect(await asUser(A, () => count(`select count(*) n from service_status where last_run_at is not null`))).toBe(1)
    await asUser(A, () => db.exec(`update service_status set last_run_at = '2000-01-01'`))
    expect(await count(`select count(*) n from service_status where last_run_at > '2020-01-01'`)).toBe(1)
  })
})

describe('reminder_rows', () => {
  async function schedule(enabled: boolean) {
    const s = (await db.query<{ id: string }>(`insert into schedules (user_id, name, weekdays, enabled) values ($1, 'a', '{1}', $2) returning id`, [A, enabled])).rows[0].id
    await db.query(`insert into schedule_times (schedule_id, minutes) values ($1, 480)`, [s])
  }
  it('restituisce gli orari attivi con i dispositivi', async () => {
    await schedule(true)
    await schedule(false)
    await db.query(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push/2', 'k', 'a')`, [A])
    const rows = (await db.query<{ minutes: number; tz: string; subscriptions: { endpoint: string }[] }>(`select * from reminder_rows()`)).rows
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ minutes: 480, tz: 'Europe/Rome' })
    expect(rows[0].subscriptions[0].endpoint).toBe('https://push/2')
  })
  it('non è accessibile agli utenti', async () => {
    await expect(asUser(A, () => db.query(`select * from reminder_rows()`))).rejects.toThrow(/permission denied/)
  })
})

describe('classifica', () => {
  it('3 giorni raggiunti battono 2', async () => {
    for (const d of ['2026-11-02', '2026-11-03']) await drinkFull(A, d, 3000)
    for (const d of ['2026-11-02', '2026-11-04', '2026-11-06']) await drinkFull(B, d, 3000)
    const rows = await board()
    expect(rows.map((r) => [r.display_name, r.days_met])).toEqual([['Bruno', 3], ['Anna', 2]])
  })
  it('a pari giorni vince la serie più lunga', async () => {
    for (const d of ['2026-11-02', '2026-11-04']) await drinkFull(A, d, 3000)
    for (const d of ['2026-11-02', '2026-11-03']) await drinkFull(B, d, 3000)
    const rows = await board()
    expect(rows.map((r) => [r.display_name, r.days_met, r.streak])).toEqual([['Bruno', 2, 2], ['Anna', 2, 1]])
  })
  it('un giorno con obiettivo 1400 non conta anche se raggiunto, 1500 sì', async () => {
    await db.query(`insert into goal_changes (user_id, effective_from, goal_ml) values ($1, '2026-11-02', 1400), ($1, '2026-11-03', 1500)`, [A])
    await drinkFull(A, '2026-11-02', 1400)
    await drinkFull(A, '2026-11-03', 1500)
    const anna = (await board()).find((r) => r.display_name === 'Anna')
    expect(anna?.days_met).toBe(1)
  })
  it('un obiettivo modificato oggi vale da domani', async () => {
    await db.query(`insert into goal_changes (user_id, effective_from, goal_ml) values ($1, '2026-11-03', 2000)`, [A])
    await drinkFull(A, '2026-11-02', 2000) // vale ancora 3000
    await drinkFull(A, '2026-11-03', 2000) // vale 2000
    const anna = (await board()).find((r) => r.display_name === 'Anna')
    expect(anna?.days_met).toBe(1)
  })
  it('non conta le bevute fuori dalla settimana', async () => {
    await drinkFull(A, '2026-11-01', 3000)
    await drinkFull(A, '2026-11-09', 3000)
    expect((await board()).find((r) => r.display_name === 'Anna')?.days_met).toBe(0)
  })
  it('mostra anche chi non ha bevuto', async () => {
    expect(await board()).toHaveLength(2)
  })
  it('restituisce solo i campi pubblici', async () => {
    const [row] = await board()
    expect(Object.keys(row).sort()).toEqual(['avatar_path', 'days_met', 'display_name', 'streak', 'user_id'])
  })
  it('non è accessibile senza login', async () => {
    await db.exec(`set role anon;`)
    await expect(db.query(`select * from get_leaderboard('${WEEK}')`)).rejects.toThrow(/permission denied/)
    await db.exec(`reset role;`)
  })
})
