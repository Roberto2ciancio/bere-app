import { m } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useOptionalAuth } from '../../auth/AuthProvider'
import { reportError } from '../../lib/errorReporting'
import { isGluCalm } from '../../mascot/calm'
import { prefersReducedMotion } from '../../ui/motion/effects'
import { Glu3D } from '../Glu3D'
import { travelFor } from './motion'
import type { GluSpot } from './motion'
import { nextWalkDelay, walkTimeline, WALK_LEG_MS } from './walks'
import { useStageInternals } from './stageContext'

export const STAGE_BASE_PX = 186 // lato del riquadro se non c'è un anello da misurare
export const CORNER_PX = 72
export const CORNER_RIGHT_PX = 12
export const CORNER_ABOVE_TABS_PX = 8
export const AWAY_GAP_PX = 24 // quanto oltre il bordo destro sta Glu fuori scena
export const WALK_EDGE_PX = 16 // la passeggiata arriva a 16 px dal bordo sinistro
export const BUBBLE_MS = 4000
export const HOP_MS = 450
export const RETARGET_MS = 400 // nuovo traguardo a metà viaggio

interface Pos {
  x: number
  y: number
  s: number
  o: number
}

type Dir = -1 | 0 | 1

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2)

/** Il palcoscenico: da montare dentro GluStageProvider, accanto alle pagine. */
export function GluStage() {
  const ctx = useStageInternals()
  if (!ctx || !ctx.active) return null
  return <Stage />
}

