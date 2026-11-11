import { act, fireEvent, render, screen } from '@testing-library/react'
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

const MOODS: GluMood[] = ['hello', 'idle', 'thirsty', 'drink', 'almost', 'goal', 'sad', 'sleep', 'levelup', 'coffee', 'workout']

// Parti che solo quell'umore ha (o che lo distinguono dagli altri).
const DISTINCTIVE: Record<GluMood, string[]> = {
  thirsty: ['.glu-sweat', '.glu-brow', '.glu-eye-open'],
  idle: ['.glu-eye-open', '.glu-mouth-smile'],
  hello: ['.glu-eye-open', '.glu-mouth-smile', '.glu-arm-waving'],
  drink: ['.glu-bubbles', '.glu-eye-happy', '.glu-mouth-o'],
  almost: ['.glu-eye-open', '.glu-eye-happy', '.glu-mouth-grin'],
  goal: ['.glu-eye-happy', '.glu-mouth-grin'],
  sad: ['.glu-brow', '.glu-eye-open', '.glu-mouth-sad'],
  sleep: ['.glu-zzz', '.glu-eye-sleep', '.glu-mouth-calm'],
  levelup: ['.glu-sparkle', '.glu-eye-happy', '.glu-mouth-grin'],
  coffee: ['.glu-eye-wide', '.glu-mouth-surprised'],
  workout: ['.glu-eye-effort', '.glu-mouth-effort', '.glu-sweat-drops'],
}

const EXTRAS = [
  '.glu-sweat',
  '.glu-bubbles',
  '.glu-zzz',
  '.glu-sparkle',
  '.glu-brow',
  '.glu-arm-waving',
  '.glu-sweat-drops',
  '.glu-headband',
  '.glu-crown',
  '.glu-cape',
  '.glu-fan',
]

const svg = () => screen.getByTestId('glu')

function reduceMotion() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
  )
}

// Scala verticale dell'afflosciamento (1 se non c'è).
function droopScale(): number {
  const t = svg().querySelector('.glu-droop')?.getAttribute('transform') ?? ''
  const match = /scale\(1 ([\d.]+)\)/.exec(t)
  return match ? Number(match[1]) : 1
}

function waterRotation(): number {
  const t = svg().querySelector('.glu-tilt')?.getAttribute('transform') ?? ''
  const match = /rotate\((-?[\d.]+) 100 105\)/.exec(t)
  return match ? Number(match[1]) : 0
}

