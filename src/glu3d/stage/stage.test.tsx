import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  reduced: false,
  props: [] as Array<Record<string, unknown>>,
  reportError: vi.fn(),
}))
vi.mock('../Glu3D', () => ({
  Glu3D: (p: Record<string, unknown>) => {
    h.props.push(p)
    return <div data-testid="glu-3d" />
  },
}))
vi.mock('../../ui/motion/effects', () => ({ prefersReducedMotion: () => h.reduced }))
vi.mock('../../lib/errorReporting', () => ({ reportError: h.reportError }))

import { GluStage } from './GluStage'
import { GluStageProvider, useGluSpot, useGluStageActive, useGluStageShowsGlu, useRingSlot } from './stageContext'
import type { GluSpotSpec } from './stageContext'

const W = 390
const H = 800
const TABS_TOP = 740

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

function Page({ spec }: { spec: GluSpotSpec | null }) {
  useGluSpot(spec)
  return null
}

function RingPage({ spec }: { spec: GluSpotSpec }) {
  useGluSpot(spec)
  const ref = useRingSlot()
  return (
    <div
      data-testid="ring"
      ref={(el) => {
        if (el) el.getBoundingClientRect = () => rect(100, 200, 186, 186)
        ref(el)
      }}
    />
  )
}

function Probe() {
  const active = useGluStageActive()
  const shows = useGluStageShowsGlu()
  return <div data-testid="probe" data-active={String(active)} data-shows={String(shows)} />
}

function Tabs() {
  return (
    <nav
      className="tabs"
      ref={(el) => {
        if (el) el.getBoundingClientRect = () => rect(0, TABS_TOP, W, H - TABS_TOP)
      }}
    />
  )
}

function App({ children }: { children?: React.ReactNode }) {
  return (
    <GluStageProvider active>
      {children}
      <Probe />
      <GluStage />
      <Tabs />
    </GluStageProvider>
  )
}

function box() {
  const t = screen.getByTestId('glu-stage-box').style.transform
  const mt = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(t)
  if (!mt) throw new Error('transform inatteso: ' + t)
  return { x: Number(mt[1]), y: Number(mt[2]), s: Number(mt[3]) }
}

const lastProps = () => h.props[h.props.length - 1]
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

const corner: GluSpotSpec = { spot: 'corner', mood: 'idle', text: 'Ciao' }

