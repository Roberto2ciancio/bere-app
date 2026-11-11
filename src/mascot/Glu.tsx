import { m, type Transition } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { prefersReducedMotion } from '../ui/motion/effects'
import type { GluMood } from './mood'

export interface GluProps {
  mood: GluMood
  fill: number
  size?: number
  onTap?: () => void
}

// Goccia paffuta: base larga, punta morbida un po' piegata a destra.
const BODY =
  'M98 30 Q106 16 115 30 C138 62 173 90 173 128 C173 163 141 185 100 185 C59 185 27 163 27 128 C27 92 74 62 98 30 Z'

// Livello dell'acqua: a 0 resta un velo sul fondo, a 1 copre anche la punta.
const WATER_EMPTY = 179
const WATER_FULL = 12

const WAVE_FILL = 'M-100 0 q12.5 -6 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 V10 H-100 Z'
const WAVE_LINE = 'M-100 0 q12.5 -6 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0'

const LEFT_ARM = 'M34 133 H16 A7 7 0 0 0 16 147 H34 A7 7 0 0 0 34 133 Z'
const RIGHT_ARM = 'M166 133 H184 A7 7 0 0 1 184 147 H166 A7 7 0 0 1 166 133 Z'

const STAR = 'M0 -13 L3.4 -4.7 L12.4 -4 L5.5 1.8 L7.6 10.5 L0 5.8 L-7.6 10.5 L-5.5 1.8 L-12.4 -4 L-3.4 -4.7 Z'
const SPARKLE = 'M0 -9 Q1.4 -1.4 9 0 Q1.4 1.4 0 9 Q-1.4 1.4 -9 0 Q-1.4 -1.4 0 -9 Z'
const ZED = 'M-4.5 -5 H4.5 L-4.5 5 H4.5'
const TEAR = 'M0 -7 C3 -2 6 1 6 4 A6 6 0 0 1 -6 4 C-6 1 -3 -2 0 -7 Z'

// Tutte le bocche hanno gli stessi comandi: così Motion può trasformarle l'una nell'altra.
const MOUTH: Record<GluMood, string> = {
  idle: 'M89 137 C94 139 108 139 113 137 C111 148 91 148 89 137 Z',
  hello: 'M87 135 C94 137 108 137 115 135 C113 151 89 151 87 135 Z',
  thirsty: 'M90 136 C95 134 107 134 112 136 C112 148 90 148 90 136 Z',
  drink: 'M95 138 C95 132 107 132 107 138 C107 145 95 145 95 138 Z',
  goal: 'M85 134 C93 136 109 136 117 134 C115 154 87 154 85 134 Z',
  levelup: 'M85 134 C93 136 109 136 117 134 C115 154 87 154 85 134 Z',
  sad: 'M90 144 C95 136 107 136 112 144 C107 141 95 141 90 144 Z',
  sleep: 'M97 140 C97 136 105 136 105 140 C105 144 97 144 97 140 Z',
}

// Palpebre (disegnate per l'occhio sinistro, il destro è specchiato).
const LID_CLOSED = 'M-11 1 Q0 10 11 1'
const LID: Partial<Record<GluMood, string>> = {
  sleep: LID_CLOSED,
  drink: 'M-11 4 Q0 -7 11 4',
  thirsty: 'M-13 -3 Q-1 -10 12 -7',
  sad: 'M-11 -19 Q-1 -21 9 -27',
}

type Pose = { y: number; rotate: number; scaleX: number; scaleY: number }
type Move = { [K in keyof Pose]?: number | number[] }

const pose = (p: Move = {}): Move => ({ y: 0, rotate: 0, scaleX: 1, scaleY: 1, ...p })
const loop = (duration: number, extra: Transition = {}): Transition => ({
  duration,
  ease: 'easeInOut',
  repeat: Infinity,
  ...extra,
})
const SPRING: Transition = { type: 'spring', stiffness: 260, damping: 18 }

// Corpo: posa ferma (anche con «Riduci movimento») e, se c'è, il movimento.
const BODY_POSE: Record<GluMood, { still: Move; move?: Move; transition?: Transition }> = {
  idle: { still: pose(), move: pose({ scaleX: [1, 1.03, 1], scaleY: [1, 1.03, 1] }), transition: loop(3) },
  hello: {
    still: pose(),
    move: pose({ scaleY: [1, 1.08, 0.97, 1], scaleX: [1, 0.96, 1.02, 1], rotate: [0, -3, 2, 0] }),
    transition: { duration: 0.9, ease: 'easeInOut' },
  },
  thirsty: { still: pose({ scaleX: 1.04, scaleY: 0.94 }) },
  drink: {
    still: pose(),
    move: pose({ y: [0, -24, 0, 0], scaleY: [0.86, 1.08, 0.84, 1], scaleX: [1.1, 0.94, 1.12, 1] }),
    transition: { duration: 0.6, times: [0, 0.4, 0.75, 1], ease: 'easeOut' },
  },
  goal: {
    still: pose(),
    move: pose({ y: [0, -10, 0], scaleY: [1, 1.04, 1], scaleX: [1, 0.98, 1] }),
    transition: loop(0.8, { repeatDelay: 0.35 }),
  },
  sad: { still: pose({ scaleX: 1.02, scaleY: 0.97 }) },
  sleep: { still: pose(), move: pose({ scaleX: [1, 1.025, 1], scaleY: [1, 1.025, 1] }), transition: loop(4) },
  levelup: {
    still: pose(),
    move: pose({ y: [0, -30, 0, -10, 0], rotate: [0, -10, 10, -4, 0], scaleY: [0.9, 1.08, 0.88, 1.03, 1], scaleX: [1.08, 0.95, 1.1, 0.98, 1] }),
    transition: loop(1.2, { repeatDelay: 0.4 }),
  },
}

