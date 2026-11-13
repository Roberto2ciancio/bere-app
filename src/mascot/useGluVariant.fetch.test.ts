import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ flag: true, rpc: vi.fn() }))
vi.mock('./variantsFlag', () => ({
  get GLU_VARIANTS() {
    return state.flag
  },
}))
vi.mock('../auth/ProfileProvider', () => ({ useOptionalProfile: () => ({ profile: { home_style: 'menta' } }) }))
vi.mock('../auth/AuthProvider', () => ({ useOptionalAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: state.rpc } }))

import { resetSharedLevels } from '../levels/useLevels'
import { useGluVariant } from './useGluVariant'

describe('useGluVariant: richieste dei livelli', () => {
  beforeEach(() => {
    resetSharedLevels()
    state.flag = true
    state.rpc.mockReset()
    state.rpc.mockResolvedValue({ data: [{ user_id: 'u1', points: 100 }], error: null })
  })

  it('flag spento → get_levels non viene mai chiamato', async () => {
    state.flag = false
    const { result } = renderHook(() => useGluVariant())
    await Promise.resolve()
    expect(result.current.id).toBe('glu')
    expect(state.rpc).not.toHaveBeenCalled()
  })

  it('flag acceso, tre istanze → una sola chiamata', async () => {
    const hooks = [1, 2, 3].map(() => renderHook(() => useGluVariant()))
    await waitFor(() => expect(hooks.every((h) => h.result.current.id === 'menta')).toBe(true))
    expect(state.rpc).toHaveBeenCalledTimes(1)
    expect(state.rpc).toHaveBeenCalledWith('get_levels')
  })
})
