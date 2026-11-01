// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { handleRequest, planSends, runSendReminders, type Deps, type ReminderRow, type Subscription } from './core.ts'

const sub = (id: string): Subscription => ({ id, endpoint: `https://push/${id}`, p256dh: 'k', auth: 'a' })

// Lunedì 2 novembre 2026: alle 8:00 a Roma sono le 7:00 UTC.
const AT_8 = new Date('2026-11-02T07:00:00Z')
const row = (over: Partial<ReminderRow> = {}): ReminderRow => ({
  schedule_time_id: 't1',
  user_id: 'u1',
  minutes: 480,
  weekdays: [1],
  tz: 'Europe/Rome',
  drink_ml: 200,
  subscriptions: [sub('s1')],
  ...over,
})

function deps(rows: ReminderRow[], push: Deps['push'] = async () => 201) {
  const log: { id: string; userId: string; timeId: string; date: string; scheduledAt: string; status: string; sentAt?: string }[] = []
  const removed: string[] = []
  const healthy: string[] = []
  const sent: { sub: string; payload: unknown }[] = []
  const value: Deps = {
    load: async () => rows,
    claim: async (c) => {
      if (log.some((l) => l.userId === c.userId && l.timeId === c.scheduleTimeId && l.scheduledAt === c.scheduledAt.toISOString())) return null
      const id = `log${log.length}`
      log.push({ id, userId: c.userId, timeId: c.scheduleTimeId, date: c.date, scheduledAt: c.scheduledAt.toISOString(), status: c.status })
      return id
    },
    reclaim: async () => null,
    heartbeat: async () => {},
    push: async (s, payload) => {
      sent.push({ sub: s.id, payload })
      return push(s, payload)
    },
    removeSubscription: async (id) => {
      removed.push(id)
    },
    touchSubscription: async (id) => {
      healthy.push(id)
    },
    markResult: async (id, status, sentAt) => {
      const entry = log.find((l) => l.id === id)!
      entry.status = status
      entry.sentAt = sentAt?.toISOString()
    },
  }
  return { value, log, removed, healthy, sent }
}

describe('planSends', () => {
  it('include un promemoria dovuto con il suo orario previsto', () => {
    const [plan] = planSends([row()], new Date('2026-11-02T07:03:00Z'))
    expect(plan).toMatchObject({ date: '2026-11-02', late: 3, kind: 'send' })
    expect(plan.scheduledAt.toISOString()).toBe('2026-11-02T07:00:00.000Z')
  })
  it('ignora un promemoria di un altro giorno', () => {
    expect(planSends([row({ weekdays: [2] })], AT_8)).toEqual([])
  })
  it('oltre 5 minuti lo segna come mancato', () => {
    const [plan] = planSends([row()], new Date('2026-11-02T07:05:00Z'))
    expect(plan).toMatchObject({ kind: 'missed', late: 5 })
  })
  it('oltre un\'ora lo ignora', () => {
    expect(planSends([row()], new Date('2026-11-02T08:00:00Z'))).toEqual([])
  })
})

