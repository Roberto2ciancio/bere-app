import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('./supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import { touchLastSeen } from './lastSeen'

beforeEach(() => {
  fake = createFakeSupabase()
})

describe('touchLastSeen', () => {
  it('avvisa il server al massimo ogni 15 minuti', () => {
    const t0 = 1_000_000_000_000
    touchLastSeen(t0)
    touchLastSeen(t0 + 5 * 60_000)
    touchLastSeen(t0 + 16 * 60_000)
    expect(fake.rpcCalls.filter((c) => c.name === 'touch_last_seen')).toHaveLength(2)
  })
})
