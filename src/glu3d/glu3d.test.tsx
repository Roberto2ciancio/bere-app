import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  runtime: null as unknown,
  reduced: false,
}))
vi.mock('./capability', () => ({ getRuntime: () => h.runtime }))
vi.mock('../ui/motion/effects', () => ({ prefersReducedMotion: () => h.reduced }))

import { Glu3D } from './Glu3D'

let cbs = new Map<number, FrameRequestCallback>()
let nextId = 1
let ioCb: IntersectionObserverCallback | null = null
let scene: ReturnType<typeof makeScene>
let poseFor: ReturnType<typeof vi.fn>
let createGluScene: ReturnType<typeof vi.fn>

function makeScene() {
  return {
    applyPose: vi.fn(),
    render: vi.fn(),
    resize: vi.fn(),
    setTheme: vi.fn(),
    dispose: vi.fn(),
  }
}

function tick(ms: number) {
  const list = [...cbs.entries()]
  cbs = new Map()
  act(() => list.forEach(([, cb]) => cb(ms)))
}

function setVisibility(v: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

const lastPose = () => poseFor.mock.calls[poseFor.mock.calls.length - 1][0]

describe('Glu3D', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    h.reduced = false
    cbs = new Map()
    nextId = 1
    ioCb = null
    scene = makeScene()
    poseFor = vi.fn(() => ({ waterLevel: 0 }))
    createGluScene = vi.fn(() => scene)
    h.runtime = { createGluScene, poseFor }
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextId++
      cbs.set(id, cb)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => cbs.delete(id))
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          ioCb = cb
        }
        observe() {}
        disconnect() {}
      },
    )
    setVisibility('visible')
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const mount = (p: Partial<React.ComponentProps<typeof Glu3D>> = {}) =>
    render(<Glu3D mood="idle" fill={0.5} onFail={() => {}} {...p} />)

  it('disegna al fotogramma e limita a 30 fps', () => {
    mount()
    tick(1000)
    expect(scene.applyPose).toHaveBeenCalledTimes(1)
    expect(scene.render).toHaveBeenCalledTimes(1)
    tick(1010)
    expect(scene.render).toHaveBeenCalledTimes(1)
    tick(1040)
    expect(scene.render).toHaveBeenCalledTimes(2)
  })

  it('non disegna se non visibile e riprende al ritorno', () => {
    mount()
    act(() => ioCb!([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(cbs.size).toBe(0)
    act(() => ioCb!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
    tick(1000)
    expect(scene.render).toHaveBeenCalledTimes(1)
    setVisibility('hidden')
    expect(cbs.size).toBe(0)
    setVisibility('visible')
    tick(2000)
    expect(scene.render).toHaveBeenCalledTimes(2)
  })

  it('con movimento ridotto non usa requestAnimationFrame e ridisegna al cambio', () => {
    h.reduced = true
    const { rerender } = mount()
    expect(cbs.size).toBe(0)
    expect(scene.render).toHaveBeenCalledTimes(1)
    rerender(<Glu3D mood="goal" fill={0.5} onFail={() => {}} />)
    expect(scene.render).toHaveBeenCalledTimes(2)
    rerender(<Glu3D mood="goal" fill={0.7} onFail={() => {}} />)
    expect(scene.render).toHaveBeenCalledTimes(3)
    rerender(<Glu3D mood="goal" fill={0.7} extras={{ sweat: true }} onFail={() => {}} />)
    expect(scene.render).toHaveBeenCalledTimes(4)
    expect(cbs.size).toBe(0)
    expect(lastPose().still).toBe(true)
  })

  it('al cambio di umore moodT riparte da zero', () => {
    const { rerender } = mount()
    tick(1000)
    tick(5000)
    expect(lastPose().moodT).toBeCloseTo(4)
    rerender(<Glu3D mood="goal" fill={0.5} onFail={() => {}} />)
    tick(6000)
    expect(lastPose().moodT).toBeCloseTo(0)
    tick(6500)
    expect(lastPose().moodT).toBeCloseTo(0.5)
  })

  it('interpola il livello in 0,6 s', () => {
    const { rerender } = mount({ fill: 0.3 })
    tick(1000)
    expect(lastPose().fill).toBeCloseTo(0.3)
    rerender(<Glu3D mood="idle" fill={0.6} onFail={() => {}} />)
    tick(2000)
    expect(lastPose().fill).toBeCloseTo(0.3)
    tick(2300)
    expect(lastPose().fill).toBeCloseTo(0.45)
    tick(2700)
    expect(lastPose().fill).toBeCloseTo(0.6)
  })

  it('createGluScene che lancia chiama onFail', () => {
    const err = new Error('boom')
    createGluScene.mockImplementation(() => {
      throw err
    })
    const onFail = vi.fn()
    mount({ onFail })
    expect(onFail).toHaveBeenCalledWith(err)
  })

  it('senza runtime chiama onFail', () => {
    h.runtime = null
    const onFail = vi.fn()
    mount({ onFail })
    expect(onFail).toHaveBeenCalledTimes(1)
  })

  it('contesto perso senza ripristino entro 2 s: onFail', () => {
    const onFail = vi.fn()
    const { container } = mount({ onFail })
    const canvas = container.querySelector('canvas')!
    const ev = new Event('webglcontextlost', { cancelable: true })
    act(() => {
      canvas.dispatchEvent(ev)
    })
    expect(ev.defaultPrevented).toBe(true)
    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(onFail).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(onFail).toHaveBeenCalledTimes(1)
  })

  it('contesto ripristinato in tempo: nessun onFail', () => {
    const onFail = vi.fn()
    const { container } = mount({ onFail })
    const canvas = container.querySelector('canvas')!
    act(() => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
      vi.advanceTimersByTime(1000)
      canvas.dispatchEvent(new Event('webglcontextrestored'))
      vi.advanceTimersByTime(5000)
    })
    expect(onFail).not.toHaveBeenCalled()
  })

  it('smontaggio: dispose e ciclo fermo', () => {
    const { unmount } = mount()
    tick(1000)
    unmount()
    expect(scene.dispose).toHaveBeenCalledTimes(1)
    expect(cbs.size).toBe(0)
  })

  it('eccezione in un fotogramma: onFail una volta e ciclo fermo', () => {
    const onFail = vi.fn()
    mount({ onFail })
    tick(1000)
    const err = new Error('pose')
    scene.applyPose.mockImplementation(() => {
      throw err
    })
    expect(() => tick(1040)).not.toThrow()
    expect(onFail).toHaveBeenCalledTimes(1)
    expect(onFail).toHaveBeenCalledWith(err)
    expect(cbs.size).toBe(0)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(cbs.size).toBe(0)
    expect(onFail).toHaveBeenCalledTimes(1)
  })

  it('movimento ridotto con render che lancia: onFail, nessuna eccezione esce', () => {
    h.reduced = true
    scene.render.mockImplementation(() => {
      throw new Error('render')
    })
    const onFail = vi.fn()
    let r: ReturnType<typeof mount> | undefined
    expect(() => {
      r = mount({ onFail })
    }).not.toThrow()
    expect(onFail).toHaveBeenCalledTimes(1)
    expect(() => r!.rerender(<Glu3D mood="goal" fill={0.5} onFail={onFail} />)).not.toThrow()
    expect(onFail).toHaveBeenCalledTimes(1)
  })

  it('resize o setTheme che lanciano al montaggio: onFail', () => {
    scene.resize.mockImplementation(() => {
      throw new Error('resize')
    })
    const onFail = vi.fn()
    expect(() => mount({ onFail })).not.toThrow()
    expect(onFail).toHaveBeenCalledTimes(1)
    expect(cbs.size).toBe(0)
    expect(scene.dispose).toHaveBeenCalled()
  })

  it('movimento ridotto: ridisegna dopo il ripristino del contesto', () => {
    h.reduced = true
    const { container } = mount()
    expect(scene.render).toHaveBeenCalledTimes(1)
    const canvas = container.querySelector('canvas')!
    act(() => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
      canvas.dispatchEvent(new Event('webglcontextrestored'))
    })
    expect(scene.render).toHaveBeenCalledTimes(2)
  })

  it('imposta tema e dimensione al montaggio', () => {
    mount({ size: 180 })
    expect(scene.setTheme).toHaveBeenCalled()
    expect(scene.resize).toHaveBeenCalledWith(180, window.devicePixelRatio)
  })
})

