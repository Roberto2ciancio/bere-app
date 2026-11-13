import { useEffect, useRef, type ReactNode } from 'react'
import { Bubble } from '../mascot/Bubble'
import { Glu } from '../mascot/Glu'
import type { GluMood } from '../mascot/mood'
import { useGluVariant } from '../mascot/useGluVariant'
import { STEPS, type OnboardingStep } from './onboardingFlag'

const DROP = 'M10 1C6 6 3 9.5 3 13.5a7 7 0 0 0 14 0C17 9.5 14 6 10 1z'

interface Props {
  step: OnboardingStep
  mood: GluMood
  say: string
  /** Titolo del passo, letto dagli screen reader; i passi che ne mostrano già uno non lo passano. */
  title?: string
  children?: ReactNode
  onNext: () => void
  onSkip?: () => void
  skipLabel?: string
  nextLabel: string
  nextDisabled?: boolean
}

/** Cornice dei passi del primo avvio: barra a gocce, Glu col fumetto, azioni in basso. */
export function OnboardingShell({ step, mood, say, title, children, onNext, onSkip, skipLabel = 'Salta', nextLabel, nextDisabled }: Props) {
  const variant = useGluVariant()
  const number = STEPS.indexOf(step) + 1
  const label = `Passo ${number} di ${STEPS.length}`
  const main = useRef<HTMLElement>(null)
  // Ogni passo è un componente nuovo: il fuoco passa al suo titolo, non resta sul pulsante sparito.
  useEffect(() => {
    main.current?.querySelector<HTMLElement>('h1')?.focus()
  }, [])
  return (
    <main className="onboarding" ref={main}>
      {title && <h1 className="visually-hidden" tabIndex={-1}>{title}</h1>}
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
          <Glu mood={mood} fill={number / STEPS.length} size={150} variant={variant} />
        </div>
      </div>
      <div className="ob-body">{children}</div>
      <div className="ob-actions">
        <button className="primary" disabled={nextDisabled} onClick={onNext}>{nextLabel}</button>
        {onSkip && <button className="ghost" onClick={onSkip}>{skipLabel}</button>}
      </div>
    </main>
  )
}
