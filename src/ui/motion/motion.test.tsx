import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CountUp } from './CountUp'
import { MotionRoot } from './MotionRoot'
import { haptic } from './effects'

const confettiMock = vi.hoisted(() => ({ fire: vi.fn() }))
vi.mock('canvas-confetti', () => ({ default: confettiMock.fire }))

const originalMatchMedia = window.matchMedia

function stubReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

beforeEach(() => stubReducedMotion(false))
afterEach(() => {
  window.matchMedia = originalMatchMedia
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.resetModules()
  vi.doMock('canvas-confetti', () => ({ default: confettiMock.fire }))
  confettiMock.fire.mockClear()
})

const ml = (n: number) => `${n} ml`
// Cifre animate (nascoste agli screen reader) e valore finale per gli screen reader.
const animated = (c: HTMLElement) => c.querySelector('[aria-hidden="true"]')!
const spoken = (c: HTMLElement) => c.querySelector('.visually-hidden')!

const wrap = (value: number) => (
  <MotionRoot>
    <CountUp value={value} format={ml} />
  </MotionRoot>
)

describe('CountUp', () => {
  it('al primo render mostra subito il valore, con testo accessibile', () => {
    const { container } = render(wrap(1250))
    expect(animated(container)).toHaveTextContent('1250 ml')
    expect(spoken(container)).toHaveTextContent('1250 ml')
  })

  it('quando il valore cambia anima e finisce sul valore finale', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(wrap(500))
    rerender(wrap(1000))
    expect(spoken(container)).toHaveTextContent('1000 ml')
    act(() => vi.advanceTimersByTime(300))
    const mid = Number(animated(container).textContent!.replace(' ml', ''))
    expect(mid).toBeGreaterThan(500)
    expect(mid).toBeLessThan(1000)
    act(() => vi.advanceTimersByTime(600))
    expect(animated(container)).toHaveTextContent('1000 ml')
  })

  it('con riduzione movimento mostra subito il valore finale dopo un cambio', () => {
    stubReducedMotion(true)
    const { container, rerender } = render(wrap(500))
    rerender(wrap(1250))
    expect(animated(container)).toHaveTextContent('1250 ml')
  })
})

describe('confetti', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0))

  it('lancia canvas-confetti quando l\'import riesce', async () => {
    const { confetti } = await import('./effects')
    confetti('level')
    await flush()
    expect(confettiMock.fire).toHaveBeenCalledTimes(2)
  })

  it('con riduzione movimento non fa nulla', async () => {
    stubReducedMotion(true)
    const { confetti } = await import('./effects')
    confetti('goal')
    await flush()
    expect(confettiMock.fire).not.toHaveBeenCalled()
  })

  it('ingoia l\'errore se canvas-confetti non si carica (nessuna rejection non gestita)', async () => {
    vi.doMock('canvas-confetti', () => {
      throw new Error('no canvas')
    })
    const unhandled = vi.fn()
    const proc = (globalThis as unknown as {
      process: {
        on: (e: string, f: () => void) => void
        off: (e: string, f: () => void) => void
      }
    }).process
    proc.on('unhandledRejection', unhandled)
    try {
      const { confetti } = await import('./effects')
      expect(() => confetti('goal')).not.toThrow()
      await flush()
      await flush()
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      proc.off('unhandledRejection', unhandled)
    }
  })
})

describe('haptic', () => {
  it('chiama vibrate(10) quando c\'è', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    haptic()
    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('non lancia senza navigator.vibrate', () => {
    vi.stubGlobal('navigator', {})
    expect(() => haptic()).not.toThrow()
  })
})
