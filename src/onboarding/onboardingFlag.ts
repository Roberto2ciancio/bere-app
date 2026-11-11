import { readCache, writeCache } from '../lib/cache'
import { pushSupportState } from '../push/subscribe'

export const STEPS = ['hello', 'avatar', 'goal', 'cup', 'schedule', 'notifications', 'first-drink'] as const
export type OnboardingStep = (typeof STEPS)[number]

const key = (userId: string) => `bere.onboarded.${userId}`
const progressKey = (userId: string) => `bere.onboardingStep.${userId}`

// Vale per telefono: su un telefono nuovo le notifiche vanno attivate di nuovo.
export const markOnboarded = (userId: string) => writeCache(key(userId), true)

/** Ultimo passo concluso (o saltato): chi chiude l'app a metà riparte dal successivo. */
export const saveOnboardingProgress = (userId: string, step: OnboardingStep) => writeCache(progressKey(userId), step)

export function nextOnboardingStep(step: OnboardingStep): OnboardingStep | null {
  return STEPS[STEPS.indexOf(step) + 1] ?? null
}

export function pendingOnboardingStep(userId: string, scheduleCount: number): OnboardingStep | null {
  if (readCache<boolean>(key(userId))) return null
  if (scheduleCount === 0) {
    const done = readCache<OnboardingStep>(progressKey(userId))
    const next = done && STEPS.includes(done) ? nextOnboardingStep(done) : 'hello'
    // Senza programmi non ha senso andare oltre i promemoria.
    return next && STEPS.indexOf(next) <= STEPS.indexOf('schedule') ? next : 'schedule'
  }
  return pushSupportState() === 'prompt' ? 'notifications' : null
}

/** Chi ha già programmi e notifiche ma non ha finito riparte dopo l'ultimo passo concluso. */
export function resumedOnboardingStep(userId: string): OnboardingStep | null {
  if (readCache<boolean>(key(userId))) return null
  const done = readCache<OnboardingStep>(progressKey(userId))
  return done && STEPS.includes(done) ? nextOnboardingStep(done) : null
}