// Braccia: angolo a riposo [sinistro, destro]; positivo alza il sinistro e abbassa il destro.
const ARMS: Record<GluMood, [number, number]> = {
  idle: [-30, 30],
  hello: [-30, -65],
  thirsty: [-48, 48],
  drink: [-30, 30],
  goal: [42, -42],
  sad: [-55, 55],
  sleep: [-45, 45],
  levelup: [48, -48],
}

const STAR_MOODS = new Set<GluMood>(['goal', 'levelup'])
const BLINK_MOODS = new Set<GluMood>(['idle', 'hello', 'thirsty', 'sad'])

function eyeTarget(mood: GluMood, blink: boolean) {
  if (STAR_MOODS.has(mood)) return { scaleY: 0.2, opacity: 0 }
  if (mood === 'sleep' || mood === 'drink') return { scaleY: 0.1, opacity: 0 }
  if (blink) return { scaleY: 0.1, opacity: 1 }
  return { scaleY: mood === 'thirsty' ? 0.6 : 1, opacity: 1 }
}

function cheekOpacity(mood: GluMood, blush: boolean): number {
  if (blush) return 1
  if (mood === 'sad' || mood === 'sleep') return 0.6
  return 0.9
}

const TAP_VARIANTS = { rest: { y: 0 }, hopA: { y: [0, -16, 0] }, hopB: { y: [0, -16, 0] } }

