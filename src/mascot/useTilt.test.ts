import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTilt } from './useTilt'

function orientation(gamma: number | null) {
  const event = new Event('deviceorientation')
  Object.assign(event, { gamma })
  act(() => {
    window.dispatchEvent(event)
  })
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setVisibility('visible')
})

describe('useTilt', () => {
  it('gamma 30 diventa 25, -40 diventa -25', async () => {
    const { result } = renderHook(() => useTilt(true))
    orientation(30)
    await waitFor(() => expect(result.current.tilt).toBe(25))
    orientation(-40)
    await waitFor(() => expect(result.current.tilt).toBe(-25))
    orientation(12)
    await waitFor(() => expect(result.current.tilt).toBe(12))
  })

  it('non ascolta se disattivato (riduci movimento o tranquillo)', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const { result } = renderHook(() => useTilt(false))
    expect(add.mock.calls.some(([type]) => type === 'deviceorientation')).toBe(false)
    orientation(10)
    expect(result.current.tilt).toBe(0)
  })

  it('pagina nascosta: toglie l’ascolto, e lo rimette al ritorno', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { result } = renderHook(() => useTilt(true))
    orientation(10)
    await waitFor(() => expect(result.current.tilt).toBe(10))
    setVisibility('hidden')
    expect(remove.mock.calls.some(([type]) => type === 'deviceorientation')).toBe(true)
    expect(result.current.tilt).toBe(0)
    setVisibility('visible')
    orientation(5)
    await waitFor(() => expect(result.current.tilt).toBe(5))
  })

  it('arrotonda a mezzo grado: 10,1 diventa 10, 10,3 diventa 10,5', async () => {
    const { result } = renderHook(() => useTilt(true))
    orientation(10.1)
    await waitFor(() => expect(result.current.tilt).toBe(10))
    orientation(10.3)
    await waitFor(() => expect(result.current.tilt).toBe(10.5))
  })

  it('un evento senza gamma non fa nulla', () => {
    const { result } = renderHook(() => useTilt(true))
    orientation(null)
    expect(result.current.tilt).toBe(0)
  })

  describe('iOS (permesso da chiedere)', () => {
    const stubIos = (answer: string | Error) => {
      const requestPermission = vi.fn(() => (answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)))
      vi.stubGlobal('DeviceOrientationEvent', Object.assign(function () {}, { requestPermission }))
      return requestPermission
    }

    it('senza permesso non ascolta; dopo «granted» sì, e si ricorda', async () => {
      const ask = stubIos('granted')
      const { result, unmount } = renderHook(() => useTilt(true))
      expect(result.current.needsPermission).toBe(true)
      orientation(10)
      expect(result.current.tilt).toBe(0)
      await act(() => result.current.request())
      expect(ask).toHaveBeenCalledOnce()
      expect(localStorage.getItem('bere.tiltPermission')).toBe('granted')
      orientation(10)
      await waitFor(() => expect(result.current.tilt).toBe(10))
      unmount()
      const again = renderHook(() => useTilt(true))
      expect(again.result.current.permission).toBe('granted')
    })

    it('«granted» salvato ma iOS lo ha dimenticato: dopo 2 s di silenzio il tocco lo richiede', async () => {
      localStorage.setItem('bere.tiltPermission', 'granted')
      const ask = stubIos('granted')
      const now = vi.spyOn(Date, 'now')
      now.mockReturnValue(1_000_000)
      renderHook(() => useTilt(true))
      const tap = () => document.dispatchEvent(new Event('pointerdown'))
      tap() // troppo presto
      expect(ask).not.toHaveBeenCalled()
      now.mockReturnValue(1_000_000 + 2100)
      tap()
      expect(ask).toHaveBeenCalledOnce()
      tap()
      expect(ask).toHaveBeenCalledOnce()
    })

    it('se gli eventi arrivano il tocco non chiede nulla; se la nuova richiesta è negata il permesso decade', async () => {
      localStorage.setItem('bere.tiltPermission', 'granted')
      const ask = stubIos('granted')
      const now = vi.spyOn(Date, 'now')
      now.mockReturnValue(1_000_000)
      const { result } = renderHook(() => useTilt(true))
      orientation(5)
      await waitFor(() => expect(result.current.tilt).toBe(5))
      now.mockReturnValue(1_000_000 + 3000)
      document.dispatchEvent(new Event('pointerdown'))
      expect(ask).not.toHaveBeenCalled()
      cleanup()

      localStorage.setItem('bere.tiltPermission', 'granted')
      const denied = stubIos('denied')
      const second = renderHook(() => useTilt(true))
      now.mockReturnValue(1_000_000 + 6000)
      document.dispatchEvent(new Event('pointerdown'))
      expect(denied).toHaveBeenCalledOnce()
      await waitFor(() => expect(second.result.current.permission).toBe('denied'))
    })

    it('permesso negato: nessun errore, nessun ascolto, e dopo il ricaricamento resta deciso', async () => {
      stubIos('denied')
      const { result, unmount } = renderHook(() => useTilt(true))
      await act(() => result.current.request())
      expect(result.current.permission).toBe('denied')
      orientation(10)
      expect(result.current.tilt).toBe(0)
      unmount()
      expect(renderHook(() => useTilt(true)).result.current.permission).toBe('denied')
    })

    it('la richiesta che fallisce vale come rifiuto; «Non ora» pure', async () => {
      stubIos(new Error('no'))
      const first = renderHook(() => useTilt(true))
      await act(() => first.result.current.request())
      expect(first.result.current.permission).toBe('denied')
      localStorage.clear()
      const second = renderHook(() => useTilt(true))
      act(() => second.result.current.dismiss())
      expect(localStorage.getItem('bere.tiltPermission')).toBe('denied')
    })

    it('su Android e desktop non serve nessun permesso', () => {
      expect(renderHook(() => useTilt(true)).result.current.needsPermission).toBe(false)
    })
  })
})
