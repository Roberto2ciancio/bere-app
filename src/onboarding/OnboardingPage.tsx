import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { InstallGuide } from '../push/InstallGuide'
import { isPushOff, pushSupportState, sendTestPush, subscribePush, syncPushSubscription } from '../push/subscribe'
import { IntervalCreator } from '../schedules/IntervalCreator'
import { ScheduleEditor } from '../schedules/ScheduleEditor'
import { saveSchedule, type ScheduleDraft } from '../schedules/schedulesApi'
import { useGoalMl } from '../schedules/useGoalMl'
import { markOnboarded, nextOnboardingStep, pendingOnboardingStep, saveOnboardingProgress, type OnboardingStep } from './onboardingFlag'
import { AvatarStep } from './steps/AvatarStep'
import { CupStep } from './steps/CupStep'
import { GoalStep } from './steps/GoalStep'
import { HelloStep } from './steps/HelloStep'

// Passi 5-7: per ora restano le schermate di prima (promemoria, notifiche, prova), 'test' fa da passo 7.
type Step = Exclude<OnboardingStep, 'first-drink'> | 'test'
const LEGACY_NUMBER = { schedule: 5, notifications: 6, test: 7 }

const stepAfterSchedule = (): Step => (pushSupportState() === 'granted' && !isPushOff() ? 'test' : 'notifications')

export function OnboardingPage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const navigate = useNavigate()
  const requested = (useLocation().state as { step?: OnboardingStep } | null)?.step
  const userId = user?.id ?? null
  const tz = profile?.tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
  const currentGoalMl = useGoalMl(userId, tz)
  const [chosenGoalMl, setChosenGoalMl] = useState<number | null>(null)
  const goalMl = chosenGoalMl ?? currentGoalMl

  // Senza un passo richiesto si riparte dal primo non concluso.
  const [step, setStep] = useState<Step>(() => {
    const start = requested ?? (userId ? pendingOnboardingStep(userId, 0) : null) ?? 'hello'
    return start === 'first-drink' ? 'test' : start
  })
  const [manual, setManual] = useState(false)
  const [pushState, setPushState] = useState(() => pushSupportState())
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  // Ogni passo concluso o saltato si ricorda: chi chiude l'app riparte dal successivo.
  function advance(from: OnboardingStep, to: Step) {
    if (userId) saveOnboardingProgress(userId, from)
    setStep(to)
  }
  const after = (from: OnboardingStep) => () => advance(from, (nextOnboardingStep(from) as Step | null) ?? 'test')

  function leave(to: string) {
    if (userId) markOnboarded(userId)
    navigate(to, { replace: true })
  }

  async function createSchedule(draft: ScheduleDraft) {
    if (!userId) return
    await saveSchedule(userId, draft)
    setPushState(pushSupportState())
    advance('schedule', stepAfterSchedule())
  }

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      await subscribePush()
      advance('notifications', 'test')
    } catch {
      const next = pushSupportState()
      setPushState(next)
      if (next !== 'denied') setError('Non è stato possibile attivare le notifiche. Controlla la connessione e riprova.')
    }
    setBusy(false)
  }

  async function test() {
    setBusy(true)
    setError(null)
    setSent(false)
    try {
      await syncPushSubscription()
    } catch {
      setError('Non riesco a registrare questo telefono. Controlla la connessione e riprova.')
      setBusy(false)
      return
    }
    const result = await sendTestPush()
    if (result === 'sent') setSent(true)
    else if (result === 'no-device') setError('Questo telefono non risulta registrato. Riprova tra poco.')
    else setError('La notifica di prova non è partita. Riprova tra poco.')
    setBusy(false)
  }

  if (step === 'hello') return <HelloStep onNext={after('hello')} />
  if (step === 'avatar') return <AvatarStep onNext={after('avatar')} />
  if (step === 'goal') return <GoalStep tz={tz} onGoal={setChosenGoalMl} onNext={after('goal')} />
  if (step === 'cup') return <CupStep goalMl={goalMl} onNext={after('cup')} />

  if (step === 'schedule') {
    return (
      <main className="page">
        <p className="hint">Passo {LEGACY_NUMBER.schedule} di 7</p>
        <h1>Quando vuoi bere?</h1>
        <p>Imposta i promemoria come preferisci. Potrai cambiarli quando vuoi.</p>
        {manual ? (
          <ScheduleEditor
            initial={{ name: '', weekdays: [1, 2, 3, 4, 5, 6, 7], enabled: true, minutes: [] }}
            drinkMl={profile?.drink_ml ?? 200}
            goalMl={goalMl}
            onSave={createSchedule}
            onClose={() => setManual(false)}
          />
        ) : (
          <IntervalCreator
            activeWeekdays={[]}
            drinkMl={profile?.drink_ml ?? 200}
            goalMl={goalMl}
            onCreate={createSchedule}
            onManual={() => setManual(true)}
          />
        )}
        <button className="ghost" onClick={() => leave('/home')}>Più tardi</button>
      </main>
    )
  }

  if (step === 'notifications') {
    return (
      <main className="page">
        <p className="hint">Passo {LEGACY_NUMBER.notifications} di 7</p>
        {pushState === 'needs-install' && (
          <>
            <InstallGuide />
            <button className="secondary" onClick={() => leave('/home')}>Continua</button>
          </>
        )}
        {pushState === 'unsupported' && (
          <>
            <h1>Notifiche non disponibili</h1>
            <p>Questo browser non può ricevere notifiche. Su iPhone serve iOS 16.4 o successivo e l'app installata da Safari.</p>
            <button className="secondary" onClick={() => leave('/home')}>Continua</button>
          </>
        )}
        {pushState === 'denied' && (
          <>
            <h1>Notifiche bloccate</h1>
            <p className="error">Le notifiche sono bloccate.</p>
            <p>Riattivale dalle impostazioni del telefono, nelle notifiche di Bere o del browser, poi riapri l'app.</p>
            <button className="secondary" onClick={() => leave('/home')}>Continua senza notifiche</button>
          </>
        )}
        {(pushState === 'prompt' || pushState === 'granted') && (
          <>
            <h1>Attiva le notifiche</h1>
            <p>Senza il tuo permesso i promemoria non possono arrivare.</p>
            {error && <p role="alert" className="error">{error}</p>}
            <button className="primary" disabled={busy} onClick={() => void enable()}>Attiva le notifiche</button>
            <button className="ghost" onClick={() => leave('/home')}>Più tardi</button>
          </>
        )}
      </main>
    )
  }

  return (
    <main className="page">
      <p className="hint">Passo {LEGACY_NUMBER.test} di 7</p>
      <h1>Prova la notifica</h1>
      <p>Tocca il pulsante, poi chiudi l'app o blocca il telefono: dovrebbe arrivare in pochi secondi.</p>
      {error && <p role="alert" className="error">{error}</p>}
      {sent && <p role="status" className="hint">Notifica inviata: chiudi l'app e controlla che arrivi.</p>}
      <button className={sent ? 'secondary' : 'primary'} disabled={busy} onClick={() => void test()}>Invia notifica di prova</button>
      {sent ? (
        <>
          <button className="primary" onClick={() => leave('/home')}>È arrivata</button>
          <button className="ghost" onClick={() => leave('/notifiche')}>Non è arrivata</button>
        </>
      ) : (
        <button className="ghost" onClick={() => leave('/home')}>Salta la prova</button>
      )}
    </main>
  )
}
