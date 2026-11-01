// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runSendReminders, type Deps, type ReminderRow } from './core.ts'

const AT_8 = new Date('2026-11-02T07:00:00Z')
const minutesLater = (n: number) => new Date(AT_8.getTime() + n * 60_000)
const row = (over: Partial<ReminderRow> = {}): ReminderRow => ({
  schedule_time_id: 't1',
  user_id: 'u1',
  minutes: 480,
  weekdays: [1],
  tz: 'Europe/Rome',
  drink_ml: 200,
  subscriptions: [{ id: 's1', endpoint: 'https://push.example.com/abc', p256dh: 'k', auth: 'a' }],
  ...over,
})

function deps(rows: ReminderRow[], push: Deps['push'] = async () => 201) {
  const log: { id: string; key: string; status: string }[] = []
  const pushed: string[] = []
  let beats = 0
  const value: Deps = {
    load: async () => rows,
    claim: async (c) => {
      const key = `${c.userId}/${c.scheduleTimeId}/${c.scheduledAt.toISOString()}`
      if (log.some((l) => l.key === key)) return null
      const id = `log${log.length}`
      log.push({ id, key, status: c.status })
      return id
    },
    reclaim: async (c) => {
      const key = `${c.userId}/${c.scheduleTimeId}/${c.scheduledAt.toISOString()}`
      const entry = log.find((l) => l.key === key && l.status === 'failed')
      if (!entry) return null
      entry.status = 'pending'
      return entry.id
    },
    push: async (s, p) => {
      pushed.push(s.id)
      return push(s, p)
    },
    removeSubscription: async () => {},
    touchSubscription: async () => {},
    markResult: async (id, status) => {
      log.find((l) => l.id === id)!.status = status
    },
    heartbeat: async () => {
      beats++
    },
  }
  return { value, log, pushed, beats: () => beats }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('un dato non valido', () => {
  it('un fuso errato non ferma i promemoria degli altri utenti', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps([row({ tz: 'Not/AZone' }), row({ schedule_time_id: 't2', user_id: 'u2' })])
    const summary = await runSendReminders(d.value, AT_8)
    expect(d.pushed).toHaveLength(1)
    expect(summary).toMatchObject({ sent: 1, errors: 1 })
  })
})

describe('errori temporanei', () => {
  it('un errore del servizio push si ritenta al minuto dopo e invia una sola volta', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let calls = 0
    const d = deps([row()], async () => (++calls === 1 ? 503 : 201))
    await runSendReminders(d.value, AT_8)
    expect(d.log[0].status).toBe('failed')
    await runSendReminders(d.value, minutesLater(1))
    expect(d.log[0].status).toBe('sent')
    await runSendReminders(d.value, minutesLater(2))
    expect(calls).toBe(2)
  })

  it('un invio riuscito non si ritenta', async () => {
    const d = deps([row()])
    await runSendReminders(d.value, AT_8)
    await runSendReminders(d.value, minutesLater(1))
    expect(d.pushed).toHaveLength(1)
  })

  it('oltre la finestra un invio fallito non si ritenta', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps([row()], async () => 503)
    await runSendReminders(d.value, AT_8)
    await runSendReminders(d.value, minutesLater(5))
    expect(d.pushed).toHaveLength(1)
    expect(d.log[0].status).toBe('failed')
  })

  it('un servizio push bloccato non trattiene gli altri', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()
    const d = deps(
      [row({ subscriptions: [{ id: 'hung', endpoint: 'https://a/1', p256dh: 'k', auth: 'a' }] }), row({ schedule_time_id: 't2', user_id: 'u2' })],
      (s) => (s.id === 'hung' ? new Promise<number>(() => {}) : Promise.resolve(201)),
    )
    const run = runSendReminders(d.value, AT_8)
    await vi.advanceTimersByTimeAsync(15_000)
    const summary = await run
    expect(summary).toMatchObject({ sent: 1, failed: 1 })
  })
})

describe('orari e fusi', () => {
  it('dopo un viaggio a ovest lo stesso orario riparte nel nuovo fuso', async () => {
    const d = deps([row()])
    await runSendReminders(d.value, AT_8)
    d.value.load = async () => [row({ tz: 'Europe/London' })]
    await runSendReminders(d.value, new Date('2026-11-02T08:00:00Z'))
    expect(d.pushed).toHaveLength(2)
  })

  it('nella notte del cambio ora un orario nell\'ora ripetuta parte una sola volta', async () => {
    const night = row({ minutes: 150, weekdays: [7] }) // domenica 25 ottobre 2026, 2:30 a Roma
    const d = deps([night])
    await runSendReminders(d.value, new Date('2026-10-25T00:30:00Z'))
    await runSendReminders(d.value, new Date('2026-10-25T01:30:00Z'))
    expect(d.pushed).toHaveLength(1)
  })
})

describe('diagnostica', () => {
  it('ogni esecuzione lascia un segno di vita, anche senza invii', async () => {
    const d = deps([])
    await runSendReminders(d.value, AT_8)
    expect(d.beats()).toBe(1)
  })

  it('un rifiuto del servizio push finisce nei log con stato e host', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps([row()], async () => 403)
    await runSendReminders(d.value, AT_8)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('403'), expect.stringContaining('push.example.com'))
  })

  it('i log non contengono l\'indirizzo completo del dispositivo', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps([row()], async () => 403)
    await runSendReminders(d.value, AT_8)
    expect(JSON.stringify(error.mock.calls)).not.toContain('/abc')
  })
})