// Il livello dell'acqua è il primo numero dopo «M0» nel tracciato dell'onda.
function waveY(): number {
  const d = svg().querySelector('.glu-water')?.getAttribute('d') ?? ''
  const match = /^M0 (-?[\d.]+)/.exec(d)
  return match ? Number(match[1]) : Number.NaN
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Glu', () => {
  it.each(MOODS)('umore %s: data-mood, corpo completo e parti distintive', (mood) => {
    renderGlu({ mood, fill: 0.5 })
    const el = svg()
    expect(el).toHaveAttribute('data-mood', mood)
    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el).toHaveAttribute('viewBox', '0 0 200 200')
    for (const part of ['.glu-body', '.glu-water', '.glu-wave', '.glu-mouth', '.glu-tuft']) {
      expect(el.querySelector(part), part).not.toBeNull()
    }
    expect(el.querySelectorAll('.glu-arm')).toHaveLength(2)
    expect(el.querySelectorAll('.glu-foot')).toHaveLength(2)
    expect(el.querySelectorAll('.glu-eye')).toHaveLength(2)
    for (const part of DISTINCTIVE[mood]) expect(el.querySelector(part), part).not.toBeNull()
    // Gli accessori degli altri umori non ci sono.
    for (const part of EXTRAS.filter((p) => !DISTINCTIVE[mood].includes(p))) {
      expect(el.querySelector(part), part).toBeNull()
    }
  })

  it('niente contorni né guance: la bolla è morbida', () => {
    renderGlu({ mood: 'idle', fill: 0.5 })
    expect(svg().querySelector('.glu-outline')).toBeNull()
    expect(svg().querySelector('.glu-cheek')).toBeNull()
  })

  it('occhiolino in «almost»: un occhio aperto e uno chiuso', () => {
    renderGlu({ mood: 'almost', fill: 0.85 })
    expect(svg().querySelectorAll('.glu-eye-open')).toHaveLength(1)
    expect(svg().querySelectorAll('.glu-eye-happy')).toHaveLength(1)
  })

  it('acqua tagliata sul corpo con un id unico', () => {
    const { container } = render(
      <LazyMotion features={domAnimation} strict>
        <Glu mood="idle" fill={0.5} />
        <Glu mood="idle" fill={0.5} />
      </LazyMotion>,
    )
    const clips = [...container.querySelectorAll('clipPath')]
    expect(clips).toHaveLength(2)
    expect(clips[0].id).toBeTruthy()
    expect(clips[0].id).not.toBe(clips[1].id)
    for (const clip of clips) expect(container.querySelector(`[clip-path="url(#${clip.id})"]`)).not.toBeNull()
  })

  it.each([
    [0, 186],
    [0.5, 101],
    [1, -10],
  ])('con fill=%s l’onda sta a y=%s', (fill, y) => {
    renderGlu({ mood: 'idle', fill })
    expect(waveY()).toBe(y)
  })

  it.each([
    [1.7, -10],
    [Number.NaN, 186],
    [-3, 186],
  ])('fill=%s viene limitato (y=%s)', (fill, y) => {
    renderGlu({ mood: 'idle', fill })
    expect(waveY()).toBe(y)
  })

  it('il livello dipende solo da fill, non dall’umore', () => {
    for (const mood of MOODS) {
      const { unmount } = renderGlu({ mood, fill: 0.5 })
      expect(waveY(), mood).toBe(101)
      unmount()
    }
  })

  it('due tocchi a 100 ms chiamano onTap una volta sola', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000)
    const onTap = vi.fn()
    renderGlu({ mood: 'idle', fill: 0.5, onTap })
    fireEvent.click(svg())
    now.mockReturnValue(10_100)
    fireEvent.click(svg())
    expect(onTap).toHaveBeenCalledTimes(1)
    now.mockReturnValue(11_200)
    fireEvent.click(svg())
    expect(onTap).toHaveBeenCalledTimes(2)
  })

  it('usa la dimensione richiesta', () => {
    renderGlu({ mood: 'idle', fill: 0.5, size: 96 })
    expect(svg()).toHaveAttribute('width', '96')
    expect(svg()).toHaveAttribute('height', '96')
  })

  it('con «Riduci movimento» non parte nessun timer', () => {
    reduceMotion()
    const timeout = vi.spyOn(window, 'setTimeout')
    const interval = vi.spyOn(window, 'setInterval')
    const { unmount } = renderGlu({ mood: 'hello', fill: 0.5 })
    expect(svg().querySelector('.glu-arm-waving')).not.toBeNull()
    expect(timeout.mock.calls.filter(([, ms]) => (ms ?? 0) >= 100)).toHaveLength(0)
    expect(interval).not.toHaveBeenCalled()
    unmount()
  })

  it('i timer si fermano allo smontaggio', () => {
    vi.useFakeTimers()
    const clear = vi.spyOn(window, 'clearTimeout')
    const clearInt = vi.spyOn(window, 'clearInterval')
    const { unmount } = renderGlu({ mood: 'hello', fill: 0.5 })
    act(() => vi.advanceTimersByTime(7000))
    unmount()
    expect(clear.mock.calls.length + clearInt.mock.calls.length).toBeGreaterThan(0)
  })
})

