import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { supabase } from '../lib/supabase'
import { avatarUrl } from '../profile/imageUpload'
import { weekStart } from './weekStart'

interface Entry {
  user_id: string
  display_name: string
  avatar_path: string | null
  days_met: number
  streak: number
}


export function LeaderboardPage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const tz = profile?.tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
  const week = weekStart(new Date(), tz)
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [pokeMessage, setPokeMessage] = useState<string | null>(null)
  const [poking, setPoking] = useState(false)

  useEffect(() => {
    let active = true
    Promise.resolve(supabase.rpc('get_leaderboard', { week_start: week })).then(({ data, error }) => {
      if (!active) return
      if (error) setFailed(true)
      else setEntries((data ?? []) as Entry[])
    })
    return () => {
      active = false
    }
  }, [week])

  async function poke(entry: Entry) {
    setPoking(true)
    const { data, error } = await supabase.functions.invoke('poke', { body: { to: entry.user_id } })
    const status = (data as { status?: string } | null)?.status
    const name = entry.display_name
    const messages: Record<string, string> = {
      sent: `Notifica inviata a ${name}.`,
      limit: `Hai già spronato ${name} 3 volte nelle ultime 24 ore.`,
      blocked: `${name} preferisce non ricevere sproni.`,
      'no-device': `${name} non ha le notifiche attive.`,
    }
    setPokeMessage((!error && status && messages[status]) || `Non è stato possibile spronare ${name}. Riprova.`)
    setPoking(false)
  }

  const started = entries?.some((e) => e.days_met > 0)

  return (
    <main className="page">
      <h1>Classifica</h1>
      <p className="hint">Vince chi raggiunge il proprio obiettivo in più giorni, da lunedì a domenica. A parità, conta la serie più lunga di giorni consecutivi.</p>

      {failed && <p role="alert" className="error">Classifica non disponibile. Controlla la connessione.</p>}
      {!entries && !failed && <p className="center-note">Caricamento…</p>}
      {entries && !started && <p>Nessuno ha ancora raggiunto l'obiettivo questa settimana. Il primo posto è libero.</p>}

      {pokeMessage && <p role="status" className="hint">{pokeMessage}</p>}

      {entries && entries.length > 0 && (
        <ol className="list">
          {entries.map((entry, index) => {
            const first = entries.findIndex((e) => e.days_met === entry.days_met && e.streak === entry.streak)
            return (
              <li key={entry.user_id} className={entry.user_id === user?.id ? 'me' : undefined}>
                <span className="rank" data-testid="rank">{first === -1 ? index + 1 : first + 1}</span>
                {entry.avatar_path ? (
                  <img className="avatar" src={avatarUrl(entry.avatar_path)} alt="" />
                ) : (
                  <span className="avatar" aria-hidden="true">{entry.display_name.slice(0, 1).toUpperCase()}</span>
                )}
                <span className="grow board-name">
                  <span>{entry.display_name}</span>
                  <span className="board-badges">
                    {entry.user_id !== user?.id && (
                      <button className="link-button" disabled={poking} aria-label={`Sprona ${entry.display_name}`} onClick={() => void poke(entry)}>Sprona</button>
                    )}
                  </span>
                </span>
                <span className="hint">serie {entry.streak}</span>
                <span className="num"><strong>{entry.days_met}/7</strong></span>
              </li>
            )
          })}
        </ol>
      )}

      <p className="hint">Nome e foto sono visibili a tutti gli utenti dell'app, insieme ai giorni in cui hai raggiunto l'obiettivo. Le quantità bevute restano private.</p>
    </main>
  )
}
