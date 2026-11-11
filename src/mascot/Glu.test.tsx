import { fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Glu } from './Glu'
import type { GluMood } from './mood'

function renderGlu(props: Parameters<typeof Glu>[0]) {
  return render(
    <LazyMotion features={domAnimation} strict>
      <Glu {...props} />
    </LazyMotion>,
  )
}

const MOODS: GluMood[] = ['hello', 'idle', 'thirsty', 'drink', 'goal', 'sad', 'sleep', 'levelup']

const DISTINCTIVE: Partial<Record<GluMood, string>> = {
  sleep: '.glu-zzz',
  thirsty: '.glu-tongue',
  sad: '.glu-tear',
  goal: '.glu-star',
  levelup: '.glu-star',
}

function waterY(): number {
  const water = screen.getByTestId('glu').querySelector('.glu-water')
  return Number(water?.getAttribute('y'))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Glu', () => {
  it.each(MOODS)('umore %s: data-mood e parte distintiva', (mood) => {
    renderGlu({ mood, fill: 0.5 })
    const svg = screen.getByTestId('glu')
    expect(svg).toHaveAttribute('data-mood', mood)
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('viewBox', '0 0 200 200')
    for (const part of ['.glu-body', '.glu-water', '.glu-wave', '.glu-mouth', '.glu-cheek', '.glu-arm']) {
      expect(svg.querySelector(part), part).not.toBeNull()
    }
    const distinctive = DISTINCTIVE[mood]
    if (distinctive) expect(svg.querySelector(distinctive)).not.toBeNull()
  })

  it('mostra gli accessori solo negli umori giusti', () => {
    renderGlu({ mood: 'idle', fill: 0.5 })
    const svg = screen.getByTestId('glu')
    for (const part of ['.glu-zzz', '.glu-tongue', '.glu-tear', '.glu-star']) {
      expect(svg.querySelector(part), part).toBeNull()
    }
    expect(svg.querySelector('.glu-eye')).not.toBeNull()
  })

  it('acqua tagliata sul corpo con un id unico', () => {
    renderGlu({ mood: 'idle', fill: 0.5 })
    const svg = screen.getByTestId('glu')
    const clip = svg.querySelector('clipPath')
    expect(clip?.id).toBeTruthy()
    expect(svg.querySelector(`[clip-path="url(#${clip?.id})"]`)).not.toBeNull()
  })

  it.each([1.7, Number.NaN, -3])('con fill=%s la y dell’acqua resta tra 0 e 200', (fill) => {
    renderGlu({ mood: 'idle', fill })
    const y = waterY()
    expect(Number.isFinite(y)).toBe(true)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y).toBeLessThanOrEqual(200)
  })

  it('più acqua alza il livello', () => {
    const { unmount } = renderGlu({ mood: 'idle', fill: 0 })
    const empty = waterY()
    unmount()
    renderGlu({ mood: 'idle', fill: 1 })
    expect(waterY()).toBeLessThan(empty)
  })

  it('due tocchi a 100 ms chiamano onTap una volta sola', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000)
    const onTap = vi.fn()
    renderGlu({ mood: 'idle', fill: 0.5, onTap })
    const svg = screen.getByTestId('glu')
    fireEvent.click(svg)
    now.mockReturnValue(10_100)
    fireEvent.click(svg)
    expect(onTap).toHaveBeenCalledTimes(1)
    now.mockReturnValue(11_200)
    fireEvent.click(svg)
    expect(onTap).toHaveBeenCalledTimes(2)
  })

  it('usa la dimensione richiesta', () => {
    renderGlu({ mood: 'idle', fill: 0.5, size: 96 })
    const svg = screen.getByTestId('glu')
    expect(svg).toHaveAttribute('width', '96')
    expect(svg).toHaveAttribute('height', '96')
  })
})
