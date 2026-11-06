import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import { cheerConfirmation, drinkConfirmation, notificationOptions } from './notification'
import { subscribePush } from './subscribe'

function stubBrowser(existing: { endpoint: string } | null) {
  const unsubscribe = vi.fn(async () => true)
  const old = existing && { ...existing, unsubscribe, toJSON: () => ({ keys: { p256dh: 'old', auth: 'old' } }) }
  const fresh = { endpoint: 'https://push/new', unsubscribe: vi.fn(), toJSON: () => ({ keys: { p256dh: 'k', auth: 'a' } }) }
  const subscribe = vi.fn(async () => fresh)
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission: async () => 'granted' })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => old, subscribe } }) },
  })
  return { unsubscribe, subscribe }
}

beforeEach(() => {
  fake = createFakeSupabase()
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('subscribePush', () => {
  it('sostituisce un\'iscrizione esistente, che il servizio push può aver scartato', async () => {
    const { unsubscribe, subscribe } = stubBrowser({ endpoint: 'https://push/morto' })
    await subscribePush()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(fake.rpcCalls).toEqual([
      { name: 'register_push_subscription', args: { p_endpoint: 'https://push/new', p_p256dh: 'k', p_auth: 'a' } },
    ])
  })

  it('senza iscrizioni ne crea una', async () => {
    const { unsubscribe, subscribe } = stubBrowser(null)
    await subscribePush()
    expect(unsubscribe).not.toHaveBeenCalled()
    expect(subscribe).toHaveBeenCalledTimes(1)
  })
})

describe('notificationOptions', () => {
  it('non usa un tag fisso: sostituirebbe in silenzio il promemoria precedente', () => {
    const options = notificationOptions({ title: 'x', body: '200 ml', url: '#/home' })
    expect(options.tag).toBeUndefined()
    expect(options.body).toBe('200 ml')
    expect(options.data).toEqual({ url: '#/home' })
    expect(options.actions).toBeUndefined()
  })
  it("solo i promemoria hanno «Bevuto ✓», con l'id del promemoria nei dati", () => {
    const options = notificationOptions({ title: 'x', body: '200 ml', url: '#/home', logId: 'log1' })
    expect(options.actions).toEqual([{ action: 'drink', title: 'Bevuto ✓' }])
    expect(options.data).toEqual({ url: '#/home', logId: 'log1' })
  })
})

describe('drinkConfirmation', () => {
  const base = { ok: true, added: true, amount_ml: 250, drunk_ml: 1250, goal_ml: 3000, units: 'ml' as const }
  it('conferma la quantità e il totale di oggi, senza suono', () => {
    const { title, options } = drinkConfirmation(base)
    expect(title).toBe('Segnati 250 ml')
    expect(options.body).toBe('1,25 L su 3 L oggi')
    expect(options).toMatchObject({ tag: 'bere-bevuto', silent: true })
  })
  it('un secondo tocco non segna di nuovo', () => {
    expect(drinkConfirmation({ ...base, added: false }).title).toBe('Già segnata')
  })
  it("festeggia l'obiettivo raggiunto", () => {
    expect(drinkConfirmation({ ...base, drunk_ml: 3000 }).title).toBe('Obiettivo raggiunto 🎉')
  })
  it("senza rete o con un promemoria scaduto invita ad aprire l'app", () => {
    for (const r of [null, { ok: false }]) {
      const { title, options } = drinkConfirmation(r)
      expect(title).toBe('Bevuta non segnata')
      expect(options.data).toEqual({ url: '#/home' })
    }
  })
})

describe('complimenti dalla notifica', () => {
  it("l'avviso di un amico ha «Complimenti» con il biglietto, non «Bevuto ✓»", () => {
    const options = notificationOptions({ title: 'x', body: 'y', url: '#/classifica', logId: '', cheerToken: 't1' })
    expect(options.actions).toEqual([{ action: 'cheer', title: '👏 Complimenti' }])
    expect(options.data).toEqual({ url: '#/classifica', cheerToken: 't1' })
  })
  it('conferma senza suono, o invita a riprovare dalla classifica', () => {
    expect(cheerConfirmation('sent')).toMatchObject({ title: 'Complimenti inviati 👏', options: { silent: true } })
    expect(cheerConfirmation('already').title).toBe('Complimenti già inviati')
    expect(cheerConfirmation(null)).toMatchObject({ title: 'Complimenti non inviati', options: { data: { url: '#/classifica' } } })
  })
})
