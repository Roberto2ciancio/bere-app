import { m, useSpring, useTransform, type Transition } from 'motion/react'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { prefersReducedMotion } from '../ui/motion/effects'
import type { GluMood } from './mood'
import { CLASSIC_VARIANT, type GluDetail, type GluVariant } from './variants'
import type { CrownTier } from './reactions'

/** Reazioni che si sommano all'umore: sete (0..1), accessori, inclinazione dell'acqua in gradi. */
export interface GluExtras {
  thirst?: number
  jitter?: boolean
  headband?: boolean
  sweat?: boolean
  crown?: CrownTier
  crownDrop?: boolean
  fan?: boolean
  tilt?: number
}

export interface GluProps {
  mood: GluMood
  fill: number
  size?: number
  onTap?: () => void
  extras?: GluExtras
  /** Tinta e dettaglio; senza, Glu classico. */
  variant?: GluVariant
}

// Forme della «bolla» (docs/superpowers/specs/glu-proposta/03-glu-svg): niente contorni, tutto si riempie d'acqua.
const TORSO = 'M100 28C60 28 30 70 30 118c0 42 28 64 70 64s70-22 70-64c0-48-30-90-70-90z'
const TUFT = 'M96 36C88 14 104 2 118 12c-9 2-11 11-7 22z'
const SWEAT = 'M160 52c6 8 8 12 8 16a8 8 0 0 1-16 0c0-4 2-8 8-16z'
const SPARKLE = 'M0 -9 Q1.4 -1.4 9 0 Q1.4 1.4 0 9 Q-1.4 1.4 -9 0 Q-1.4 -1.4 0 -9 Z'
const ZED = 'M-5 -5.5 H5 L-5 5.5 H5'
const DROP = 'M0 -9c5 7 7 10 7 13a7 7 0 0 1-14 0c0-3 2-6 7-13z'
const CROWN = 'M79 34L76 14l12 9 12-13 12 13 12-9-3 20z'
// Mantellina dietro il corpo: si vede solo ai lati, sotto le braccia.
const CAPE = 'M64 60Q34 104 20 164q20 10 40 2 20 8 40 0 20 8 40 0 20 8 40-2Q166 104 136 60z'
// Ventaglio di carta aperto verso il viso, col manico nell'origine (la mano sinistra alzata).
const FAN = 'M0 0L-15.4-18.4A24 24 0 0 1 23.6-4.2z'
const FAN_PLEATS = 'M0 0L-5.4-23.4M0 0L5.6-23.3M0 0L15.4-18.4'
const SWEAT_DROPS: [number, number, number][] = [
  [152, 34, 0.8],
  [46, 42, 0.65],
]

// Sete: Glu si abbassa fino a -8% (dai piedi) e il corpo sbiadisce verso un azzurro grigio.
const DROOP = 0.08
const FEET_Y = 192
const DULL = '#98abb8'
const DULL_MAX = 55
// Inclinazione: l'acqua ruota attorno al centro del corpo, al massimo di 25 gradi.
const TILT_MAX = 25

// Livello: y = 186 a corpo vuoto, 16 a corpo pieno; all'obiettivo sale a -10 e riempie anche il ciuffo.
const WATER_EMPTY = 186
const WATER_SPAN = 170
const WATER_BRIM = -10

// Onda larga 400 e alta fin sotto i piedi, spostata di 100 a sinistra: anche inclinata di 25° e scorrendo di 50
// (un'onda) copre sempre tutto il corpo.
const wavePath = (y: number) => `M0 ${y}q25-9 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0V320H0z`
const clamp01 = (n: number | undefined) => (n === undefined || Number.isNaN(n) ? 0 : Math.min(1, Math.max(0, n)))
const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits

