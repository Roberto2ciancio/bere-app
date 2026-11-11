import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { localParts } from '../../domain/time'
import { useDrinks } from '../../drinks/useDrinks'
import type { GluMood } from '../../mascot/mood'
import { confetti, haptic } from '../../ui/motion/effects'
import { OnboardingShell } from '../OnboardingShell'

const CHEER_AFTER_MS = 900

type Phase = 'ready' | 'drinking' | 'cheer'
const SCENE: Record<Phase, [GluMood, string]> = {
  ready: ['idle', 'Registriamo il primo bicchiere?'],
  drinking: ['drink', 'Glu glu glu!'],
  cheer: ['goal', 'Evviva, il primo sorso è fatto!'],
}

interface Props {
  tz: string
  drinkMl: number
  /** Il test delle notifiche non è andato: alla fine si passa da /notifiche. */
  toNotifications?: boolean
  onNext: () => void
}

export function FirstDrinkStep({ tz, drinkMl, toNotifications = false, onNext }: Props) {
  const { user } = useAuth()
  // Stessa strada della Home: coda offline compresa.
  const [today] = useState(() => localParts(new Date(), tz).date)
  const { drink } = useDrinks(user?.id ?? null, today, tz, drinkMl)
  const [phase, setPhase] = useState<Phase>('ready')

  // Glu beve, poi festeggia.
  useEffect(() => {
    if (phase !== 'drinking') return
    const timer = setTimeout(() => setPhase('cheer'), CHEER_AFTER_MS)
    return () => clearTimeout(timer)
  }, [phase])

  function log() {
    if (!drink()) return
    haptic()
    confetti('small')
    setPhase('drinking')
  }

  const [mood, scene] = SCENE[phase]
  const say = phase === 'cheer' && toNotifications ? 'Evviva! Ora sistemiamo le notifiche' : scene
  return (
    <OnboardingShell
      step="first-drink"
      mood={mood}
      say={say}
      onNext={phase === 'ready' ? log : onNext}
      onSkip={phase === 'ready' ? onNext : undefined}
      nextLabel={phase === 'ready' ? 'Registra il primo bicchiere' : toNotifications ? 'Sistemiamo le notifiche' : 'Vai alla Home'}
      nextDisabled={phase === 'drinking'}
    >
      <div className="ob-first">
        <h1 className="ob-title">Primo sorso!</h1>
        <p>{phase === 'ready' ? `Un tocco registra ${drinkMl} ml d'acqua.` : `Registrati ${drinkMl} ml d'acqua. ${toNotifications ? 'Ora sistemiamo le notifiche.' : 'Ci vediamo nella Home!'}`}</p>
      </div>
    </OnboardingShell>
  )
}
