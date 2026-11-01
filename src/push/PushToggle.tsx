import { useState } from 'react'
import { isPushOff, pushSupportState, subscribePush, turnPushOff } from './subscribe'

export function PushToggle() {
  const [state, setState] = useState(() => pushSupportState())
  const [off, setOff] = useState(isPushOff)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function disable() {
    setBusy(true)
    setError(null)
    try {
      await turnPushOff()
      setOff(true)
    } catch {
      setError('Non è stato possibile disattivare le notifiche. Controlla la connessione e riprova.')
    }
    setBusy(false)
  }

  // Va chiamata da un tocco: iOS rifiuta la richiesta di permesso in ogni altro momento.
  async function enable() {
    setBusy(true)
    setError(null)
    try {
      await subscribePush()
      setOff(false)
    } catch {
      setError('Non è stato possibile attivare le notifiche. Controlla la connessione e riprova.')
    }
    setState(pushSupportState())
    setBusy(false)
  }

  if (state === 'needs-install') return <p className="hint">Per ricevere le notifiche installa prima l'app: i passaggi sono in Stato notifiche.</p>
  if (state === 'unsupported') return <p className="hint">Questo browser non può ricevere notifiche.</p>
  if (state === 'denied') return <p className="hint">Le notifiche sono bloccate dalle impostazioni del telefono: puoi riattivarle da lì.</p>

  const active = state === 'granted' && !off
  return (
    <>
      <p>{active ? 'Le notifiche sono attive su questo telefono.' : off ? 'Le notifiche sono disattivate su questo telefono. I tuoi programmi restano salvati.' : 'Le notifiche non sono ancora attive su questo telefono.'}</p>
      {error && <p role="alert" className="error">{error}</p>}
      {active ? (
        <button className="secondary" disabled={busy} onClick={() => void disable()}>Disattiva le notifiche</button>
      ) : (
        <button className="secondary" disabled={busy} onClick={() => void enable()}>Attiva le notifiche</button>
      )}
    </>
  )
}
