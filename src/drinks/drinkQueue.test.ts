import { describe, expect, it, vi } from 'vitest'
import { enqueueDrink, flushQueue, pendingDrinks, removeQueued, type QueuedDrink } from './drinkQueue'

const ROME = 'Europe/Rome'
const add = (userId = 'u1', now = new Date('2026-11-02T10:00:00Z')) => enqueueDrink({ userId, amountMl: 200, tz: ROME, now })

describe('drinkQueue', () => {
  it('conserva la bevuta in localStorage', () => {
    const queued = add()
    expect(queued).toMatchObject({ user_id: 'u1', amount_ml: 200, local_date: '2026-11-02' })
    expect(queued.client_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(JSON.parse(localStorage.getItem('bere.drinkQueue')!)).toEqual([queued])
  })

  it('una bevuta alle 00:30 ha la data del nuovo giorno', () => {
    expect(add('u1', new Date('2026-11-01T23:30:00Z')).local_date).toBe('2026-11-02')
  })

  it('un invio riuscito svuota la coda', async () => {
    add()
    const send = vi.fn(async () => {})
    await flushQueue('u1', send)
    expect(send).toHaveBeenCalledTimes(1)
    expect(pendingDrinks('u1')).toEqual([])
  })

  it('un invio fallito conserva la bevuta con lo stesso client_id', async () => {
    const queued = add()
    await flushQueue('u1', async () => {
      throw new Error('offline')
    })
    expect(pendingDrinks('u1')).toEqual([queued])
    const sent: QueuedDrink[] = []
    await flushQueue('u1', async (d) => {
      sent.push(d)
    })
    expect(sent.map((d) => d.client_id)).toEqual([queued.client_id])
  })

  it('dopo un errore conserva anche le bevute successive', async () => {
    add()
    add()
    await flushQueue('u1', async () => {
      throw new Error('offline')
    })
    expect(pendingDrinks('u1')).toHaveLength(2)
  })

  it('non invia due volte se due svuotamenti si sovrappongono', async () => {
    add()
    const send = vi.fn(async () => {})
    await Promise.all([flushQueue('u1', send), flushQueue('u1', send)])
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('non invia le bevute di un altro utente dello stesso telefono', async () => {
    add('u2')
    const send = vi.fn(async () => {})
    await flushQueue('u1', send)
    expect(send).not.toHaveBeenCalled()
    expect(pendingDrinks('u2')).toHaveLength(1)
  })

  it('removeQueued toglie una bevuta non ancora inviata', () => {
    const queued = add()
    expect(removeQueued(queued.client_id)).toBe(true)
    expect(pendingDrinks('u1')).toEqual([])
    expect(removeQueued(queued.client_id)).toBe(false)
  })

  it('una coda illeggibile non blocca l\'app', () => {
    localStorage.setItem('bere.drinkQueue', '{rotta')
    expect(pendingDrinks('u1')).toEqual([])
  })
})
