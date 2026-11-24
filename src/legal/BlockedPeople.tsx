import { useEffect, useState } from 'react'
import { Avatar } from '../avatars/Avatar'
import { supabase } from '../lib/supabase'

interface Blocked {
  user_id: string
  display_name: string
  avatar_path: string | null
}

/** Le persone bloccate dalla classifica, con «Sblocca». */
export function BlockedPeople() {
  const [people, setPeople] = useState<Blocked[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.resolve(supabase.rpc('blocked_people')).then(({ data, error }) => {
      if (!active) return
      if (error) setFailed(true)
      else setPeople((data ?? []) as Blocked[])
    })
    return () => {
      active = false
    }
  }, [])

  async function unblock(person: Blocked) {
    setBusy(person.user_id)
    setError(null)
    const { error } = await supabase.from('blocks').delete().eq('blocked', person.user_id)
    setBusy(null)
    if (error) return setError(`Non è stato possibile sbloccare ${person.display_name}. Riprova.`)
    setPeople((list) => list?.filter((p) => p.user_id !== person.user_id) ?? list)
  }

  if (failed) return <p role="alert" className="error">Elenco non disponibile. Controlla la connessione.</p>
  if (!people) return <p className="hint">Caricamento…</p>
  if (people.length === 0) return <p className="hint">Non hai bloccato nessuno. Puoi farlo dalla classifica, con ⋯ accanto a una persona.</p>
  return (
    <>
      <ul className="blocked-list">
        {people.map((person) => (
          <li key={person.user_id}>
            <Avatar path={person.avatar_path} name={person.display_name} />
            <span className="blocked-name">{person.display_name}</span>
            <button className="secondary" disabled={busy !== null} onClick={() => void unblock(person)} aria-label={`Sblocca ${person.display_name}`}>
              Sblocca
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="error">{error}</p>}
    </>
  )
}
