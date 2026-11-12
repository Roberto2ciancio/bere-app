import { createGluScene } from './scene'
import type { GluScene } from './scene'

export type CheckResult = 'ok' | 'slow' | 'nowebgl'

export const PROBE_FRAMES = 10
export const SLOW_FRAME_MS = 50
const PROBE_SIZE = 186

function defaultMake(): GluScene | null {
  const canvas = document.createElement('canvas')
  canvas.width = PROBE_SIZE
  canvas.height = PROBE_SIZE
  return createGluScene(canvas)
}

/** Prova del telefono: una scena fuori schermo, misurata su qualche fotogramma. */
export async function probe(make: () => GluScene | null = defaultMake): Promise<CheckResult> {
  let scene: GluScene | null = null
  try {
    scene = make()
  } catch {
    return 'nowebgl'
  }
  if (!scene) return 'nowebgl'
  try {
    const gl = scene.gl
    if (!gl) return 'nowebgl'
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    if (info) {
      const renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      if (/swiftshader|llvmpipe/i.test(renderer)) return 'slow'
    }
    const t0 = performance.now()
    for (let i = 0; i < PROBE_FRAMES; i++) scene.render()
    gl.finish()
    const avg = (performance.now() - t0) / PROBE_FRAMES
    return avg > SLOW_FRAME_MS ? 'slow' : 'ok'
  } catch {
    return 'nowebgl'
  } finally {
    scene.dispose()
  }
}
