import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { addDays } from '../domain/time'
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

const MEDALS = ['🥇', '🥈', '🥉']

/** "2 – 8 novembre", oppure "30 novembre – 6 dicembre" a cavallo di due mesi. */
function weekLabel(start: string): string {
  const end = addDays(start, 6)
  const day = (d: string) => Number(d.slice(8, 10))
  const month = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('it-IT', { month: 'long', timeZone: 'UTC' })
  return month(start) === month(end) ? `${day(start)} – ${day(end)} ${month(end)}` : `${day(start)} ${month(start)} – ${day(end)} ${month(end)}`
}

const days = (n: number) => (n === 1 ? '1 giorno' : `${n} giorni`)

/** Pari punteggio, pari posizione: 1, 1, 3. */
function ranks(entries: Entry[]): number[] {
  return entries.map((entry, index) => entries.findIndex((e) => e.days_met === entry.days_met && e.streak === entry.streak) + 1 || index + 1)
}

function Avatar({ entry, large = false }: { entry: Entry; large?: boolean }) {
  const className = large ? 'avatar avatar-lg' : 'avatar'
  return entry.avatar_path ? (
    <img className={className} src={avatarUrl(entry.avatar_path)} alt="" />
  ) : (
    <span className={className} aria-hidden="true">{entry.display_name.slice(0, 1).toUpperCase()}</span>
  )
}

function WeekBar({ met }: { met: number }) {
  return (
    <span className="week-bar" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => <span key={i} className={i < met ? 'on' : undefined} />)}
    </span>
  )
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
      cooldown: `Aspetta un'ora prima di spronare di nuovo ${name}.`,
      blocked: `${name} preferisce non ricevere sproni.`,
      'no-device': `${name} non ha le notifiche attive.`,
    }
    setPokeMessage((!error && status && messages[status]) || `Non è stato possibile spronare ${name}. Riprova.`)
    setPoking(false)
  }

  const started = entries?.some((e) => e.days_met > 0)
  const positions = entries ? ranks(entries) : []
  const mine = entries?.findIndex((e) => e.user_id === user?.id) ?? -1
  const me = entries && mine >= 0 ? entries[mine] : null

  return (
    <main className="page board">
      <header className="board-head">
        <h1>Classifica</h1>
        <p className="hint">Settimana {weekLabel(week)}</p>
      </header>

      {failed && <p role="alert" className="error">Classifica non disponibile. Controlla la connessione.</p>}
      {!entries && !failed && <p className="center-note">Caricamento…</p>}

      {me && (
        <section className="card board-me" aria-label="La tua posizione">
          <span className="board-me-rank">{positions[mine]}°</span>
          <div className="board-me-text">
            <strong>{me.days_met > 0 ? `${days(me.days_met)} su 7 a obiettivo` : 'Nessun giorno a obiettivo, per ora'}</strong>
            <span className="hint">{me.streak > 0 ? `Serie migliore: ${days(me.streak)} di fila` : 'Raggiungi l\'obiettivo oggi per partire'}</span>
          </div>
        </section>
      )}

      {entries && !started && <p className="hint">Nessuno ha ancora raggiunto l'obiettivo questa settimana. Il primo posto è libero.</p>}

      {pokeMessage && <p role="status" className="board-toast">{pokeMessage}</p>}

      {entries && entries.length > 0 && (
        <ol className="board-list">
          {entries.map((entry, index) => {
            const rank = positions[index]
            const isMe = entry.user_id === user?.id
            const medal = entry.days_met > 0 ? MEDALS[rank - 1] : undefined
            return (
              <li key={entry.user_id} className={isMe ? 'board-row me' : 'board-row'}>
                <span className="rank" data-testid="rank">{rank}</span>
                <span className="board-avatar">
                  <Avatar entry={entry} />
                  {medal && <span className="medal" aria-hidden="true">{medal}</span>}
                </span>
                <span className="grow board-name">
                  <span className="board-who">
                    <span>{entry.display_name}</span>
                    {isMe && <span className="tag">Tu</span>}
                  </span>
                  <span className="hint">serie {days(entry.streak)}</span>
                </span>
                <span className="board-score">
                  <strong className="num">{entry.days_met}/7</strong>
                  <WeekBar met={entry.days_met} />
                </span>
                {isMe ? (
                  <span className="poke-space" aria-hidden="true" />
                ) : (
                  <button className="poke" disabled={poking} aria-label={`Sprona ${entry.display_name}`} onClick={() => void poke(entry)}>
                    👋
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <details className="fold">
        <summary>Come funziona</summary>
        <div className="fold-body">
          <p className="hint">Vince chi raggiunge il proprio obiettivo in più giorni, da lunedì a domenica. A parità, conta la serie più lunga di giorni consecutivi. Valgono solo obiettivi da 1,5 L in su.</p>
          <p className="hint">Con 👋 sproni un amico: gli arriva una notifica. Al massimo 3 volte al giorno, e una volta all'ora per la stessa persona.</p>
          <p className="hint">Nome e foto sono visibili a tutti gli utenti dell'app, insieme ai giorni in cui hai raggiunto l'obiettivo. Le quantità bevute restano private.</p>
        </div>
      </details>
    </main>
  )
}