// Braccio: lift 0 = abbassato lungo il fianco, 1 = alzato come nei disegni.
// swing (gradi) lo fa ruotare attorno alla spalla, l'estremo attaccato al corpo: serve al saluto.
function armPath(side: 'left' | 'right', lift: number, swing = 0): string {
  const r = (n: number) => Math.round(n * 100) / 100
  const s = side === 'left' ? 1 : -1
  let cx = 100 - s * (70 + 8 * lift)
  let cy = 128 - 42 * lift
  const a = ((s * (25 - 60 * lift)) * Math.PI) / 180
  const dx = -Math.sin(a) * 19
  const dy = Math.cos(a) * 19
  // Spalla = l'estremo dell'ellisse più vicino al centro del corpo.
  const toward = (cx + dx - 100) ** 2 + (cy + dy - 118) ** 2 < (cx - dx - 100) ** 2 + (cy - dy - 118) ** 2 ? 1 : -1
  const px = cx + toward * dx
  const py = cy + toward * dy
  const w = (-s * swing * Math.PI) / 180
  ;[cx, cy] = [px + (cx - px) * Math.cos(w) - (cy - py) * Math.sin(w), py + (cx - px) * Math.sin(w) + (cy - py) * Math.cos(w)]
  const deg = (a + w) * (180 / Math.PI)
  const ex = -Math.sin(a + w) * 19
  const ey = Math.cos(a + w) * 19
  const p1 = `${r(cx + ex)} ${r(cy + ey)}`
  const p2 = `${r(cx - ex)} ${r(cy - ey)}`
  return `M${p1}A10 19 ${r(deg)} 1 1 ${p2}A10 19 ${r(deg)} 1 1 ${p1}Z`
}

type Eye = 'open' | 'happy' | 'sleep' | 'wide' | 'effort'
const EYES: Record<GluMood, [Eye, Eye]> = {
  thirsty: ['open', 'open'],
  idle: ['open', 'open'],
  hello: ['open', 'open'],
  sad: ['open', 'open'],
  almost: ['open', 'happy'],
  drink: ['happy', 'happy'],
  goal: ['happy', 'happy'],
  levelup: ['happy', 'happy'],
  sleep: ['sleep', 'sleep'],
  coffee: ['wide', 'wide'],
  workout: ['effort', 'effort'],
}

// [sinistro, destro]
const LIFT: Record<GluMood, [number, number]> = {
  thirsty: [0, 0],
  sad: [0, 0],
  sleep: [0, 0],
  idle: [0, 1],
  hello: [0, 1],
  almost: [0, 1],
  drink: [1, 1],
  goal: [1, 1],
  levelup: [1, 1],
  coffee: [0.5, 0.5],
  workout: [1, 1],
}

type Mouth = { kind: 'line' | 'fill'; name: string; d: string }
const SMILE: Mouth = { kind: 'line', name: 'smile', d: 'M86 122q14 16 28 0' }
const GRIN: Mouth = { kind: 'fill', name: 'grin', d: 'M82 120q18 26 36 0z' }
const MOUTH: Record<Exclude<GluMood, 'drink'>, Mouth> = {
  thirsty: { kind: 'line', name: 'wavy', d: 'M88 128q6-6 12 0t12 0' },
  idle: SMILE,
  hello: SMILE,
  almost: GRIN,
  goal: GRIN,
  levelup: GRIN,
  sad: { kind: 'line', name: 'sad', d: 'M89 131q11-9 22 0' },
  sleep: { kind: 'line', name: 'calm', d: 'M94 126q6 4 12 0' },
  coffee: { kind: 'fill', name: 'surprised', d: 'M96 128a4 5 0 1 0 8 0a4 5 0 1 0-8 0z' },
  workout: { kind: 'fill', name: 'effort', d: 'M87 121h26q-2 12-13 12t-13-12z' },
}

type Move = Record<string, number | number[]>
const STILL: Move = { y: 0, rotate: 0, scaleX: 1, scaleY: 1 }
const loop = (duration: number, extra: Transition = {}): Transition => ({ duration, ease: 'easeInOut', repeat: Infinity, ...extra })
const breathe = (depth: number, duration: number) => ({
  move: { ...STILL, scaleX: [1, 1 + depth / 2, 1], scaleY: [1, 1 + depth, 1] },
  transition: loop(duration),
})

