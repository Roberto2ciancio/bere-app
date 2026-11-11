import type { ReactNode } from 'react'
import { Bubble } from '../mascot/Bubble'
import { Glu } from '../mascot/Glu'
import type { GluMood } from '../mascot/mood'
import { STEPS, type OnboardingStep } from './onboardingFlag'

const DROP = 'M10 1C6 6 3 9.5 3 13.5a7 7 0 0 0 14 0C17 9.5 14 6 10 1z'

interface Props {
  step: OnboardingStep
  mood: GluMood
  say: string
  children?: ReactNode
  onNext: () => void
  onSkip?: () => void
  nextLabel: string
  nextDisabled?: boolean
}

/** Cornice dei passi del primo avvio: barra a gocce, Glu col fumetto, azioni in basso. */
export function OnboardingShell({ step, mood, say, children, onNext, onSkip, nextLabel, nextDisabled }: Props) {
  const number = STEPS.indexOf(step) + 1
  const label = `Passo ${number} di ${STEPS.length}`
  return (
    <main className="onboarding">
      <div className="ob-progress" role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={number} aria-valuetext={label}>
        {STEPS.map((id, i) => (
          <svg key={id} viewBox="0 0 20 20" aria-hidden="true" data-done={i < number}>
            <path d={DROP} />
          </svg>
        ))}
      </div>
      <div className="ob-stage">
        <Bubble text={say} />
        <div className="ob-glu">
          <Glu mood={mood} fill={number / STEPS.length} size={150} />
        </div>
      </div>
      <div className="ob-body">{children}</div>
      <div className="ob-actions">
        <button className="primary" disabled={nextDisabled} onClick={onNext}>{nextLabel}</button>
        {onSkip && <button className="ghost" onClick={onSkip}>Salta</button>}
      </div>
    </main>
  )
}