function Stage() {
  const ctx = useStageInternals()!
  const { spec, specId, ringEl, fail } = ctx
  const spot: GluSpot = spec?.spot ?? 'away'
  const auth = useOptionalAuth()
  const userId = auth?.user?.id
  const calm = spec?.calm ?? (!!userId && isGluCalm(userId))
  const [still] = useState(() => prefersReducedMotion())

  // In 'away' Glu resta com'era: umore e livello dell'ultima pagina che l'ha mostrato.
  const [shownSpec, setShownSpec] = useState(spec)
  if (spec && spec !== shownSpec) setShownSpec(spec)

  const [base, setBase] = useState(STAGE_BASE_PX)
  const baseRef = useRef(base)
  const [pos, setPosState] = useState<Pos>({ x: 0, y: 0, s: 1, o: 1 })
  const posRef = useRef(pos)
  const [walkDir, setWalkDir] = useState<Dir | null>(null)
  const [bubble, setBubble] = useState<string | null>(null)
  const [hopping, setHopping] = useState(false)

  // Stato vivo per i callback del ciclo (rAF e timer).
  const live = useRef({ spot, ringEl, calm, text: spec?.text })
  useLayoutEffect(() => {
    live.current = { spot, ringEl, calm, text: spec?.text }
  })

  const anim = useRef({ raf: 0, mode: 'idle' as 'idle' | 'travel' | 'walk' })
  const timers = useRef({ walk: 0 as ReturnType<typeof setTimeout> | 0, bubble: 0 as ReturnType<typeof setTimeout> | 0, hop: 0 as ReturnType<typeof setTimeout> | 0 })
  const shown = useRef(false) // già comparso in un posto visibile in questa visita
  const prevSpot = useRef<GluSpot | null>(null)
  const prevText = useRef<string | undefined>(undefined)
  const failed = useRef(false)

  const setPos = useCallback((p: Pos) => {
    posRef.current = p
    setPosState(p)
  }, [])

  const measure = useCallback((target: GluSpot): Pos => {
    const w = window.innerWidth
    const h = window.innerHeight
    const ring = live.current.ringEl
    if (target === 'ring' && ring) {
      const r = ring.getBoundingClientRect()
      if (r.width > 0 && r.width !== baseRef.current) {
        baseRef.current = r.width
        setBase(r.width)
      }
      return { x: r.left, y: r.top, s: r.width / baseRef.current, o: 1 }
    }
    const tabs = document.querySelector('.tabs')
    const top = tabs ? tabs.getBoundingClientRect().top : h
    const y = top - CORNER_ABOVE_TABS_PX - CORNER_PX
    const s = CORNER_PX / baseRef.current
    const corner = { x: w - CORNER_RIGHT_PX - CORNER_PX, y, s, o: 1 }
    // 'ring' senza anello prenotato: fuori scena come 'away'.
    if (target === 'corner') return corner
    return { ...corner, x: w + AWAY_GAP_PX }
  }, [])

  const stopAnim = useCallback(() => {
    if (anim.current.raf) cancelAnimationFrame(anim.current.raf)
    anim.current = { raf: 0, mode: 'idle' }
  }, [])

  /** Ciclo a fotogrammi: frame(t) riceve i ms dal primo fotogramma e torna true quando ha finito. */
  const loop = useCallback((mode: 'travel' | 'walk', frame: (t: number) => boolean, done: () => void) => {
    stopAnim()
    let start: number | null = null
    const step = (now: number) => {
      anim.current.raf = 0
      if (start === null) start = now
      if (frame(now - start)) {
        anim.current.mode = 'idle'
        done()
        return
      }
      anim.current.raf = requestAnimationFrame(step)
    }
    anim.current = { raf: requestAnimationFrame(step), mode }
  }, [stopAnim])

  const clearTimer = (k: keyof typeof timers.current) => {
    const id = timers.current[k]
    if (id) clearTimeout(id)
    timers.current[k] = 0
  }

  const showBubble = useCallback((text: string | undefined) => {
    clearTimer('bubble')
    if (!text) {
      setBubble(null)
      return
    }
    setBubble(text)
    timers.current.bubble = setTimeout(() => {
      timers.current.bubble = 0
      setBubble(null)
    }, BUBBLE_MS)
  }, [])

  const hop = useCallback(() => {
    if (still) return
    clearTimer('hop')
    setHopping(true)
    timers.current.hop = setTimeout(() => {
      timers.current.hop = 0
      setHopping(false)
    }, HOP_MS)
  }, [still])

  // Passeggiate: solo nell'angolo, mai con riduci movimento o Glu tranquillo.
  const scheduleWalk = useCallback(() => {
    clearTimer('walk')
    if (still) return
    timers.current.walk = setTimeout(function fire() {
      timers.current.walk = 0
      const l = live.current
      if (l.spot !== 'corner' || anim.current.mode !== 'idle') return
      if (l.calm || document.visibilityState === 'hidden') {
        timers.current.walk = setTimeout(fire, nextWalkDelay(Math.random))
        return
      }
      const fromX = measure('corner').x
      loop(
        'walk',
        (t) => {
          const c = measure('corner')
          const r = walkTimeline(t, fromX, WALK_EDGE_PX)
          setPos({ ...c, x: r.done ? c.x : r.x })
          setWalkDir(r.walking ? r.dir : null)
          return r.done
        },
        () => {
          setWalkDir(null)
          scheduleWalkRef.current()
        },
      )
    }, nextWalkDelay(Math.random))
  }, [still, measure, loop, setPos])
  const scheduleWalkRef = useRef(scheduleWalk)
  useLayoutEffect(() => {
    scheduleWalkRef.current = scheduleWalk
  })

  // Viaggio a ogni cambio di posto o di pagina (anche corner → corner).
  useLayoutEffect(() => {
    const from = shown.current ? prevSpot.current : null
    prevSpot.current = spot
    if (spot !== 'away') shown.current = true
    const tr = travelFor(from, spot, { still, calm: live.current.calm })
    const wasWalking = anim.current.mode === 'walk'
    const wasTravel = anim.current.mode === 'travel'
    stopAnim()
    clearTimer('walk')
    setWalkDir(null)
    if (spot !== 'corner') showBubble(undefined)

    const arrive = () => {
      setWalkDir(null)
      setPos(measure(spot))
      if (tr.hop) hop()
      if (spot === 'corner') {
        prevText.current = live.current.text
        showBubble(live.current.text)
        scheduleWalk()
      }
    }
    const fromPos = posRef.current
    const target = measure(spot)

    if (tr.kind === 'appear' || (tr.kind === 'hop' && (!(wasWalking || wasTravel) || still))) {
      arrive()
      return
    }
    if (tr.kind === 'hop' && wasTravel && !wasWalking) {
      // Cambio scheda a metà viaggio: prosegue dalla posizione corrente, senza teletrasporto.
      const ms = Math.max(RETARGET_MS, tr.ms)
      loop(
        'travel',
        (t) => {
          const k = easeInOut(Math.min(1, t / ms))
          const c = measure(spot)
          setPos({ x: lerp(fromPos.x, c.x, k), y: lerp(fromPos.y, c.y, k), s: lerp(fromPos.s, c.s, k), o: lerp(fromPos.o, c.o, k) })
          return t >= ms
        },
        arrive,
      )
      return
    }
    if (tr.kind === 'hop') {
      // Cambio scheda a metà passeggiata: torna nell'angolo camminando dalla x attuale.
      const span = Math.max(1, target.x - WALK_EDGE_PX)
      const ms = Math.min(WALK_LEG_MS, (Math.abs(target.x - fromPos.x) / span) * WALK_LEG_MS)
      const dir: Dir = target.x >= fromPos.x ? 1 : -1
      setWalkDir(dir)
      loop(
        'travel',
        (t) => {
          const k = Math.min(1, t / Math.max(1, ms))
          const c = measure(spot)
          setPos({ ...c, x: lerp(fromPos.x, c.x, k) })
          return k >= 1
        },
        arrive,
      )
      return
    }
    if (tr.kind === 'walk-out' || tr.kind === 'walk-in') {
      setWalkDir(tr.kind === 'walk-out' ? 1 : -1)
      loop(
        'travel',
        (t) => {
          const k = Math.min(1, t / tr.ms)
          const c = measure(spot)
          setPos({ x: lerp(fromPos.x, c.x, k), y: lerp(fromPos.y, c.y, k), s: lerp(fromPos.s, c.s, k), o: 1 })
          return k >= 1
        },
        arrive,
      )
      return
    }
    if (tr.kind === 'fly') {
      loop(
        'travel',
        (t) => {
          const k = easeInOut(Math.min(1, t / tr.ms))
          const c = measure(spot)
          setPos({ x: lerp(fromPos.x, c.x, k), y: lerp(fromPos.y, c.y, k), s: lerp(fromPos.s, c.s, k), o: 1 })
          return t >= tr.ms
        },
        arrive,
      )
      return
    }
    // fade: scompare dove sta, ricompare nel posto nuovo.
    loop(
      'travel',
      (t) => {
        const k = Math.min(1, t / tr.ms)
        if (k < 0.5) setPos({ ...fromPos, o: 1 - 2 * k })
        else setPos({ ...measure(spot), o: 2 * k - 1 })
        return k >= 1
      },
      arrive,
    )
    // specId: una pagina nuova nello stesso posto è comunque un arrivo (saltello e fumetto).
  }, [spot, specId, still, stopAnim, showBubble, setPos, measure, hop, scheduleWalk, loop])

  // Frase nuova nell'angolo (stessa pagina): di nuovo il fumetto.
  const text = spec?.text
  useEffect(() => {
    if (spot !== 'corner' || anim.current.mode === 'travel') return
    if (text === prevText.current) return
    prevText.current = text
    showBubble(text)
  }, [spot, text, showBubble])

  // Rettangoli ricalcolati su resize, orientamento e scorrimento (l'anello scorre con la pagina).
  useEffect(() => {
    const remeasure = () => {
      if (anim.current.mode !== 'idle') return // i cicli misurano a ogni fotogramma
      setPos(measure(live.current.spot))
    }
    // Allo scorrimento si muove solo l'anello: angolo e fuori scena dipendono dalla finestra.
    const onScroll = () => {
      if (live.current.spot === 'ring') remeasure()
    }
    remeasure()
    window.addEventListener('resize', remeasure)
    window.addEventListener('orientationchange', remeasure)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('orientationchange', remeasure)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [ringEl, measure, setPos])

  useEffect(
    () => () => {
      stopAnim()
      for (const k of ['walk', 'bubble', 'hop'] as const) {
        const id = timers.current[k]
        if (id) clearTimeout(id)
      }
    },
    [stopAnim],
  )

  const onFail = useCallback(
    (e: unknown) => {
      if (failed.current) return
      failed.current = true
      reportError('react', e)
      fail()
    },
    [fail],
  )

  const walk = useMemo(() => (walkDir === null ? null : { dir: walkDir }), [walkDir])
  const fill = Math.min(1, Math.max(0, shownSpec?.fill ?? 0.6))
  const w = typeof window === 'undefined' ? 0 : window.innerWidth
  const h = typeof window === 'undefined' ? 0 : window.innerHeight
  const boxPx = base * pos.s

  return (
    <div className="glu-stage" data-testid="glu-stage" data-spot={spot}>
      <div
        data-testid="glu-stage-box"
        className="glu-stage-box"
        style={{
          width: base,
          height: base,
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${pos.s})`,
          opacity: pos.o,
        }}
      >
        <div className={hopping ? 'glu-stage-hop is-hopping' : 'glu-stage-hop'}>
          <Glu3D
            mood={shownSpec?.mood ?? 'idle'}
            fill={fill}
            size={base}
            extras={shownSpec?.extras}
            calm={calm}
            walk={walk}
            onFail={onFail}
          />
        </div>
      </div>
      <div
        data-testid="glu-stage-bubble"
        className="glu-stage-bubble"
        aria-live="polite"
        style={{ right: Math.max(0, w - (pos.x + boxPx)), bottom: Math.max(0, h - pos.y) }}
      >
        {bubble && (
          <m.p
            key={bubble}
            className="glu-bubble"
            initial={still ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            {bubble}
          </m.p>
        )}
      </div>
    </div>
  )
}
