import { useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Challenge {
  id: string
  other: string
  other_name: string
  incoming: boolean
  status: 'pending' | 'accepted' | 'declined'
  my_days: number
  their_days: number
}

function verdict(c: Challenge): string {
  if (c.my_days > c.their_days) return 'Sei avanti'
  if (c.my_days < c.their_days) return 'Sei dietro'
  return 'Pari'
}

/** Le sfide 1 contro 1 della settimana: punteggio, risposte da dare, inviti in attesa. */
export function ChallengesCard({ challenges, onChanged }: { challenges: Challenge[]; onChanged(): void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (challenges.length === 0) return null

  async function answer(c: Challenge, accept: boolean) {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('answer_challenge', { p_id: c.id, p_accept: accept })
    setBusy(false)
    if (error) setError('Non è stato possibile rispondere. Controlla la connessione e riprova.')
    else onChanged()
  }

  return (
    <section className="card challenges" aria-labelledby="challenges-title">
      <h2 id="challenges-title">Sfide della settimana</h2>
      <ul className="challenge-list">
        {challenges.map((c) => (
          <li key={c.id}>
            {c.status === 'accepted' && (
              <>
                <span className="challenge-score num">
                  Tu {c.my_days} – {c.their_days} {c.other_name}
                </span>
                <span className="hint">{verdict(c)}</span>
              </>
            )}
            {c.status === 'pending' && c.incoming && (
              <>
                <span>{c.other_name} ti sfida: chi raggiunge l’obiettivo in più giorni questa settimana?</span>
                <span className="challenge-actions">
                  <button type="button" className="secondary" disabled={busy} onClick={() => void answer(c, true)}>Accetta</button>
                  <button type="button" className="ghost" disabled={busy} onClick={() => void answer(c, false)}>Rifiuta</button>
                </span>
              </>
            )}
            {c.status === 'pending' && !c.incoming && <span className="hint">Sfida a {c.other_name}: in attesa che accetti.</span>}
            {c.status === 'declined' && <span className="hint">{c.other_name} ha rifiutato la sfida.</span>}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  )
}