// Movimento del corpo per umore; con «Riduci movimento» resta STILL.
const POSE: Record<GluMood, { move: Move; transition: Transition }> = {
  idle: breathe(0.025, 3.2),
  hello: breathe(0.025, 3.2),
  coffee: breathe(0.02, 2.2),
  almost: breathe(0.03, 2.6),
  thirsty: breathe(0.02, 3.6),
  sad: breathe(0.015, 4),
  sleep: breathe(0.035, 6),
  // Due saltelli, poi una pausa.
  workout: {
    move: { ...STILL, y: [0, -12, 0, -12, 0], scaleY: [1, 1.04, 0.94, 1.04, 1], scaleX: [1, 0.98, 1.04, 0.98, 1] },
    transition: loop(1.1, { repeatDelay: 0.9 }),
  },
  drink: {
    move: { ...STILL, y: [0, -18, 0, 0], scaleY: [0.9, 1.06, 0.92, 1], scaleX: [1.06, 0.96, 1.05, 1] },
    transition: { duration: 0.6, times: [0, 0.4, 0.75, 1], ease: 'easeOut' },
  },
  goal: {
    move: { ...STILL, y: [0, -9, 0], scaleY: [0.97, 1.04, 1], scaleX: [1.02, 0.98, 1] },
    transition: loop(0.8, { repeatDelay: 0.4 }),
  },
  levelup: {
    move: { ...STILL, y: [0, -20, 0, -7, 0], rotate: [0, -6, 6, -2, 0], scaleY: [0.92, 1.06, 0.92, 1.02, 1], scaleX: [1.06, 0.96, 1.06, 0.99, 1] },
    transition: loop(1.2, { repeatDelay: 0.4 }),
  },
}

const ARM_SPRING = { stiffness: 260, damping: 15 }
const TAP_VARIANTS = { rest: { y: 0 }, hopA: { y: [0, -14, 0] }, hopB: { y: [0, -14, 0] } }
const BUBBLES: [number, number, number][] = [
  [150, 30, 6],
  [166, 14, 4],
  [48, 26, 4],
]
const SPARKLES: [number, number, number][] = [
  [26, 46, 1.1],
  [176, 40, 0.9],
  [12, 156, 0.8],
  [190, 150, 1],
]

