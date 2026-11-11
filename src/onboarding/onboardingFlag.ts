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

export const isOnboarded = (userId: string) => readCache<boolean>(key(userId)) === true

const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000

/**
 * Account registrato da più di 24 ore (stessa soglia di `set_initial_goal`): chi lo usa già
 * non rifà il primo avvio da capo su un telefono nuovo. Data ignota = nuovo.
 */
export function isEstablishedAccount(createdAt?: string, now = Date.now()): boolean {
  const created = createdAt ? Date.parse(createdAt) : NaN
  return Number.isFinite(created) && now - created > NEW_ACCOUNT_MS
}

export function pendingOnboardingStep(userId: string, scheduleCount: number, createdAt?: string): OnboardingStep | null {
  if (isOnboarded(userId)) return null
  if (scheduleCount === 0 && isEstablishedAccount(createdAt)) return 'schedule'
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
  if (isOnboarded(userId)) return null
  const done = readCache<OnboardingStep>(progressKey(userId))
  return done && STEPS.includes(done) ? nextOnboardingStep(done) : null
}
