// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { parseCheer, runCheer, type CheerDeps } from './core.ts'

const sub = { id: 's', endpoint: 'https://push/s', p256dh: 'k', auth: 'a' }
const ID_A = '00000000-0000-0000-0000-00000000000a'
const ID_B = '00000000-0000-0000-0000-00000000000b'

function deps(over: Partial<CheerDeps> = {}) {
  return {
    claimToken: vi.fn(async () => ({ to_user: 'a', from_name: 'Bruno' })),
    claim: vi.fn(async () => 'ok'),
    name: vi.fn(async () => 'Bruno'),
    subscriptions: vi.fn(async () => [sub]),
    push: vi.fn(async () => 201),
    removeSubscription: vi.fn(async () => {}),
    touchSubscription: vi.fn(async () => {}),
    ...over,
  }
}

describe('runCheer', () => {
  it('dalla notifica: avvisa chi ha raggiunto l’obiettivo con il nome di chi manda', async () => {
    const d = deps()
    expect(await runCheer(d, { token: 't' })).toBe('sent')
    expect(d.subscriptions).toHaveBeenCalledWith('a')
    expect(d.push.mock.calls[0]).toMatchObject([sub, { title: 'Bruno ti fa i complimenti 👏', url: '#/classifica' }])
  })

  it('un biglietto già usato non manda nulla', async () => {
    const d = deps({ claimToken: vi.fn(async () => null) })
    expect(await runCheer(d, { token: 't' })).toBe('already')
    expect(d.push).not.toHaveBeenCalled()
  })

  it('dalla classifica', async () => {
    const d = deps()
    expect(await runCheer(d, { from: 'b', to: 'a' })).toBe('sent')
    expect(d.claim).toHaveBeenCalledWith('b', 'a')
  })

  it.each(['already', 'no-goal', 'self'])('con esito %s non manda nulla', async (result) => {
    const d = deps({ claim: vi.fn(async () => result) })
    expect(await runCheer(d, { from: 'b', to: 'a' })).toBe(result)
    expect(d.push).not.toHaveBeenCalled()
  })

  it('senza dispositivi lo dice', async () => {
    expect(await runCheer(deps({ subscriptions: vi.fn(async () => []) }), { token: 't' })).toBe('no-device')
  })
})

describe('parseCheer', () => {
  it('accetta un biglietto anche senza accesso, un destinatario solo con l’accesso', () => {
    expect(parseCheer({ token: ID_A }, null)).toEqual({ token: ID_A })
    expect(parseCheer({ to: ID_A }, ID_B)).toEqual({ from: ID_B, to: ID_A })
    expect(parseCheer({ to: ID_A }, null)).toBeNull()
    expect(parseCheer({ token: 'x; drop' }, null)).toBeNull()
    expect(parseCheer(null, ID_B)).toBeNull()
  })
})
