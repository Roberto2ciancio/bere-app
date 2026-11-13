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
  /** Camminata: fase in cicli (due passi per ciclo) e verso. */
  walk?: { phase: number; dir: -1 | 0 | 1 }
  /** Tinta del corpo della variante (hex); assente: Glu classico. */
  baseBody?: string
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
  stepL: number // 0..1, piede sinistro alzato
  stepR: number
  bob: number // unità scena, ondeggio verticale del corpo
  turnY: number // rad, rotazione del corpo verso il verso di marcia
}

export const HELLO_S = 2
export const JUMP_S = 0.6
export const WALK_TURN = 0.6

const BODY_CLASSIC = '#CFEBFB'
const THIRSTY = [0x9d, 0xb4, 0xc4]
const JUMP_H = 0.35
// Le varianti non diventano grigie del tutto: con sete 1 conservano un po' della loro tinta.
const VARIANT_THIRST = 0.8

/** Umori che muovono le braccia da soli: il ventaglio non li sovrascrive. */
const ARM_MOODS = new Set<GluMood>(['hello', 'drink', 'goal', 'levelup', 'workout'])

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

function mixColor(base: string, k: number): string {
  const n = parseInt(base.slice(1), 16)
  const body = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return (
    '#' +
    body.map((c, i) => Math.round(c + (THIRSTY[i] - c) * k).toString(16).padStart(2, '0'))
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
  // Con la sete gli occhi si socchiudono (non con gli occhi spalancati del caffè).
  if (mood !== 'coffee') eyeOpen = Math.min(eyeOpen, 1 - 0.5 * thirst)
  if (thirst > 0.5 && (mood === 'idle' || mood === 'thirsty')) mouth = 'small'

  const shakeX = !calm && extras.jitter && !still ? 0.03 * Math.sin(t * 60) : 0

  // Ventaglio: Glu si fa vento col braccio destro, se l'umore non muove già le braccia.
  const fan = !calm && (!!extras.fan || (extras.thirst ?? 0) >= 1)
  if (fan && !ARM_MOODS.has(mood)) armR = 0.6 * Math.PI + (still ? 0 : 0.25 * Math.sin(8 * t))

  // Camminata: passi alternati e ondeggio; da fermo niente passi ma Glu guarda il verso.
  const walk = input.walk
  const wave = walk && !still ? Math.sin(walk.phase * Math.PI * 4) : 0
  const stepL = Math.max(0, wave)
  const stepR = Math.max(0, -wave)
  const bob = 0.03 * Math.abs(wave)
  const turnY = walk ? walk.dir * WALK_TURN : 0

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
    bodyColor: mixColor(input.baseBody ?? BODY_CLASSIC, input.baseBody ? thirst * VARIANT_THIRST : thirst),
    waterLevel: fill,
    waterTilt: calm ? 0 : -(extras.tilt ?? 0),
    headband: !!extras.headband,
    sweat: !calm && !!extras.sweat,
    crown,
    crownDropY,
    fan,
    zzz,
    stepL,
    stepR,
    bob,
    turnY,
  }
}
