import { describe, expect, it, vi } from 'vitest'
import { BufferGeometry, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import type { Camera, Scene } from 'three'
import { createGluScene, type RendererLike } from './scene'
import type { Pose } from './poses'

function fakeRenderer() {
  const r = {
    localClippingEnabled: false,
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn((_s: Scene, _c: Camera) => {}),
    dispose: vi.fn(),
    getContext: vi.fn(() => ({}) as WebGLRenderingContext),
  }
  return r as typeof r & RendererLike
}

const BASE: Pose = {
  scaleY: 1,
  jumpY: 0,
  shakeX: 0,
  lookY: 0,
  armL: 0,
  armR: 0,
  eyeOpen: 1,
  mouth: 'smile',
  bodyColor: '#CFEBFB',
  waterLevel: 0.5,
  waterTilt: 0,
  headband: false,
  sweat: false,
  crown: 0,
  crownDropY: 0,
  fan: false,
  zzz: false,
}

function make() {
  const r = fakeRenderer()
  const canvas = document.createElement('canvas')
  const s = createGluScene(canvas, { makeRenderer: () => r })
  const get = (n: string) => s.root.getObjectByName(n) as Mesh
  return { r, s, get }
}

describe('createGluScene', () => {
  it('contiene tutte le mesh con nome', () => {
    const { get } = make()
    for (const n of [
      'body', 'water', 'eyeL', 'eyeR', 'mouthSmile', 'mouthOpen', 'armL', 'armR', 'footL',
      'footR', 'tuft', 'shadow', 'headband', 'sweat', 'crown7', 'crown14', 'crown30', 'fan', 'zzz',
    ]) {
      expect(get(n), n).toBeTruthy()
    }
  })

  it('espone il contesto GL e abilita il clipping locale', () => {
    const { r, s } = make()
    expect(s.gl).not.toBeNull()
    expect(r.localClippingEnabled).toBe(true)
  })

  it('gl e null se il renderer non ha il contesto', () => {
    const r = fakeRenderer()
    r.getContext.mockImplementation(() => {
      throw new Error('no')
    })
    const s = createGluScene(document.createElement('canvas'), { makeRenderer: () => r })
    expect(s.gl).toBeNull()
  })

  it('applyPose: braccio, accessori, bocca', () => {
    const { s, get } = make()
    s.applyPose({ ...BASE, armR: Math.PI, headband: false, crown: 14, mouth: 'open' })
    expect(get('armR').rotation.z).toBeCloseTo(-Math.PI)
    expect(get('headband').visible).toBe(false)
    expect(get('crown14').visible).toBe(true)
    expect(get('crown7').visible).toBe(false)
    expect(get('crown30').visible).toBe(false)
    expect(get('mouthOpen').visible).toBe(true)
    expect(get('mouthSmile').visible).toBe(false)
    s.applyPose({ ...BASE, headband: true, sweat: true, fan: true, zzz: true, mouth: 'small' })
    expect(get('headband').visible).toBe(true)
    expect(get('sweat').visible).toBe(true)
    expect(get('fan').visible).toBe(true)
    expect(get('zzz').visible).toBe(true)
    expect(get('mouthSmile').visible).toBe(true)
  })

  it('applyPose: il livello dell acqua sposta il piano di clipping', () => {
    const { s, get } = make()
    const plane = () => (get('water').material as MeshPhysicalMaterial).clippingPlanes![0]
    s.applyPose({ ...BASE, waterLevel: 0 })
    const c0 = plane().constant
    s.applyPose({ ...BASE, waterLevel: 0.5 })
    expect(plane().constant).not.toBe(c0)
  })

  it('applyPose: colore del corpo', () => {
    const { s, get } = make()
    s.applyPose({ ...BASE, bodyColor: '#9DB4C4' })
    expect((get('body').material as MeshPhysicalMaterial).color.getHexString()).toBe('9db4c4')
  })

  it('setTheme cambia il colore senza ricreare le mesh', () => {
    const { s, get } = make()
    const eye = get('eyeL')
    const ink = () => ((eye.children[0] as Mesh).material as MeshStandardMaterial).color.getHexString()
    expect(ink()).toBe('0b2545')
    s.setTheme(true)
    expect(get('eyeL')).toBe(eye)
    expect(ink()).toBe('071a33')
    s.setTheme(false)
    expect(ink()).toBe('0b2545')
  })

  it('resize limita il pixel ratio a 2', () => {
    const { r, s } = make()
    s.resize(186, 3)
    expect(r.setPixelRatio).toHaveBeenCalledWith(2)
    expect(r.setSize.mock.calls[0].slice(0, 2)).toEqual([186, 186])
  })

  it('render inoltra al renderer', () => {
    const { r, s } = make()
    s.render()
    expect(r.render).toHaveBeenCalledTimes(1)
  })

  it('dispose libera renderer, geometrie e materiali', () => {
    const spy = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const { r, s } = make()
    s.dispose()
    expect(r.dispose).toHaveBeenCalled()
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(10)
    spy.mockRestore()
  })
})