describe('GluStage', () => {
  beforeEach(() => {
    vi.useFakeTimers() // finge anche requestAnimationFrame (fotogrammi da 16 ms)
    h.reduced = false
    h.props = []
    h.reportError.mockReset()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: W })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: H })
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("nell'angolo: in basso a destra sopra la barra, fumetto per 2 s", () => {
    render(<App><Page spec={corner} /></App>)
    expect(box()).toEqual({ x: W - 12 - 72, y: TABS_TOP - 8 - 72, s: 72 / 186 })
    const bubble = screen.getByTestId('glu-stage-bubble')
    expect(bubble.getAttribute('aria-live')).toBe('polite')
    expect(bubble.textContent).toBe('Ciao')
    advance(1900)
    expect(bubble.textContent).toBe('Ciao')
    advance(200)
    expect(bubble.textContent).toBe('')
    expect(screen.getByTestId('probe').dataset.shows).toBe('true')
  })

  it('fumetto di nuovo al cambio di frase nell\'angolo', () => {
    const r = render(<App><Page spec={corner} /></App>)
    advance(2100)
    r.rerender(<App><Page spec={{ ...corner, text: 'Altro' }} /></App>)
    expect(screen.getByTestId('glu-stage-bubble').textContent).toBe('Altro')
  })

  it("dall'anello all'angolo: vola in 600 ms, fumetto e saltello all'arrivo", () => {
    const r = render(<App><RingPage key="home" spec={{ spot: 'ring', mood: 'idle' }} /></App>)
    r.rerender(<App><Page key="storico" spec={corner} /></App>)
    advance(300)
    const mid = box()
    expect(mid.x).toBeGreaterThan(100)
    expect(mid.x).toBeLessThan(W - 84)
    expect(screen.getByTestId('glu-stage-bubble').textContent).toBe('')
    advance(350)
    expect(box()).toEqual({ x: W - 84, y: TABS_TOP - 80, s: 72 / 186 })
    expect(screen.getByTestId('glu-stage-bubble').textContent).toBe('Ciao')
    expect(document.querySelector('.glu-stage-hop.is-hopping')).not.toBeNull()
  })

  it("da scheda a scheda: resta nell'angolo, saltello e fumetto nuovo", () => {
    const r = render(<App><Page key="storico" spec={corner} /></App>)
    advance(4100)
    r.rerender(<App><Page key="profilo" spec={{ ...corner, text: 'Profilo' }} /></App>)
    expect(box().x).toBe(W - 84)
    expect(screen.getByTestId('glu-stage-bubble').textContent).toBe('Profilo')
    expect(document.querySelector('.glu-stage-hop.is-hopping')).not.toBeNull()
  })

  it('nessuna pagina che dichiara: fuori scena', () => {
    render(<App />)
    expect(box().x).toBeGreaterThan(W)
    expect(screen.getByTestId('probe').dataset.shows).toBe('false')
    expect(screen.getByTestId('probe').dataset.active).toBe('true')
    expect(screen.getByTestId('glu-3d')).toBeTruthy()
  })

  it("nell'anello: sul rettangolo prenotato, scala 1", () => {
    render(<App><RingPage spec={{ spot: 'ring', mood: 'idle', fill: 0.4 }} /></App>)
    expect(box()).toEqual({ x: 100, y: 200, s: 1 })
    expect(lastProps().size).toBe(186)
    expect(lastProps().fill).toBe(0.4)
    expect(screen.getByTestId('glu-stage-bubble').textContent).toBe('')
  })

  it('passeggiata dopo 20 s (random 0) verso sinistra', () => {
    render(<App><Page spec={corner} /></App>)
    advance(19900)
    expect(lastProps().walk ?? null).toBeNull()
    advance(200)
    expect(lastProps().walk).toEqual({ dir: -1 })
    expect(box().x).toBeLessThan(W - 84)
    advance(1500)
    expect(box().x).toBeLessThan(W - 84 - 50)
  })

  it('nessuna passeggiata con riduci movimento', () => {
    h.reduced = true
    render(<App><Page spec={corner} /></App>)
    advance(60000)
    expect(h.props.some((p) => p.walk)).toBe(false)
    expect(box().x).toBe(W - 84)
  })

  it('nessuna passeggiata con Glu tranquillo', () => {
    render(<App><Page spec={{ ...corner, calm: true }} /></App>)
    advance(60000)
    expect(h.props.some((p) => p.walk)).toBe(false)
    expect(lastProps().calm).toBe(true)
  })

  it('cambio di posto a metà passeggiata: si parte dalla x corrente', () => {
    const r = render(<App><Page spec={corner} /></App>)
    advance(20000 + 1250)
    const mid = box().x
    expect(mid).toBeLessThan(W - 84 - 50)
    expect(mid).toBeGreaterThan(16)
    r.rerender(<App><Page spec={null} /></App>)
    advance(40)
    expect(lastProps().walk).toEqual({ dir: 1 })
    const x = box().x
    expect(x).toBeGreaterThanOrEqual(mid)
    expect(x).toBeLessThan(W - 84)
    advance(1000)
    expect(box().x).toBeGreaterThan(W)
    expect(lastProps().walk ?? null).toBeNull()
    expect(screen.getByTestId('probe').dataset.shows).toBe('false')
  })

  it("cambio scheda a metà volo: prosegue dalla posizione corrente, senza scatti", () => {
    const r = render(<App><RingPage key="home" spec={{ spot: 'ring', mood: 'idle' }} /></App>)
    r.rerender(<App><Page key="storico" spec={corner} /></App>)
    advance(300)
    let prev = box()
    r.rerender(<App><Page key="classifica" spec={{ ...corner, text: 'Classifica' }} /></App>)
    for (let i = 0; i < 50; i++) {
      advance(16)
      const cur = box()
      expect(Math.hypot(cur.x - prev.x, cur.y - prev.y)).toBeLessThan(40)
      prev = cur
    }
    expect(box()).toEqual({ x: W - 84, y: TABS_TOP - 80, s: 72 / 186 })
    expect(screen.getByTestId('glu-stage-bubble').textContent).toBe('Classifica')
  })

  it("resize: l'angolo si ricalcola", () => {
    render(<App><Page spec={corner} /></App>)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(box().x).toBe(500 - 84)
  })

  it('onFail: una segnalazione, palcoscenico spento e smontato', () => {
    render(<App><Page spec={corner} /></App>)
    const onFail = lastProps().onFail as (e: unknown) => void
    const err = new Error('rotto')
    act(() => {
      onFail(err)
      onFail(err)
    })
    expect(h.reportError).toHaveBeenCalledTimes(1)
    expect(h.reportError).toHaveBeenCalledWith('react', err)
    expect(screen.getByTestId('probe').dataset.active).toBe('false')
    expect(screen.getByTestId('probe').dataset.shows).toBe('false')
    expect(screen.queryByTestId('glu-stage')).toBeNull()
  })
})
