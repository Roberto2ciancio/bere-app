import { useState } from 'react'
import { Bubble } from '../mascot/Bubble'
import { Glu, type GluExtras } from '../mascot/Glu'
import type { GluMood } from '../mascot/mood'
import { phraseFor, specialPhraseFor, type SpecialPhrase } from '../mascot/phrases'
import type { CrownTier } from '../mascot/reactions'
import { TiltInvite } from '../mascot/TiltInvite'
import { useTilt } from '../mascot/useTilt'
import { prefersReducedMotion } from '../ui/motion/effects'
import { ProgressRing } from './ProgressRing'

interface Props {
  fill: number
  mood: GluMood
  name: string
  now: number
  extras?: GluExtras
  /** Traguardo della serie appena raggiunto: il fumetto lo festeggia. */
  streakCelebrate?: CrownTier | null
  /** Frase dell'allenamento appena segnato (con l'unità dell'utente). */
  workoutText?: string
  /** Caffè oltre il limite di caffeina del giorno. */
  coffeeOver?: boolean
  /** «Glu tranquillo»: l'acqua non segue il telefono. */
  calm?: boolean
}

/** Frase su misura se c'è un motivo (festa della corona, sete forte, allenamento, troppa caffeina). */
function variantFor({ mood, extras, streakCelebrate, workoutText, coffeeOver }: Props): SpecialPhrase | 'workout' | null {
  if (mood === 'drink' || mood === 'levelup') return null
  if (streakCelebrate) return `streak${streakCelebrate}`
  if (mood === 'workout' && workoutText) return 'workout'
  if (mood === 'coffee' && coffeeOver) return 'coffeeOver'
  if (mood === 'thirsty' && (extras?.thirst ?? 0) >= 1) return 'thirstyStrong'
  return null
}

/** Glu dentro l'anello del progresso, che si riempie d'acqua e dice la sua nel fumetto. */
export function GluView(props: Props) {
  const { fill, mood, name, now, extras, workoutText, calm = false } = props
  const variant = variantFor(props)
  const pick = () => (variant === 'workout' ? (workoutText ?? '') : variant ? specialPhraseFor(variant, now) : phraseFor(mood, name, now))
  // La frase si sceglie quando cambia l'umore, il nome o il motivo, non a ogni render.
  const [chosen, setChosen] = useState(() => ({ mood, name, variant, text: pick() }))
  let text = chosen.text
  if (chosen.mood !== mood || chosen.name !== name || chosen.variant !== variant) {
    text = pick()
    setChosen({ mood, name, variant, text })
  }
  const [reduced] = useState(prefersReducedMotion)
  const still = calm || reduced
  const { tilt, needsPermission, permission, request, dismiss } = useTilt(!still)
  // Con Glu pieno e molto inclinato un lato resterebbe vuoto in cima: l'ampiezza si dimezza.
  const waterTilt = fill >= 0.95 ? tilt * 0.5 : tilt
  const glu = tilt ? { ...extras, tilt: waterTilt } : extras
  return (
    <div className="glu-box" data-testid="glu-view">
      <Bubble text={text} />
      <div className="ring-slot">
        <ProgressRing fill={fill} wide>
          <Glu mood={mood} fill={fill} size={186} extras={glu} />
        </ProgressRing>
      </div>
      {needsPermission && permission === null && !still && <TiltInvite onAccept={() => void request()} onDismiss={dismiss} />}
    </div>
  )
}
