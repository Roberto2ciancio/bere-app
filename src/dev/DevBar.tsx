import { useState } from 'react'
import { storagePrefix } from '../lib/storageKey'
import { resetDevData, supabase } from './devBackend'

function restart() {
  resetDevData()
  const prefix = storagePrefix(import.meta.env.MODE)
  // Senza prefisso si cancellerebbero anche i dati dell'app vera.
  if (prefix) {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => localStorage.removeItem(key))
  }
  window.location.hash = '#/home'
  window.location.reload()
}

const STATUS: Record<string, string> = {
  sent: 'Notifica inviata.',
  'no-device': 'Prima attiva le notifiche.',
  failed: 'Notifica non riuscita.',
}

export function DevBar({ onRestart = restart }: { onRestart?: () => void }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function notify() {
    const { data } = await supabase.functions.invoke('test-push')
    setMessage(STATUS[(data as { status: string }).status])
  }

  return (
    <div className="dev-bar">
      <button className="dev-pill" aria-expanded={open} onClick={() => setOpen((o) => !o)}>APP DI PROVA</button>
      {open && (
        <div className="dev-panel">
          <p className="hint">I dati restano su questo telefono: nulla arriva al server vero e tu non compari nella classifica vera.</p>
          <p className="hint">Password: qualsiasi, tranne "sbagliata". Codice email: qualsiasi, tranne 000000.</p>
          <p className="hint">Le notifiche sono locali e i promemoria partono solo con l'app aperta: per provare l'invio dal server serve l'app vera.</p>
          {message && <p role="status" className="hint">{message}</p>}
          <button className="secondary" onClick={() => void notify()}>Invia una notifica ora</button>
          <button className="secondary" onClick={onRestart}>Riparti da zero</button>
        </div>
      )}
    </div>
  )
}
