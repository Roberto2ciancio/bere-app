import { useState, type FormEvent } from 'react'
import { BackToProfileHeader } from '../profile/BackToProfileHeader'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

const MAX_LENGTH = 2000

export function FeedbackForm() {
  const { user } = useAuth()
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [thanks, setThanks] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setThanks(false)
    const text = message.trim()
    if (!text) return setError('Scrivi prima il tuo suggerimento')
    if (text.length > MAX_LENGTH) return setError(`Il messaggio supera i ${MAX_LENGTH} caratteri: accorcialo un po'`)
    if (!user) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('feedback').insert({ user_id: user.id, message: text })
    setBusy(false)
    if (error) return setError('Il messaggio non è partito. Controlla la connessione e riprova')
    setMessage('')
    setThanks(true)
  }

  return (
    <main className="page">
      <BackToProfileHeader section="aiuto" title="Suggerimenti" />
      <form className="stack" onSubmit={submit} noValidate>
        <label>
          Cosa miglioreresti?
          <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        {thanks && <p role="status" className="hint">Grazie, l'abbiamo ricevuto.</p>}
        <button className="primary" disabled={busy}>Invia</button>
      </form>
    </main>
  )
}
