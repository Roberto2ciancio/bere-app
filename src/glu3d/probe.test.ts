import { afterEach, describe, expect, it, vi } from 'vitest'
import { probe } from './probe'
import type { GluScene } from './scene'

function fakeScene(opts: { renderer?: string; renderMs?: number; firstMs?: number; noGl?: boolean }) {
  const dispose = vi.fn()
  const releaseContext = vi.fn()
  let calls = 0
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const gl = {
    getExtension: () => (opts.renderer ? { UNMASKED_RENDERER_WEBGL: 1 } : null),
    getParameter: () => opts.renderer,
    finish: () => {},
  }
  const scene = {
    gl: opts.noGl ? null : gl,
    render: () => {
      now += calls++ === 0 && opts.firstMs !== undefined ? opts.firstMs : (opts.renderMs ?? 1)
    },
    dispose,
    releaseContext,
  } as unknown as GluScene
  return { scene, dispose, releaseContext }
}

describe('probe', () => {
  afterEach(() => vi.restoreAllMocks())

  it('fabbrica null -> nowebgl', async () => {
    expect(await probe(() => null)).toBe('nowebgl')
  })
  it('fabbrica che lancia -> nowebgl', async () => {
    expect(
      await probe(() => {
        throw new Error('no')
      }),
    ).toBe('nowebgl')
  })
  it('gl assente -> nowebgl e dispose', async () => {
    const { scene, dispose } = fakeScene({ noGl: true })
    expect(await probe(() => scene)).toBe('nowebgl')
    expect(dispose).toHaveBeenCalled()
  })
  it('SwiftShader -> slow', async () => {
    const { scene, dispose } = fakeScene({ renderer: 'Google SwiftShader' })
    expect(await probe(() => scene)).toBe('slow')
    expect(dispose).toHaveBeenCalled()
  })
  it('render da 60 ms -> slow', async () => {
    const { scene } = fakeScene({ renderMs: 60 })
    expect(await probe(() => scene)).toBe('slow')
  })
  it('render veloce -> ok', async () => {
    const { scene, dispose } = fakeScene({ renderMs: 5 })
    expect(await probe(() => scene)).toBe('ok')
    expect(dispose).toHaveBeenCalled()
  })
  it('il primo fotogramma (compilazione shader) non conta', async () => {
    const { scene } = fakeScene({ firstMs: 500, renderMs: 10 })
    expect(await probe(() => scene)).toBe('ok')
  })
  it('dopo la prova libera il contesto WebGL', async () => {
    const { scene, releaseContext, dispose } = fakeScene({ renderMs: 5 })
    await probe(() => scene)
    expect(releaseContext).toHaveBeenCalledTimes(1)
    expect(dispose).toHaveBeenCalled()
    const slow = fakeScene({ renderer: 'SwiftShader' })
    await probe(() => slow.scene)
    expect(slow.releaseContext).toHaveBeenCalledTimes(1)
  })
})