describe('runSendReminders', () => {
  it('invia a tutti i dispositivi dell\'utente', async () => {
    const d = deps([row({ subscriptions: [sub('s1'), sub('s2')] })])
    const summary = await runSendReminders(d.value, AT_8)
    expect(d.sent.map((s) => s.sub)).toEqual(['s1', 's2'])
    expect(d.log[0]).toMatchObject({ status: 'sent', sentAt: AT_8.toISOString() })
    expect(d.healthy).toEqual(['s1', 's2'])
    expect(summary.sent).toBe(1)
  })

  it('il messaggio contiene quantità e riferimento al registro', async () => {
    const d = deps([row({ drink_ml: 250 })])
    await runSendReminders(d.value, AT_8)
    expect(d.sent[0].payload).toEqual({ title: 'È ora di bere', body: '250 ml', url: '#/home', logId: 'log0' })
  })

  it('due esecuzioni nello stesso minuto inviano una sola volta', async () => {
    const d = deps([row()])
    await runSendReminders(d.value, AT_8)
    await runSendReminders(d.value, AT_8)
    expect(d.sent).toHaveLength(1)
  })

  it('cron saltato: alle 8:03 parte il promemoria delle 8:00 e il ritardo resta nel registro', async () => {
    const d = deps([row()])
    const late = new Date('2026-11-02T07:03:00Z')
    await runSendReminders(d.value, late)
    expect(d.sent).toHaveLength(1)
    const entry = d.log[0]
    expect((Date.parse(entry.sentAt!) - Date.parse(entry.scheduledAt)) / 60000).toBe(3)
  })

  it('oltre la finestra non invia e registra missed una sola volta', async () => {
    const d = deps([row()])
    await runSendReminders(d.value, new Date('2026-11-02T07:06:00Z'))
    await runSendReminders(d.value, new Date('2026-11-02T07:07:00Z'))
    expect(d.sent).toHaveLength(0)
    expect(d.log).toHaveLength(1)
    expect(d.log[0].status).toBe('missed')
  })

  it('senza dispositivi registra no-device', async () => {
    const d = deps([row({ subscriptions: [] })])
    await runSendReminders(d.value, AT_8)
    expect(d.log[0].status).toBe('no-device')
  })

  it.each([404, 410])('risposta %i rimuove l\'iscrizione', async (status) => {
    const d = deps([row()], async () => status)
    await runSendReminders(d.value, AT_8)
    expect(d.removed).toEqual(['s1'])
    expect(d.log[0].status).toBe('no-device')
  })

  it('risposta 500 mantiene l\'iscrizione e registra failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps([row()], async () => 500)
    await runSendReminders(d.value, AT_8)
    expect(d.removed).toEqual([])
    expect(d.log[0].status).toBe('failed')
  })

  it('basta un dispositivo raggiunto per segnare sent', async () => {
    const d = deps([row({ subscriptions: [sub('s1'), sub('s2')] })], async (s) => (s.id === 's1' ? 410 : 201))
    await runSendReminders(d.value, AT_8)
    expect(d.log[0].status).toBe('sent')
    expect(d.removed).toEqual(['s1'])
  })

  it('un errore su un utente non blocca gli altri', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps(
      [row({ schedule_time_id: 't1', user_id: 'u1' }), row({ schedule_time_id: 't2', user_id: 'u2', subscriptions: [sub('s2')] })],
      async (s) => {
        if (s.id === 's1') throw new Error('rete')
        return 201
      },
    )
    await runSendReminders(d.value, AT_8)
    expect(d.log.find((l) => l.userId === 'u1')?.status).toBe('failed')
    expect(d.log.find((l) => l.userId === 'u2')?.status).toBe('sent')
  })

  it('un errore nel claim non blocca gli altri', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps([row({ schedule_time_id: 't1' }), row({ schedule_time_id: 't2', user_id: 'u2' })])
    const claim = d.value.claim
    d.value.claim = vi.fn(async (c) => {
      if (c.scheduleTimeId === 't1') throw new Error('db')
      return claim(c)
    })
    const summary = await runSendReminders(d.value, AT_8)
    expect(d.sent).toHaveLength(1)
    expect(summary.errors).toBe(1)
  })
})

describe('handleRequest', () => {
  const request = (secret?: string) =>
    new Request('https://x/functions/v1/send-reminders', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} })

  it('senza segreto risponde 401 e non invia', async () => {
    const run = vi.fn(async () => ({ sent: 0, missed: 0, failed: 0, errors: 0 }))
    expect((await handleRequest(request(), 'giusto', run)).status).toBe(401)
    expect((await handleRequest(request('sbagliato'), 'giusto', run)).status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  it('senza segreto configurato rifiuta tutto', async () => {
    const run = vi.fn(async () => ({ sent: 0, missed: 0, failed: 0, errors: 0 }))
    expect((await handleRequest(request(''), '', run)).status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  it('con il segreto esegue e riporta il riepilogo', async () => {
    const response = await handleRequest(request('giusto'), 'giusto', async () => ({ sent: 2, missed: 0, failed: 0, errors: 0 }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sent: 2, missed: 0, failed: 0, errors: 0 })
  })
})