export function Glu({ mood, fill, size = 160, onTap }: GluProps) {
  const clip = useId()
  const [reduced] = useState(prefersReducedMotion)
  const [blink, setBlink] = useState(false)
  const [taps, setTaps] = useState(0)
  const [blush, setBlush] = useState(false)
  const lastTap = useRef(-Infinity)

  const level = Number.isNaN(fill) ? 0 : Math.min(1, Math.max(0, fill))
  const waterY = WATER_EMPTY - level * (WATER_EMPTY - WATER_FULL)

  // Sbatte le palpebre a intervalli casuali, mai con «Riduci movimento».
  const canBlink = !reduced && BLINK_MOODS.has(mood)
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
          }, 150)
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

  useEffect(() => {
    if (!blush) return
    const timer = window.setTimeout(() => setBlush(false), 700)
    return () => window.clearTimeout(timer)
  }, [blush])

  const handleTap = () => {
    const now = Date.now()
    if (now - lastTap.current < 1000) return
    lastTap.current = now
    setTaps((n) => n + 1)
    setBlush(true)
    onTap?.()
  }

  const body = BODY_POSE[mood]
  const moving = !reduced && body.move
  const [leftArm, rightArm] = ARMS[mood]
  const waving = mood === 'hello' && !reduced
  const eyes = eyeTarget(mood, blink)
  const lid = LID[mood]
  const stars = STAR_MOODS.has(mood)
  // Con «Riduci movimento» anche bocca, palpebre e guance cambiano di colpo.
  const ease = (t: Transition): Transition => (reduced ? { duration: 0 } : t)
  const classes = ['glu', level >= 0.4 && 'glu-lively', level >= 1 && 'glu-full'].filter(Boolean).join(' ')

  const eye = (cx: number, mirror: boolean) => (
    <g transform={`translate(${cx} 118)`}>
      <m.g className="glu-eye" initial={false} animate={eyes} transition={ease({ duration: blink ? 0.07 : 0.2 })}>
        <ellipse className="glu-eye-ball" rx="11" ry="13.5" />
        <circle className="glu-eye-shine" cx="4" cy="-5" r="4.6" />
        <circle className="glu-eye-shine" cx="-4" cy="5.5" r="2" />
      </m.g>
      <g transform={mirror ? 'scale(-1 1)' : undefined}>
        <m.path
          className="glu-lid"
          initial={false}
          animate={{ d: lid ?? LID_CLOSED, opacity: lid ? 1 : 0 }}
          transition={ease({ duration: 0.25 })}
        />
      </g>
      {stars && (
        <m.path
          className="glu-star"
          d={STAR}
          initial={reduced ? false : { scale: 0, rotate: -120 }}
          animate={reduced ? { scale: 1.15 } : { scale: [1.1, 1.3, 1.1], rotate: 0 }}
          transition={reduced ? undefined : { scale: loop(1.1), rotate: SPRING }}
        />
      )}
    </g>
  )

  return (
    <svg
      className={classes}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden="true"
      data-testid="glu"
      data-mood={mood}
      data-tappable={onTap ? '' : undefined}
      onClick={handleTap}
    >
      <defs>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <ellipse className="glu-shadow" cx="100" cy="190" rx="54" ry="7" />
      <m.g
        variants={TAP_VARIANTS}
        initial={false}
        animate={taps === 0 ? 'rest' : taps % 2 ? 'hopA' : 'hopB'}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <m.g
          className="glu-pose"
          style={{ originX: 0.5, originY: 1 }}
          initial={false}
          animate={moving ? body.move : body.still}
          transition={moving ? body.transition : SPRING}
        >
          <path className="glu-body" d={BODY} />
          <g clipPath={`url(#${clip})`}>
            <rect className="glu-water" x="0" y={waterY} width="200" height={200 - waterY} />
            <g className="glu-wave-level" style={{ transform: `translateY(${waterY}px)` }}>
              <g className="glu-wave">
                <path className="glu-wave-fill" d={WAVE_FILL} />
                <path className="glu-wave-line" d={WAVE_LINE} />
              </g>
            </g>
          </g>
          <path className="glu-outline" d={BODY} />
          <path className="glu-gloss" d="M58 106 Q58 86 76 66" />
          <circle className="glu-gloss-dot" cx="56" cy="120" r="3.5" />
          {level >= 1 && <path className="glu-shine" d={SPARKLE} transform="translate(140 92) scale(0.8)" />}

          <m.path
            className="glu-arm glu-arm-left"
            d={LEFT_ARM}
            style={{ originX: 0.78, originY: 0.5 }}
            initial={false}
            animate={{ rotate: leftArm }}
            transition={SPRING}
          />
          <m.path
            className="glu-arm glu-arm-right"
            d={RIGHT_ARM}
            style={{ originX: 0.22, originY: 0.5 }}
            initial={false}
            animate={{ rotate: waving ? [rightArm, rightArm - 30, rightArm] : rightArm }}
            transition={waving ? loop(0.5, { repeatType: 'loop' }) : SPRING}
          />

          <m.ellipse
            className="glu-cheek"
            cx="64"
            cy="134"
            rx="10"
            ry="6"
            initial={false}
            animate={{ opacity: cheekOpacity(mood, blush) }}
            transition={ease({ duration: 0.25 })}
          />
          <m.ellipse
            className="glu-cheek"
            cx="138"
            cy="134"
            rx="10"
            ry="6"
            initial={false}
            animate={{ opacity: cheekOpacity(mood, blush) }}
            transition={ease({ duration: 0.25 })}
          />
          {eye(80, false)}
          {eye(122, true)}
          <m.path className="glu-mouth" initial={false} animate={{ d: MOUTH[mood] }} transition={ease({ duration: 0.3 })} />
          {mood === 'thirsty' && (
            <m.g
              className="glu-tongue"
              style={{ originX: 0.5, originY: 0 }}
              initial={reduced ? false : { scaleY: 0 }}
              animate={reduced ? { scaleY: 1 } : { scaleY: [1, 1.12, 1] }}
              transition={reduced ? undefined : loop(0.9)}
            >
              <path d="M95 142 C95 157 108 157 108 142 Z" />
              <path className="glu-tongue-line" d="M101.5 144 V150" />
            </m.g>
          )}
          {mood === 'sad' && (
            <g transform="translate(128 132)">
              <m.path
                className="glu-tear"
                d={TEAR}
                initial={false}
                animate={reduced ? { y: 4, opacity: 1 } : { y: [0, 18], opacity: [0, 1, 1, 0] }}
                transition={reduced ? undefined : loop(1.8, { ease: 'easeIn' })}
              />
            </g>
          )}
        </m.g>
      </m.g>

      {mood === 'drink' && !reduced && (
        <g transform="translate(106 18)">
          {[-1, 0, 1].map((dir) => (
            <m.circle
              key={dir}
              className="glu-splash"
              r={dir === 0 ? 4 : 3}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{ x: dir * 22, y: dir === 0 ? -26 : -14, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          ))}
        </g>
      )}
      {mood === 'sleep' && (
        <g className="glu-zzz" transform="translate(150 56)">
          {[0, 1, 2].map((i) => (
            <m.path
              key={i}
              d={ZED}
              initial={false}
              animate={
                reduced
                  ? { x: i * 12, y: -i * 16, scale: 0.8 + i * 0.25, opacity: 1 }
                  : { x: [0, 14, 22], y: [0, -22, -44], scale: [0.6, 1, 1.4], opacity: [0, 1, 0] }
              }
              transition={reduced ? undefined : loop(2.4, { ease: 'easeOut', delay: i * 0.8 })}
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
              initial={false}
              animate={reduced ? { scale: 1 } : { scale: [0, 1, 0], rotate: [0, 90] }}
              transition={reduced ? undefined : loop(1.4, { delay: i * 0.35 })}
            />
          </g>
        ))}
    </svg>
  )
}

const SPARKLES: [number, number, number][] = [
  [34, 50, 1.1],
  [168, 44, 0.9],
  [16, 150, 0.8],
  [186, 128, 1],
]
