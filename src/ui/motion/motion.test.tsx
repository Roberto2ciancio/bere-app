import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CountUp } from './CountUp'
import { MotionRoot } from './MotionRoot'
import { confetti, haptic } from './effects'

vi.mock('canvas-confetti', () => {
  throw new Error('no canvas')
})

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

afterEach(() => vi.unstubAllGlobals())

describe('CountUp', () => {
  it('espone il valore finale come testo accessibile', () => {
    stubReducedMotion(false)
    render(
      <MotionRoot>
        <CountUp value={1250} format={(n) => `${n} ml`} />
      </MotionRoot>,
    )
    expect(screen.getByLabelText('1250 ml')).toBeInTheDocument()
  })

  it('con riduzione movimento mostra subito il valore finale, anche dopo un cambio', () => {
    stubReducedMotion(true)
    const format = (n: number) => `${n} ml`
    const { rerender } = render(
      <MotionRoot>
        <CountUp value={500} format={format} />
      </MotionRoot>,
    )
    rerender(
      <MotionRoot>
        <CountUp value={1250} format={format} />
      </MotionRoot>,
    )
    expect(screen.getByLabelText('1250 ml')).toHaveTextContent('1250 ml')
  })
})

describe('effetti', () => {
  it('confetti non lancia se canvas-confetti non si carica', async () => {
    stubReducedMotion(false)
    expect(() => confetti('goal')).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
  })

  it('haptic non lancia senza navigator.vibrate', () => {
    vi.stubGlobal('navigator', {})
    expect(() => haptic()).not.toThrow()
  })
})
