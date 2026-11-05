// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

const MIGRATIONS = ['0001_schema.sql', '0002_rls.sql', '0003_leaderboard.sql', '0006_reminder_rows.sql', '0007_resilience.sql', '0008_caffeine.sql', '0009_leaderboard_caffeine.sql', '0010_waterminder.sql', '0011_can_character.sql', '0012_remove_energy_drinks.sql', '0013_poke_cooldown.sql']
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
