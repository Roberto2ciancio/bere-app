import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

const WORD = 'ELIMINA'

export function DeleteAccount() {
  const { signOut } = useAuth()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (text !== WORD) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.functions.invoke('delete-account')
    if (error) {
      setBusy(false)
      setError('Non è stato possibile cancellare il profilo. Controlla la connessione e riprova')
      return
    }
    await signOut()
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Scrivi ELIMINA per confermare
        <input autoCapitalize="characters" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="danger-button" disabled={text !== WORD || busy}>Elimina definitivamente il profilo</button>
    </form>
  )
}
