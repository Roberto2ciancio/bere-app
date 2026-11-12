import type { GluMood } from '../mascot/mood'
import type { GluExtras } from '../mascot/Glu'
import type { CrownTier } from '../mascot/reactions'

export interface PoseInput {
  mood: GluMood
  extras: GluExtras
  fill: number
  t: number // s, orologio
  moodT: number // s dall'inizio dell'umore
  calm: boolean
  still: boolean
}

export interface Pose {
  scaleY: number
  jumpY: number // unità scena, 0 a terra
  shakeX: number
  lookY: number // rad
  armL: number
  armR: number // rad: 0 giù, Math.PI su
  eyeOpen: number // 0..1
  mouth: 'smile' | 'big' | 'open' | 'small'
  bodyColor: string // hex
  waterLevel: number // 0..1
  waterTilt: number // gradi
  headband: boolean
  sweat: boolean
  crown: CrownTier
  crownDropY: number // 0 = in testa
  fan: boolean
  zzz: boolean
}

export const HELLO_S = 2
export const JUMP_S = 0.6

const BODY = [0xcf, 0xeb, 0xfb]
const THIRSTY = [0x9d, 0xb4, 0xc4]
const JUMP_H = 0.35

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

function mixColor(k: number): string {
  return (
    '#' +
    BODY.map((c, i) => Math.round(c + (THIRSTY[i] - c) * k).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

/** Salto parabolico: 0 a terra, picco a metà di `dur`. */
function hop(x: number, dur: number, h: number): number {
  if (x <= 0 || x >= dur) return 0
  const u = x / dur
  return 4 * u * (1 - u) * h
}

export function poseFor(input: PoseInput): Pose {
  const { mood, extras, fill, calm, still } = input
  // Da fermo: nessun movimento nel tempo, animazioni all'ultimo fotogramma.
  const t = still ? 0 : input.t
  const moodT = still ? 1e6 : input.moodT
  const thirst = calm ? 0 : clamp01(extras.thirst ?? 0)

  let jumpY = 0
  let armL = 0
  let armR = 0
  let mouth: Pose['mouth'] = 'smile'
  let eyeOpen = 1
  let lookY = still ? 0 : 0.25 * Math.sin(t / 3)
  let zzz = false

  // Ciglia: ogni 4,5 s gli occhi scendono a 0,1 per 0,12 s.
  if (!still && t % 4.5 < 0.12) eyeOpen = 0.1

  switch (mood) {
    case 'hello':
      if (moodT < HELLO_S) {
        armR = Math.PI * 0.75 + 0.35 * Math.sin(moodT * 10) // saluta con la mano
        mouth = 'big'
      }
      break
    case 'drink':
      jumpY = hop(moodT, JUMP_S, JUMP_H)
      if (moodT < 0.9) armL = armR = Math.PI
      else if (moodT < 1.2) armL = armR = Math.PI * (1 - (moodT - 0.9) / 0.3)
      mouth = 'big'
      break
    case 'goal':
    case 'levelup':
      jumpY = hop(moodT, JUMP_S, JUMP_H) + hop(moodT - JUMP_S, JUMP_S, JUMP_H)
      if (moodT < 2 * JUMP_S + 0.4) armL = armR = Math.PI
      mouth = 'big'
      break
    case 'almost':
      lookY = still ? 0 : 0.35 * Math.sin(t * 1.2)
      break
    case 'sad':
      eyeOpen = 0.6
      mouth = 'small'
      break
    case 'sleep':
      eyeOpen = 0
      zzz = true
      mouth = 'small'
      break
    case 'coffee':
      eyeOpen = 1
      mouth = 'open'
      break
    case 'workout':
      jumpY = hop(moodT, 0.3, 0.15) + hop(moodT - 0.5, 0.3, 0.15)
      if (moodT < 1.2) armL = armR = Math.PI * 0.5
      mouth = 'open'
      break
    case 'thirsty':
      mouth = 'small'
      break
    default:
      break
  }

  const breath = still ? 0 : 0.02 * (1 - thirst) * Math.sin(t * 2)
  const scaleY = 1 - 0.08 * thirst + breath
  // Con la sete gli occhi si socchiudono (non con gli occhi spalancati del caff�).
  if (mood !== 'coffee') eyeOpen = Math.min(eyeOpen, 1 - 0.5 * thirst)
  if (thirst > 0.5 && (mood === 'idle' || mood === 'thirsty')) mouth = 'small'

  const shakeX = !calm && extras.jitter && !still ? 0.03 * Math.sin(t * 60) : 0

  const crown = extras.crown ?? 0
  const crownDropY = extras.crownDrop && moodT < 1.5 ? 1.2 * (1 - moodT / 1.5) ** 2 : 0

  return {
    scaleY,
    jumpY,
    shakeX,
    lookY,
    armL,
    armR,
    eyeOpen,
    mouth,
    bodyColor: mixColor(thirst),
    waterLevel: fill,
    waterTilt: calm ? 0 : -(extras.tilt ?? 0),
    headband: !!extras.headband,
    sweat: !calm && !!extras.sweat,
    crown,
    crownDropY,
    fan: !calm && (!!extras.fan || (extras.thirst ?? 0) >= 1),
    zzz,
  }
}