// Dettagli delle varianti: piccoli, piatti, senza contorni, sul lato alto destro della testa (origine = centro del dettaglio),
// lontani da corona (x 76-124) e fascia (y 77-88).
const DETAILS: Record<Exclude<GluDetail, 'none'>, ReactNode> = {
  mint: (
    <>
      <path d="M0 2C-2-8 6-14 14-14 14-6 8 2 0 2z" fill="#1FB58F" />
      <path d="M-1 4C-10 2-15-6-13-13-5-12 1-6-1 4z" fill="#46CDA4" />
    </>
  ),
  lemon: (
    <>
      <circle r="11" fill="#F2C014" />
      <circle r="8.5" fill="#FFF6C9" />
      <path d="M0 0V-8M0 0L7-4M0 0L7 4M0 0V8M0 0L-7 4M0 0L-7-4" stroke="#F2C014" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  strawberry: (
    <>
      <path d="M0 12C-12 4-11-8-4-9Q0-7 4-9C11-8 12 4 0 12z" fill="#E03A5A" />
      <path d="M-7-9Q0-18 7-9Q0-12-7-9z" fill="#1FB58F" />
      <circle cx="-3.5" cy="-1" r="1.2" fill="#FFE0E6" />
      <circle cx="3.5" cy="-1" r="1.2" fill="#FFE0E6" />
      <circle cx="0" cy="5" r="1.2" fill="#FFE0E6" />
    </>
  ),
  straw: (
    <g transform="rotate(28)">
      <rect x="-3.5" y="-16" width="7" height="32" rx="3.5" fill="#fff" />
      <path d="M-3.5-10h7v5h-7zM-3.5 0h7v5h-7zM-3.5 10h7v3.5q0 2.5-3.5 2.5t-3.5-2.5z" fill="#C9A27E" />
    </g>
  ),
  moon: (
    <>
      <path d="M6-12A13 13 0 1 0 12 6 10 10 0 0 1 6-12z" fill="#FFE27A" />
      <path d="M12-10l1.6 3.4 3.4 1.6-3.4 1.6L12 0l-1.6-3.4L7-5l3.4-1.6z" fill="#FFE27A" />
    </>
  ),
}
const DETAIL_AT = 'translate(130 54)'

export function Glu({ mood, fill, size = 160, onTap, extras = {}, variant = CLASSIC_VARIANT }: GluProps) {
  const clip = useId()
  const [reduced] = useState(prefersReducedMotion)
  const [blink, setBlink] = useState(false)
  const [taps, setTaps] = useState(0)
  const lastTap = useRef(-Infinity)

  const level = Number.isNaN(fill) ? 0 : Math.min(1, Math.max(0, fill))
  const waterY = level >= 1 ? WATER_BRIM : Math.round((WATER_EMPTY - WATER_SPAN * level) * 100) / 100

  const thirst = clamp01(extras.thirst)
  const droop = round(1 - DROOP * thirst, 3)
  const bodyStyle = thirst > 0 ? { fill: `color-mix(in srgb, var(--glu-body, #cfebfb), ${DULL} ${Math.round(DULL_MAX * thirst)}%)` } : undefined
  const rawTilt = extras.tilt === undefined || Number.isNaN(extras.tilt) ? 0 : extras.tilt
  const tilt = round(-Math.min(TILT_MAX, Math.max(-TILT_MAX, rawTilt))) || 0
  const sweat = extras.sweat || mood === 'workout'
  const crown = extras.crown ?? 0
  const { palette } = variant
  const varStyle = {
    '--glu-body': palette.body,
    '--glu-water': palette.water,
    '--glu-limb': palette.limb,
    '--glu-feet': palette.feet,
  } as CSSProperties

  // Braccia: una molla per lato; il saluto la fa oscillare. Col ventaglio il braccio sinistro resta alzato.
  const leftTarget = extras.fan ? 1 : LIFT[mood][0]
  const rightTarget = LIFT[mood][1]
  const leftLift = useSpring(leftTarget, ARM_SPRING)
  const rightLift = useSpring(rightTarget, ARM_SPRING)
  const leftArm = useTransform(leftLift, (l) => armPath('left', l))
  const swing = useSpring(0, ARM_SPRING)
  const rightArm = useTransform(() => armPath('right', rightLift.get(), swing.get()))
  useEffect(() => {
    if (reduced) {
      leftLift.jump(leftTarget)
      rightLift.jump(rightTarget)
      return
    }
    leftLift.set(leftTarget)
    rightLift.set(rightTarget)
    if (mood !== 'hello') return
    let up = false
    const timer = window.setInterval(() => {
      up = !up
      swing.set(up ? 18 : -14)
    }, 280)
    return () => {
      window.clearInterval(timer)
      swing.set(0)
    }
  }, [mood, leftTarget, rightTarget, reduced, leftLift, rightLift, swing])

  // Sbatte le palpebre a intervalli casuali (3-6 s), mai con «Riduci movimento».
  const eyes = EYES[mood]
  const canBlink = !reduced && (eyes.includes('open') || eyes.includes('wide'))
  useEffect(() => {
    if (!canBlink) return
    let timer = 0
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          setBlink(true)
          timer = window.setTimeout(() => {
            setBlink(false)
            schedule()
          }, 140)
        },
        3000 + Math.random() * 3000,
      )
    }
    schedule()
    return () => {
      window.clearTimeout(timer)
      setBlink(false)
    }
  }, [canBlink])

  const handleTap = () => {
    const now = Date.now()
    if (now - lastTap.current < 1000) return
    lastTap.current = now
    setTaps((n) => n + 1)
    onTap?.()
  }

  const pose = POSE[mood]
  const instant: Transition = { duration: 0 }

  const eye = (kind: Eye, cx: number) => {
    if (kind === 'happy') {
      return <path key={cx} className="glu-eye glu-eye-happy glu-line" d={`M${cx - 10} 108q10-13 20 0`} />
    }
    if (kind === 'sleep') {
      return <path key={cx} className="glu-eye glu-eye-sleep glu-line" d={`M${cx - 10} 104q10 9 20 0`} />
    }
    if (kind === 'effort') {
      // «> <»: occhi strizzati dallo sforzo.
      const d = cx < 100 ? `M${cx - 8} 97l14 7-14 7` : `M${cx + 8} 97l-14 7 14 7`
      return <path key={cx} className="glu-eye glu-eye-effort glu-line" d={d} />
    }
    let shape
    if (kind === 'wide') {
      shape = (
        <>
          <ellipse className="glu-ink" cx={cx} cy="102" rx="11" ry="14" />
          <circle className="glu-eye-shine" cx={cx + 4} cy="96" r="4" />
          <circle className="glu-eye-shine" cx={cx - 4} cy="108" r="1.8" />
        </>
      )
    } else if (thirst > 0) {
      // Palpebra che scende con la sete: l'occhio perde la parte alta, fino a quasi metà.
      const lid = round(92 + 24 * 0.45 * thirst)
      const w = round(9 * Math.sqrt(1 - ((lid - 104) / 12) ** 2))
      shape = (
        <>
          <path className="glu-ink" d={`M${round(cx - w)} ${lid}A9 12 0 1 0 ${round(cx + w)} ${lid}z`} />
          <path className="glu-lid glu-line" d={`M${round(cx - w - 2)} ${lid}h${round(2 * w + 4)}`} />
          <circle className="glu-eye-shine" cx={cx + 3} cy={Math.max(99, lid + 4)} r="3" />
        </>
      )
    } else {
      shape = (
        <>
          <ellipse className="glu-ink" cx={cx} cy="104" rx="9" ry="12" />
          <circle className="glu-eye-shine" cx={cx + 3} cy="99" r="3.2" />
        </>
      )
    }
    const cls = kind === 'wide' ? 'glu-eye glu-eye-wide' : thirst > 0 ? 'glu-eye glu-eye-open glu-eye-droopy' : 'glu-eye glu-eye-open'
    return (
      <m.g
        key={cx}
        className={cls}
        style={{ originX: 0.5, originY: 0.5 }}
        initial={false}
        animate={{ scaleY: blink ? 0.1 : 1 }}
        transition={{ duration: 0.07 }}
      >
        {shape}
      </m.g>
    )
  }

  const crownShape = crown > 0 && (
    <g className="glu-crown">
      <path className="glu-crown-gold" d={CROWN} />
      <path className="glu-crown-band" d="M78.6 29h42.8l-.6 5H79.2z" />
      {[76, 100, 124].map((x, i) => (
        <circle key={x} className="glu-crown-gold" cx={x} cy={i === 1 ? 10 : 14} r="3" />
      ))}
      {crown >= 14 && <path className="glu-crown-gem" d="M100 17l4.5 5.5-4.5 5.5-4.5-5.5z" />}
    </g>
  )

  const mouth = () => {
    if (mood === 'drink') {
      // Bocca a «o» che manda giù.
      return (
        <m.ellipse
          className="glu-mouth glu-mouth-o glu-ink"
          cx="100"
          cy="127"
          rx="7"
          ry="8"
          style={{ originX: 0.5, originY: 0.5 }}
          initial={false}
          animate={reduced ? { scaleY: 1 } : { scaleY: [1, 0.7, 1] }}
          transition={reduced ? instant : loop(0.45)}
        />
      )
    }
    const { kind, name, d } = MOUTH[mood]
    return <path className={`glu-mouth glu-mouth-${name} ${kind === 'fill' ? 'glu-ink glu-ink-fill' : 'glu-line'}`} d={d} />
  }

  return (
    <svg
      className="glu"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden="true"
      data-testid="glu"
      data-mood={mood}
      data-variant={variant.id}
      style={varStyle}
      data-tappable={onTap ? '' : undefined}
      onClick={handleTap}
    >
      <defs>
        <clipPath id={clip}>
          <path className="glu-torso" d={TORSO} />
          <path className="glu-tuft" d={TUFT} />
          <m.path className="glu-arm glu-arm-left" d={leftArm} />
          <m.path className={mood === 'hello' ? 'glu-arm glu-arm-right glu-arm-waving' : 'glu-arm glu-arm-right'} d={rightArm} />
          <ellipse className="glu-foot" cx="76" cy="183" rx="18" ry="9" />
          <ellipse className="glu-foot" cx="124" cy="183" rx="18" ry="9" />
        </clipPath>
      </defs>
      <ellipse className="glu-shadow" cx="100" cy="194" rx="56" ry="6" />
      <m.g
        variants={TAP_VARIANTS}
        initial={false}
        animate={taps === 0 ? 'rest' : taps % 2 ? 'hopA' : 'hopB'}
        transition={reduced ? instant : { duration: 0.4, ease: 'easeOut' }}
      >
        <g className="glu-droop" transform={droop < 1 ? `translate(0 ${round(FEET_Y * (1 - droop))}) scale(1 ${droop})` : undefined}>
          <g className={extras.jitter && !reduced ? 'glu-jitter' : undefined}>
            <m.g
              className="glu-pose"
              style={{ originX: 0.5, originY: 1 }}
              initial={false}
              animate={reduced ? STILL : pose.move}
              transition={reduced ? instant : pose.transition}
            >
              {crown >= 30 && <path className="glu-cape" d={CAPE} />}
              <g clipPath={`url(#${clip})`}>
                <rect className="glu-body" width="200" height="200" style={bodyStyle} />
                <g className="glu-tilt" transform={tilt ? `rotate(${tilt} 100 105)` : undefined}>
                  <g transform="translate(-100 0)">
                    <g className="glu-wave">
                      <m.path
                        className="glu-water"
                        initial={false}
                        animate={{ d: wavePath(waterY) }}
                        transition={reduced ? instant : { duration: 0.9, ease: 'easeOut' }}
                      />
                    </g>
                  </g>
                </g>
                <ellipse className="glu-highlight" cx="62" cy="70" rx="9" ry="20" transform="rotate(28 62 70)" />
              </g>
              {variant.detail !== 'none' && (
                <g className="glu-detail" data-detail={variant.detail} transform={DETAIL_AT}>
                  {DETAILS[variant.detail]}
                </g>
              )}
              {extras.headband && (
                <g className="glu-headband">
                  <path d="M37 77Q100 88 163 77" />
                  <path className="glu-headband-knot" d="M38 78q-9 3-12 11M38 78q-11-2-15 4" />
                </g>
              )}

              {eye(eyes[0], 74)}
              {eye(eyes[1], 126)}
              {(mood === 'thirsty' || mood === 'sad') && <path className="glu-brow glu-line" d="M62 88l20-6M118 82l20 6" />}
              {mouth()}

              {mood === 'thirsty' && (
                <m.path
                  className="glu-sweat"
                  d={SWEAT}
                  initial={false}
                  animate={reduced ? { y: 0, opacity: 1 } : { y: [0, 0, 8], opacity: [1, 1, 0] }}
                  transition={reduced ? instant : loop(2.2, { times: [0, 0.6, 1], ease: 'easeIn', repeatDelay: 0.4 })}
                />
              )}
              {sweat && (
                <g className={reduced ? 'glu-sweat-drops' : 'glu-sweat-drops glu-sweat-drops-falling'}>
                  {SWEAT_DROPS.map(([x, y, s]) => (
                    <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
                      <path d={DROP} />
                    </g>
                  ))}
                </g>
              )}
              {extras.fan && (
                <g transform="translate(13 72) scale(1.2)">
                  <g className={reduced ? 'glu-fan' : 'glu-fan glu-fan-waving'}>
                    <path className="glu-fan-handle" d="M0 0l-3 7" />
                    <path className="glu-fan-paper" d={FAN} />
                    <path className="glu-fan-pleats" d={FAN_PLEATS} />
                  </g>
                </g>
              )}
              {crownShape &&
                (extras.crownDrop && !reduced ? (
                  // Cade dall'alto e rimbalza una volta, poi resta in testa.
                  <m.g
                    className="glu-crown-drop"
                    initial={{ y: -80, opacity: 0 }}
                    animate={{ y: [-80, 0, -10, 0], opacity: [0, 1, 1, 1] }}
                    transition={{ duration: 0.8, times: [0, 0.5, 0.75, 1], ease: 'easeOut' }}
                  >
                    {crownShape}
                  </m.g>
                ) : (
                  crownShape
                ))}
            </m.g>
          </g>
        </g>
      </m.g>

      {mood === 'drink' && (
        <g className="glu-bubbles">
          {BUBBLES.map(([cx, cy, r], i) => (
            <m.circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              initial={false}
              animate={reduced ? { y: 0, opacity: 1 } : { y: [16, 0, -10], opacity: [0, 1, 0] }}
              transition={reduced ? instant : loop(1.2, { ease: 'easeOut', delay: i * 0.25 })}
            />
          ))}
        </g>
      )}
      {mood === 'sleep' && (
        <g className="glu-zzz" transform="translate(150 50)">
          {[0, 1, 2].map((i) => (
            <m.path
              key={i}
              d={ZED}
              style={{ originX: 0.5, originY: 0.5 }}
              initial={false}
              animate={
                reduced
                  ? { x: i * 12, y: -i * 15, scale: 0.8 + i * 0.22, opacity: 1 }
                  : { x: [0, 14, 22], y: [0, -22, -42], scale: [0.6, 1, 1.35], opacity: [0, 1, 0] }
              }
              transition={reduced ? instant : loop(2.4, { ease: 'easeOut', delay: i * 0.8 })}
            />
          ))}
        </g>
      )}
      {mood === 'levelup' &&
        SPARKLES.map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <m.path
              className="glu-sparkle"
              d={SPARKLE}
              style={{ originX: 0.5, originY: 0.5 }}
              initial={false}
              animate={reduced ? { scale: 1, rotate: 0 } : { scale: [0, 1, 0], rotate: [0, 90] }}
              transition={reduced ? instant : loop(1.4, { delay: i * 0.35 })}
            />
          </g>
        ))}
    </svg>
  )
}