describe('Glu: extras delle reazioni', () => {
  it('senza extras Glu non cambia: niente accessori, corpo dritto, acqua orizzontale', () => {
    renderGlu({ mood: 'idle', fill: 0.5, extras: {} })
    expect(droopScale()).toBe(1)
    expect(waterRotation()).toBe(0)
    expect(svg().querySelector('.glu-body')?.getAttribute('style') ?? '').not.toContain('color-mix')
    expect(svg().querySelectorAll('.glu-eye-droopy')).toHaveLength(0)
  })

  it('sete 1: corpo afflosciato (scala Y ≤ 0,92) e colore diverso da --glu-body', () => {
    renderGlu({ mood: 'thirsty', fill: 0.3, extras: { thirst: 1 } })
    expect(droopScale()).toBeLessThanOrEqual(0.92)
    const style = svg().querySelector('.glu-body')?.getAttribute('style') ?? ''
    expect(style).toMatch(/fill: color-mix\(/)
  })

  it('sete a metà: afflosciato a metà, palpebre che scendono', () => {
    renderGlu({ mood: 'idle', fill: 0.3, extras: { thirst: 0.5 } })
    expect(droopScale()).toBeCloseTo(0.96, 2)
    expect(svg().querySelectorAll('.glu-eye-droopy')).toHaveLength(2)
  })

  it('sete fuori scala viene limitata', () => {
    renderGlu({ mood: 'idle', fill: 0.3, extras: { thirst: 4 } })
    expect(droopScale()).toBeCloseTo(0.92, 2)
  })

  it.each([
    [7, ['.glu-crown'], ['.glu-crown-gem', '.glu-cape']],
    [14, ['.glu-crown', '.glu-crown-gem'], ['.glu-cape']],
    [30, ['.glu-crown', '.glu-crown-gem', '.glu-cape'], []],
    [0, [], ['.glu-crown', '.glu-crown-gem', '.glu-cape']],
  ] as const)('corona %s', (crown, present, absent) => {
    renderGlu({ mood: 'idle', fill: 0.5, extras: { crown } })
    for (const part of present) expect(svg().querySelector(part), part).not.toBeNull()
    for (const part of absent) expect(svg().querySelector(part), part).toBeNull()
  })

  it('fascia, gocce e ventaglio', () => {
    renderGlu({ mood: 'thirsty', fill: 0.5, extras: { headband: true, sweat: true, fan: true } })
    expect(svg().querySelector('.glu-headband')).not.toBeNull()
    expect(svg().querySelector('.glu-sweat-drops')).not.toBeNull()
    expect(svg().querySelector('.glu-fan')).not.toBeNull()
  })

  it.each([
    [20, -20],
    [-20, 20],
    [40, -25],
    [-40, 25],
  ])('tilt %s ruota solo l’acqua di %s°', (tilt, deg) => {
    renderGlu({ mood: 'idle', fill: 0.5, extras: { tilt } })
    expect(waterRotation()).toBe(deg)
    // L'acqua ruota dentro la sagoma: il gruppo inclinato sta sotto il clip, il corpo no.
    const tilted = svg().querySelector('.glu-tilt')
    expect(tilted?.closest('[clip-path]')).not.toBeNull()
    expect(tilted?.querySelector('.glu-water')).not.toBeNull()
    expect(tilted?.querySelector('.glu-body')).toBeNull()
  })

  it('tremarella, sventolata e gocce si animano senza «Riduci movimento»', () => {
    renderGlu({ mood: 'workout', fill: 0.5, extras: { jitter: true, fan: true, sweat: true } })
    expect(svg().querySelector('.glu-jitter')).not.toBeNull()
    expect(svg().querySelector('.glu-fan-waving')).not.toBeNull()
    expect(svg().querySelector('.glu-sweat-drops-falling')).not.toBeNull()
  })

  it('con «Riduci movimento» nessuna animazione ripetuta, ma l’aspetto resta', () => {
    reduceMotion()
    renderGlu({ mood: 'workout', fill: 0.5, extras: { jitter: true, fan: true, sweat: true, crown: 30, crownDrop: true, thirst: 1 } })
    expect(svg().querySelector('.glu-jitter')).toBeNull()
    expect(svg().querySelector('.glu-fan-waving')).toBeNull()
    expect(svg().querySelector('.glu-sweat-drops-falling')).toBeNull()
    for (const part of ['.glu-fan', '.glu-sweat-drops', '.glu-crown', '.glu-cape']) {
      expect(svg().querySelector(part), part).not.toBeNull()
    }
    // La corona è già in testa, senza caduta.
    expect(svg().querySelector('.glu-crown-drop')).toBeNull()
    expect(droopScale()).toBeLessThanOrEqual(0.92)
  })

  it('la corona cade solo con crownDrop', () => {
    const { unmount } = renderGlu({ mood: 'idle', fill: 0.5, extras: { crown: 7, crownDrop: true } })
    expect(svg().querySelector('.glu-crown-drop')).not.toBeNull()
    unmount()
    renderGlu({ mood: 'idle', fill: 0.5, extras: { crown: 7 } })
    expect(svg().querySelector('.glu-crown-drop')).toBeNull()
  })
})
