import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { localParts } from '../domain/time'
import { PAUSE_CHOICES, pauseEndLabel } from './pauses'
import { usePauses } from './usePauses'

const daysLabel = (n: number) => (n === 1 ? 'Oggi' : `${n} giorni`)

/** Modalità pausa: per vacanza o malattia niente notifiche, e la serie resta. */
export function PauseForm() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const tz = profile?.tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = localParts(new Date(), tz).date
  const { current, start, resume } = usePauses(user?.id ?? null, today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<boolean>) {
    setBusy(true)
    setError(null)
    if (!(await action())) setError('Salvataggio non riuscito. Controlla la connessione e riprova')
    setBusy(false)
  }

  return (
    <div className="pause">
      <h3>Pausa</h3>
      {current ? (
        <>
          <p className="pause-on" role="status">
            ⏸️ Notifiche in pausa {pauseEndLabel(current.end_date, today)}. La tua serie non si rompe.
          </p>
          <button className="secondary" disabled={busy} onClick={() => void run(resume)}>Riprendi adesso</button>
        </>
      ) : (
        <>
          <p className="hint">In vacanza o non stai bene? Niente notifiche per qualche giorno e la serie non si rompe.</p>
          <div className="pause-choices" role="group" aria-label="Durata della pausa">
            {PAUSE_CHOICES.map((n) => (
              <button key={n} className="choice" disabled={busy} onClick={() => void run(() => start(n))}>{daysLabel(n)}</button>
            ))}
          </div>
        </>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  )
}
