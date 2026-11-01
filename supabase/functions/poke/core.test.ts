// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { runPoke, type PokeDeps } from './core.ts'

const sub = { id: 's', endpoint: 'https://push/s', p256dh: 'k', auth: 'a' }

function deps(over: Partial<PokeDeps> = {}) {
  return {
    claim: vi.fn(async () => 'ok'),
    senderName: vi.fn(async () => 'Anna'),
    subscriptions: vi.fn(async () => [sub]),
    push: vi.fn(async () => 201),
    removeSubscription: vi.fn(async () => {}),
    touchSubscription: vi.fn(async () => {}),
    ...over,
  }
}

describe('runPoke', () => {
  it('avvisa il destinatario con il nome di chi sprona', async () => {
    const d = deps()
    expect(await runPoke(d, 'a', 'b')).toBe('sent')
    expect(d.claim).toHaveBeenCalledWith('a', 'b')
    expect(d.subscriptions).toHaveBeenCalledWith('b')
    expect(d.push.mock.calls[0]).toMatchObject([sub, { title: 'Anna ti sprona' }])
  })

  it.each(['limit', 'blocked', 'self'])('con esito %s non manda nulla', async (result) => {
    const d = deps({ claim: vi.fn(async () => result) })
    expect(await runPoke(d, 'a', 'b')).toBe(result)
    expect(d.push).not.toHaveBeenCalled()
  })

  it('se il destinatario non ha telefoni lo dice', async () => {
    expect(await runPoke(deps({ subscriptions: vi.fn(async () => []) }), 'a', 'b')).toBe('no-device')
  })

  it('un servizio push che rifiuta risulta fallito', async () => {
    expect(await runPoke(deps({ push: vi.fn(async () => 500) }), 'a', 'b')).toBe('failed')
  })
})
