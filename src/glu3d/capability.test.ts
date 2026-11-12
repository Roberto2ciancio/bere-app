import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ on: true }))
vi.mock('./enabled', () => ({
  get GLU_3D_ENABLED() {
    return h.on
  },
}))

import { CHECK_KEY, CHOICE_TIMEOUT_MS, resetGlu3dForTests, startGlu3d, useGlu3dChoice } from './capability'
import type { CheckResult, Glu3dRuntime } from './capability'
import { setGlu3dOn } from '../mascot/glu3dPref'
import { readCache, writeCache } from '../lib/cache'

const flush = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function fakeRuntime(result: CheckResult) {
  return { probe: vi.fn(async () => result) } as unknown as Glu3dRuntime
}

describe('capability', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    h.on = true
    localStorage.clear()
    resetGlu3dForTests()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('costante falsa: 2d subito, load mai chiamato', () => {
    h.on = false
    const load = vi.fn()
    startGlu3d(load)
    const { result } = renderHook(() => useGlu3dChoice('u1'))
    expect(result.current).toBe('2d')
    expect(load).not.toHaveBeenCalled()
  })

  it('interruttore spento: 2d subito', () => {
    setGlu3dOn('u1', false)
    const { result } = renderHook(() => useGlu3dChoice('u1'))
    expect(result.current).toBe('2d')
  })

  it('senza utente: 2d subito', () => {
    const { result } = renderHook(() => useGlu3dChoice(null))
    expect(result.current).toBe('2d')
  })

  it('check salvato slow per questa versione: 2d subito', () => {
    writeCache(CHECK_KEY, { result: 'slow', version: __APP_VERSION__ })
    const { result } = renderHook(() => useGlu3dChoice('u1'))
    expect(result.current).toBe('2d')
  })

  it('check di un altra versione: nuova prova', async () => {
    writeCache(CHECK_KEY, { result: 'slow', version: '0.0.0' })
    const rt = fakeRuntime('ok')
    startGlu3d(async () => rt)
    const { result } = renderHook(() => useGlu3dChoice('u1'))
    expect(result.current).toBe('pending')
    await flush()
    expect(rt.probe).toHaveBeenCalled()
    expect(result.current).toBe('3d')
  })

  it('check rovinato: nuova prova, nessuna eccezione', async () => {
    localStorage.setItem('dev.' + CHECK_KEY, 'xx')
    localStorage.setItem(CHECK_KEY, 'xx')
    const rt = fakeRuntime('ok')
    startGlu3d(async () => rt)
    const { result } = renderHook(() => useGlu3dChoice('u1'))
    await flush()
    expect(rt.probe).toHaveBeenCalled()
    expect(result.current).toBe('3d')
  })

  it('runtime pronto + ok: pending poi 3d, check salvato', async () => {
    startGlu3d(async () => fakeRuntime('ok'))
    const { result } = renderHook(() => useGlu3dChoice('u1'))
    expect(result.current).toBe('pending')
    await flush()
    expect(result.current).toBe('3d')
    expect(readCache(CHECK_KEY)).toEqual({ result: 'ok', version: __APP_VERSION__ })
  })

  it('prova nowebgl: 2d', async () => {
    startGlu3d(async () => fakeRuntime('nowebgl'))
    const { result } = renderHook(() => useGlu3dChoice('u1'))
    await flush()
    expect(result.current).toBe('2d')
  })

  it('runtime in ritardo: dopo il timeout 2d, anche per nuove istanze', async () => {
    let arrive!: (r: Glu3dRuntime) => void
    startGlu3d(() => new Promise<Glu3dRuntime>((res) => (arrive = res)))
    const { result } = renderHook(() => useGlu3dChoice('u1'))
    expect(result.current).toBe('pending')
    act(() => {
      vi.advanceTimersByTime(CHOICE_TIMEOUT_MS)
    })
    expect(result.current).toBe('2d')
    arrive(fakeRuntime('ok'))
    await flush()
    expect(result.current).toBe('2d')
    const second = renderHook(() => useGlu3dChoice('u1'))
    expect(second.result.current).toBe('2d')
  })

  it('smontaggio in pending: nessun avviso', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    let arrive!: (r: Glu3dRuntime) => void
    startGlu3d(() => new Promise<Glu3dRuntime>((res) => (arrive = res)))
    const { unmount } = renderHook(() => useGlu3dChoice('u1'))
    unmount()
    arrive(fakeRuntime('ok'))
    await flush()
    act(() => {
      vi.advanceTimersByTime(CHOICE_TIMEOUT_MS)
    })
    expect(err).not.toHaveBeenCalled()
  })
})
