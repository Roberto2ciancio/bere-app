import { afterEach, describe, expect, it, vi } from 'vitest'
import { probe } from './probe'
import type { GluScene } from './scene'

function fakeScene(opts: { renderer?: string; renderMs?: number; noGl?: boolean }) {
  const dispose = vi.fn()
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
      now += opts.renderMs ?? 1
    },
    dispose,
  } as unknown as GluScene
  return { scene, dispose }
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
})

