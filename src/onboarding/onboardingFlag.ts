import { readCache, writeCache } from '../lib/cache'
import { pushSupportState } from '../push/subscribe'

export type OnboardingStep = 'schedule' | 'notifications'

const key = (userId: string) => `bere.onboarded.${userId}`

// Vale per telefono: su un telefono nuovo le notifiche vanno attivate di nuovo.
export const markOnboarded = (userId: string) => writeCache(key(userId), true)

export function pendingOnboardingStep(userId: string, scheduleCount: number): OnboardingStep | null {
  if (readCache<boolean>(key(userId))) return null
  if (scheduleCount === 0) return 'schedule'
  return pushSupportState() === 'prompt' ? 'notifications' : null
}
