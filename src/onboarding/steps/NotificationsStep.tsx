import { useState, type ReactNode } from 'react'
import type { GluMood } from '../../mascot/mood'
import { InstallGuide } from '../../push/InstallGuide'
import { pushSupportState, sendTestPush, subscribePush, syncPushSubscription } from '../../push/subscribe'
import { OnboardingShell } from '../OnboardingShell'

interface Props {
  /** `arrived` è false solo se la prova è partita ma l'utente non l'ha vista arrivare. */
  onNext: (arrived: boolean) => void
}

export function NotificationsStep({ onNext }: Props) {
  const [pushState, setPushState] = useState(() => pushSupportState())
  const [asked, setAsked] = useState(false)
  const [retryTest, setRetryTest] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const done = () => onNext(true)

  async function sendTest() {
    setBusy(true)
    setError(null)
    try {
      await syncPushSubscription()
    } catch {
      setRetryTest(true)
      setError('Non riesco a registrare questo telefono. Controlla la connessione e riprova.')
      setBusy(false)
      return
    }
    const result = await sendTestPush()
    if (result === 'sent') setAsked(true)
    else {
      setRetryTest(true)
      setError(result === 'no-device' ? 'Questo telefono non risulta registrato. Riprova tra poco.' : 'La notifica di prova non è partita. Riprova tra poco.')
    }
    setBusy(false)
  }

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      await subscribePush()
    } catch {
      const next = pushSupportState()
      setPushState(next)
      if (next !== 'denied') setError('Non è stato possibile attivare le notifiche. Controlla la connessione e riprova.')
      setBusy(false)
      return
    }
    // La prova parte da sola: subito dopo Glu chiede «Arrivata?».
    await sendTest()
  }

  const shell = (mood: GluMood, say: string, nextLabel: string, onClick: () => void, body: ReactNode, skip?: { label: string; onClick: () => void }) => (
    <OnboardingShell step="notifications" mood={mood} say={say} nextLabel={nextLabel} nextDisabled={busy} onNext={onClick} onSkip={skip?.onClick} skipLabel={skip?.label}>
      {body}
    </OnboardingShell>
  )

  if (pushState === 'needs-install') return shell('idle', 'Prima di tutto va installata l’app', 'Continua', done, <InstallGuide />)
  if (pushState === 'unsupported') {
    return shell('sad', 'Qui le notifiche non arrivano', 'Continua', done, (
      <>
        <h1 className="ob-title">Notifiche non disponibili</h1>
        <p>Questo browser non può ricevere notifiche. Su iPhone serve iOS 16.4 o successivo e l'app installata da Safari.</p>
      </>
    ))
  }
  if (pushState === 'denied') {
    return shell('sad', 'Le notifiche sono bloccate', 'Continua senza notifiche', done, (
      <>
        <h1 className="ob-title">Notifiche bloccate</h1>
        <p className="error">Le notifiche sono bloccate.</p>
        <p>Riattivale dalle impostazioni del telefono, nelle notifiche di Bere o del browser, poi riapri l'app.</p>
      </>
    ))
  }

  if (asked) {
    return shell('hello', 'Arrivata?', 'Sì, è arrivata', done, (
      <>
        <h1 className="ob-title">Ti ho mandato una notifica</h1>
        <p>Dovrebbe comparire in pochi secondi, anche con l'app chiusa o il telefono bloccato.</p>
      </>
    ), { label: 'No, non è arrivata', onClick: () => onNext(false) })
  }

  return shell('thirsty', 'Altrimenti non posso ricordartelo!', retryTest ? 'Riprova la prova' : 'Attiva le notifiche', () => void (retryTest ? sendTest() : enable()), (
    <>
      <h1 className="ob-title">Attiva le notifiche</h1>
      <p>Senza il tuo permesso i promemoria non possono arrivare.</p>
      {error && <p role="alert" className="error">{error}</p>}
    </>
  ), { label: 'Salta', onClick: done })
}
