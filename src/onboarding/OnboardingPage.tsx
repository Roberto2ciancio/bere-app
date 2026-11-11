import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { isPushOff, pushSupportState } from '../push/subscribe'
import { listSchedules } from '../schedules/schedulesApi'
import { useGoalMl } from '../schedules/useGoalMl'
import { markOnboarded, nextOnboardingStep, pendingOnboardingStep, resumedOnboardingStep, saveOnboardingProgress, type OnboardingStep } from './onboardingFlag'
import { AvatarStep } from './steps/AvatarStep'
import { CupStep } from './steps/CupStep'
import { FirstDrinkStep } from './steps/FirstDrinkStep'
import { GoalStep } from './steps/GoalStep'
import { HelloStep } from './steps/HelloStep'
import { NotificationsStep } from './steps/NotificationsStep'
import { ScheduleStep } from './steps/ScheduleStep'

// I nomi dei passi richiesti da fuori (Home, /notifiche) coincidono con quelli di STEPS.
const alreadyOn = () => pushSupportState() === 'granted' && !isPushOff()
// Con le notifiche già attive su questo telefono il passo non serve.
const skipNotifications = (step: OnboardingStep): OnboardingStep => (step === 'notifications' && alreadyOn() ? 'first-drink' : step)

/** Carica quanti programmi esistono, così il primo avvio riparte dal passo giusto. */
export function OnboardingPage() {
  const { user } = useAuth()
  const requested = (useLocation().state as { step?: OnboardingStep } | null)?.step
  const userId = user?.id ?? null
  const [scheduleCount, setScheduleCount] = useState<number | null>(requested || !userId ? 0 : null)

  useEffect(() => {
    if (scheduleCount !== null || !userId) return
    let active = true
    listSchedules(userId)
      .then((list) => active && setScheduleCount(list.length))
      .catch(() => active && setScheduleCount(0))
    return () => {
      active = false
    }
  }, [scheduleCount, userId])

  if (scheduleCount === null) return null
  return <Onboarding scheduleCount={scheduleCount} requested={requested} />
}

function Onboarding({ scheduleCount, requested }: { scheduleCount: number; requested?: OnboardingStep }) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const navigate = useNavigate()
  const userId = user?.id ?? null
  const tz = profile?.tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
  const currentGoalMl = useGoalMl(userId, tz)
  const [chosenGoalMl, setChosenGoalMl] = useState<number | null>(null)
  const goalMl = chosenGoalMl ?? currentGoalMl
  const [notArrived, setNotArrived] = useState(false)

  // Senza un passo richiesto si riparte dal primo non concluso.
  const [step, setStep] = useState<OnboardingStep>(() => skipNotifications(requested ?? (userId ? (pendingOnboardingStep(userId, scheduleCount) ?? resumedOnboardingStep(userId)) : null) ?? 'hello'))

  // Ogni passo concluso o saltato si ricorda: chi chiude l'app riparte dal successivo.
  function advance(from: OnboardingStep) {
    if (userId) saveOnboardingProgress(userId, from)
    const next = nextOnboardingStep(from)
    if (next) setStep(skipNotifications(next))
    else leave()
  }
  const after = (from: OnboardingStep) => () => advance(from)

  function leave() {
    if (userId) markOnboarded(userId)
    navigate(notArrived ? '/notifiche' : '/home', { replace: true })
  }

  if (step === 'hello') return <HelloStep onNext={after('hello')} />
  if (step === 'avatar') return <AvatarStep onNext={after('avatar')} />
  if (step === 'goal') return <GoalStep tz={tz} onGoal={setChosenGoalMl} onNext={after('goal')} />
  if (step === 'cup') return <CupStep goalMl={goalMl} onNext={after('cup')} />
  if (step === 'schedule') return <ScheduleStep goalMl={goalMl} onNext={after('schedule')} />
  if (step === 'notifications') {
    return (
      <NotificationsStep
        onNext={(arrived) => {
          if (!arrived) setNotArrived(true)
          advance('notifications')
        }}
      />
    )
  }
  return <FirstDrinkStep tz={tz} drinkMl={profile?.drink_ml ?? 200} onNext={leave} />
}
