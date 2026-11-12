import { useEffect, useLayoutEffect, useRef } from 'react'
import type { GluMood } from '../mascot/mood'
import type { GluExtras } from '../mascot/Glu'
import { prefersReducedMotion } from '../ui/motion/effects'
import { getRuntime } from './capability'
import type { GluScene } from './scene'

export const FRAME_MS = 33 // 30 fps al massimo
export const FILL_MS = 600
export const CONTEXT_RESTORE_MS = 2000
export const WALK_CYCLES_PER_S = 0.5 // cicli di fase al secondo: la fase fa 2 periodi di seno per ciclo (un piede alzato ciascuno), quindi ~2 passi/s

const NO_EXTRAS: GluExtras = {}

interface Props {
  mood: GluMood
  fill: number
  size?: number
  extras?: GluExtras
  calm?: boolean
  /** Glu cammina nel verso `dir`; null/assente: fermo. */
  walk?: { dir: -1 | 0 | 1 } | null
  onFail: (error: unknown) => void
}

export function Glu3D({ mood, fill, size = 220, extras = NO_EXTRAS, calm = false, walk = null, onFail }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const props = useRef({ mood, fill, extras, calm, walk })
  const onFailRef = useRef(onFail)
  const sizeRef = useRef(size)
  // Stato del ciclo: tempi in ms dell'orologio di requestAnimationFrame.
  const st = useRef({
    moodStart: null as number | null,
    fillFrom: fill,
    fillTo: fill,
    fillStart: null as number | null,
    drawn: null as { mood: GluMood; fill: number; extras: GluExtras } | null,
    walkPhase: 0,
    walkLast: null as number | null,
    draw: null as null | (() => void),
    resize: null as null | ((cssPx: number) => void),
  })

  useLayoutEffect(() => {
    props.current = { mood, fill, extras, calm, walk }
    onFailRef.current = onFail
    sizeRef.current = size
  })

  // Cambio di umore: moodT riparte da 0 al prossimo fotogramma.
  useEffect(() => {
    st.current.moodStart = null
  }, [mood])

  // Cambio di livello: interpolazione di 0,6 s a partire dal valore corrente.
  useEffect(() => {
    const s = st.current
    if (s.fillTo === fill) return
    const now = s.drawn ? s.drawn.fill : s.fillTo
    s.fillFrom = now
    s.fillTo = fill
    s.fillStart = null
  }, [fill])

  // Con movimento ridotto si ridisegna solo quando cambia qualcosa.
  useEffect(() => {
    if (prefersReducedMotion()) st.current.draw?.()
  }, [mood, fill, extras, calm, walk])

  useEffect(() => {
    st.current.resize?.(size)
    if (prefersReducedMotion()) st.current.draw?.()
  }, [size])

  useEffect(() => {
    const canvas = canvasRef.current
    const rt = getRuntime()
    if (!canvas || !rt) {
      onFailRef.current(new Error('glu3d: runtime non disponibile'))
      return
    }
    let failed = false
    let stopped = false
    let raf = 0
    // Qualsiasi eccezione della scena: ciclo fermo e ritorno al 2D (una volta sola).
    const fail = (e: unknown) => {
      if (failed) return
      failed = true
      stopped = true
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      onFailRef.current(e)
    }

    let scene: GluScene
    try {
      scene = rt.createGluScene(canvas)
    } catch (e) {
      fail(e)
      return
    }
    const s = st.current
    const still = prefersReducedMotion()

    const dark = window.matchMedia?.('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      try {
        scene.setTheme(!!dark?.matches)
      } catch (e) {
        fail(e)
      }
    }
    try {
      scene.setTheme(!!dark?.matches)
      scene.resize(sizeRef.current, window.devicePixelRatio)
    } catch (e) {
      fail(e)
      try {
        scene.dispose()
      } catch {
        /* già guasta */
      }
      return
    }
    dark?.addEventListener?.('change', applyTheme)

    const drawUnsafe = (now: number) => {
      const p = props.current
      let f = p.fill
      if (!still) {
        if (s.moodStart === null) s.moodStart = now
        if (s.fillStart === null) s.fillStart = now
        const k = Math.min(1, (now - s.fillStart) / FILL_MS)
        f = s.fillFrom + (s.fillTo - s.fillFrom) * k
      }
      let walkInput: { phase: number; dir: -1 | 0 | 1 } | undefined
      if (p.walk) {
        if (!still && s.walkLast !== null) s.walkPhase += ((now - s.walkLast) / 1000) * WALK_CYCLES_PER_S
        s.walkLast = now
        walkInput = { phase: s.walkPhase, dir: p.walk.dir }
      } else {
        s.walkPhase = 0
        s.walkLast = null
      }
      const pose = rt.poseFor({
        mood: p.mood,
        extras: p.extras,
        fill: f,
        t: still ? 0 : now / 1000,
        moodT: still ? 0 : (now - s.moodStart!) / 1000,
        calm: p.calm,
        still,
        ...(walkInput ? { walk: walkInput } : {}),
      })
      scene.applyPose(pose)
      scene.render()
      s.drawn = { mood: p.mood, fill: f, extras: p.extras }
    }
    const draw = (now = 0) => {
      if (failed) return
      try {
        drawUnsafe(now)
      } catch (e) {
        fail(e)
      }
    }
    s.draw = () => draw(0)
    s.resize = (cssPx: number) => {
      if (failed) return
      try {
        scene.resize(cssPx, window.devicePixelRatio)
      } catch (e) {
        fail(e)
      }
    }

    // Contesto WebGL perso: 2 s senza ripristino e si torna al 2D.
    let lostTimer: ReturnType<typeof setTimeout> | undefined
    const onLost = (ev: Event) => {
      ev.preventDefault()
      clearTimeout(lostTimer)
      lostTimer = setTimeout(
        () => onFailRef.current(new Error('glu3d: contesto WebGL perso')),
        CONTEXT_RESTORE_MS,
      )
    }
    const onRestored = () => {
      clearTimeout(lostTimer)
      // Da fermo nessun ciclo ridisegna: un disegno dopo il ripristino.
      if (still) draw(0)
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)

    let last = -Infinity
    let intersecting = true
    let io: IntersectionObserver | undefined

    const frame = (now: number) => {
      raf = 0
      if (stopped) return
      if (now - last >= FRAME_MS) {
        last = now
        draw(now)
        if (stopped) return
      }
      raf = requestAnimationFrame(frame)
    }
    const visible = () => intersecting && document.visibilityState !== 'hidden'
    const sync = () => {
      if (still || stopped) return
      if (visible()) {
        if (!raf) raf = requestAnimationFrame(frame)
      } else if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }

    if (still) {
      draw(0)
    } else {
      if (typeof IntersectionObserver !== 'undefined') {
        io = new IntersectionObserver((entries) => {
          const e = entries[entries.length - 1]
          if (e) intersecting = e.isIntersecting
          sync()
        })
        io.observe(canvas)
      }
      document.addEventListener('visibilitychange', sync)
      sync()
    }

    return () => {
      stopped = true
      if (raf) cancelAnimationFrame(raf)
      io?.disconnect()
      document.removeEventListener('visibilitychange', sync)
      dark?.removeEventListener?.('change', applyTheme)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      clearTimeout(lostTimer)
      s.draw = null
      s.resize = null
      scene.dispose()
    }
  }, [])

  return (
    <div data-testid="glu-3d" className="glu-3d" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}

