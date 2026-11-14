import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Avatar } from '../avatars/Avatar'
import { useProfile } from '../auth/ProfileProvider'
import { addDays } from '../domain/time'
import { LevelBadge } from '../levels/LevelBadge'
import { useLevels } from '../levels/useLevels'
import { supabase } from '../lib/supabase'
import { EmptyState } from '../mascot/EmptyState'
import { GluCorner } from '../mascot/GluCorner'
import { useGluAccessories } from '../mascot/accessories'
import { useGluSpot, useGluStageActive } from '../glu3d/stage/stageContext'
import { CORNER_PHRASES } from '../mascot/phrases'
import { weekStart } from './weekStart'
import { FriendsPanel, type Group } from './FriendsPanel'
import { ChallengesCard, type Challenge } from './ChallengesCard'
import { Stagger } from '../ui/motion/Stagger'

/** Le reazioni ai traguardi degli amici, con il nome letto dagli screen reader. */
const REACTIONS = [
  ['👏', 'Complimenti'],
  ['💪', 'Che forza'],
  ['🔥', 'Sei on fire'],
] as const

interface Entry {
  user_id: string
  display_name: string
  avatar_path: string | null
  days_met: number
  streak: number
}

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
  // Chi ha raggiunto l'obiettivo oggi, e se gli ho già fatto i complimenti.
  /** Chi ha raggiunto l'obiettivo oggi → la reazione che gli ho già mandato (null se nessuna). */
  const [cheerable, setCheerable] = useState<Map<string, string | null>>(new Map())
  const levels = useLevels()
  // Classifica «Amici» (null) o quella di un gruppo.
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [reload, setReload] = useState(0)
  const group = groups.find((g) => g.id === groupId) ?? null

  useEffect(() => {
    let active = true
    Promise.resolve(supabase.rpc('get_leaderboard', groupId ? { week_start: week, p_group: groupId } : { week_start: week })).then(({ data, error }) => {
      if (!active) return
      if (error) setFailed(true)
      else {
        setFailed(false)
        setEntries((data ?? []) as Entry[])
      }
    })
    return () => {
      active = false
    }
  }, [week, groupId, reload])

  useEffect(() => {
    let active = true
    Promise.resolve(supabase.rpc('my_groups')).then(({ data }) => {
      if (active) setGroups(Array.isArray(data) ? (data as Group[]) : [])
    })
    return () => {
      active = false
    }
  }, [reload])

  const [challenges, setChallenges] = useState<Challenge[]>([])
  useEffect(() => {
    let active = true
    Promise.resolve(supabase.rpc('my_challenges', { p_week: week })).then(({ data }) => {
      if (active) setChallenges(Array.isArray(data) ? (data as Challenge[]) : [])
    })
    return () => {
      active = false
    }
  }, [week, reload])
  const challenged = new Set(challenges.map((c) => c.other))

  async function challenge(entry: Entry) {
    setPoking(true)
    const { data, error } = await supabase.rpc('challenge', { p_to: entry.user_id, p_week: week })
    const name = entry.display_name
    const messages: Record<string, string> = {
      ok: `Sfida lanciata a ${name}: vince chi raggiunge l'obiettivo in più giorni questa settimana.`,
      already: `Con ${name} c'è già una sfida questa settimana.`,
      limit: 'Hai già lanciato 5 sfide questa settimana.',
    }
    setPokeMessage((!error && typeof data === 'string' && messages[data]) || `Non è stato possibile sfidare ${name}. Riprova.`)
    if (!error && (data === 'ok' || data === 'already')) setReload((n) => n + 1)
    setPoking(false)
  }

  function changed(select?: string | null) {
    if (select !== undefined) setGroupId(select)
    setReload((n) => n + 1)
  }

  useEffect(() => {
    let active = true
    Promise.resolve(supabase.rpc('cheerable_today')).then(({ data }) => {
      if (active && Array.isArray(data)) setCheerable(new Map((data as { user_id: string; cheered: boolean; reaction?: string | null }[]).map((r) => [r.user_id, r.cheered ? (r.reaction ?? '👏') : null])))
    })
    return () => {
      active = false
    }
  }, [reload])

  async function cheer(entry: Entry, reaction: string) {
    setPoking(true)
    const { data, error } = await supabase.functions.invoke('cheer', { body: { to: entry.user_id, reaction } })
    const status = (data as { status?: string } | null)?.status
    const name = entry.display_name
    const messages: Record<string, string> = {
      sent: `Complimenti inviati a ${name} ${reaction}`,
      'no-device': `Complimenti inviati: ${name} li vedrà in classifica.`,
      already: `Hai già fatto i complimenti a ${name} oggi.`,
      'no-goal': `${name} non ha ancora raggiunto l'obiettivo di oggi.`,
    }
    setPokeMessage((!error && status && messages[status]) || `Non è stato possibile mandare i complimenti a ${name}. Riprova.`)
    if (!error && (status === 'sent' || status === 'no-device' || status === 'already')) setCheerable((m) => new Map(m).set(entry.user_id, status === 'already' ? (m.get(entry.user_id) ?? reaction) : reaction))
    setPoking(false)
  }

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
      paused: `${name} ha messo in pausa le notifiche.`,
    }
    setPokeMessage((!error && status && messages[status]) || `Non è stato possibile spronare ${name}. Riprova.`)
    setPoking(false)
  }

  const started = entries?.some((e) => e.days_met > 0)
  const positions = entries ? ranks(entries) : []
  const mine = entries?.findIndex((e) => e.user_id === user?.id) ?? -1
  const me = entries && mine >= 0 ? entries[mine] : null
  const leader = !!me && me.days_met > 0 && positions[mine] === 1
  // Glu nell'angolo: con il palcoscenico lo disegna lui (anche sulla classifica vuota), altrimenti GluCorner.
  const stage = useGluStageActive()
  const accessories = useGluAccessories()
  useGluSpot(
    stage
      ? entries
        ? { spot: 'corner', mood: leader ? 'goal' : 'idle', text: leader ? CORNER_PHRASES.boardLeader : CORNER_PHRASES.boardIdle, fill: 0.6, extras: accessories, help: 'classifica' }
        : { spot: 'corner', mood: 'idle', help: 'classifica' }
      : null,
  )

  return (
    <Stagger as="main" className={stage ? 'page board has-glu-stage' : 'page board'}>
      <header className="board-head">
        <h1>Classifica</h1>
        <p className="hint">Settimana {weekLabel(week)}</p>
      </header>

      {groups.length > 0 && (
        <div className="choices board-tabs" role="group" aria-label="Quale classifica">
          <button type="button" className="choice" aria-pressed={!group} onClick={() => setGroupId(null)}>Amici</button>
          {groups.map((g) => (
            <button key={g.id} type="button" className="choice" aria-pressed={group?.id === g.id} onClick={() => setGroupId(g.id)}>
              {g.name}
            </button>
          ))}
        </div>
      )}

      {failed && <p role="alert" className="error">Classifica non disponibile. Controlla la connessione.</p>}
      {!entries && !failed && <p className="center-note">Caricamento…</p>}

      {!stage && entries && entries.length > 1 && (
        <GluCorner mood={leader ? 'goal' : 'idle'} text={leader ? CORNER_PHRASES.boardLeader : CORNER_PHRASES.boardIdle} />
      )}

      {me && (
        <section className="card board-me" aria-label="La tua posizione">
          <span className="board-me-rank">{positions[mine]}°</span>
          <div className="board-me-text">
            <strong>{me.days_met > 0 ? `${days(me.days_met)} su 7 a obiettivo` : 'Nessun giorno a obiettivo, per ora'}</strong>
            <span className="hint">{me.streak > 0 ? `Serie migliore: ${days(me.streak)} di fila` : 'Raggiungi l\'obiettivo oggi per partire'}</span>
          </div>
        </section>
      )}

      <ChallengesCard challenges={challenges} onChanged={() => setReload((n) => n + 1)} />

      {entries && entries.length <= 1 && (
        <EmptyState
          mood="idle"
          title={group ? 'Nel gruppo per ora ci sei solo tu: invita qualcuno con il codice qui sotto.' : 'Per ora ci sei solo tu: aggiungi un amico con il suo codice, qui sotto.'}
        />
      )}
      {entries && entries.length > 1 && !started && <p className="hint">Nessuno ha ancora raggiunto l'obiettivo questa settimana. Il primo posto è libero.</p>}

      {pokeMessage && <p role="status" className="board-toast">{pokeMessage}</p>}

      {entries && entries.length > 0 && (
        <ol className="board-list">
          {entries.map((entry, index) => {
            const rank = positions[index]
            const isMe = entry.user_id === user?.id
            const podium = entry.days_met > 0 && rank <= 3 ? ` podium-${rank}` : ''
            return (
              <li key={entry.user_id} className={isMe ? 'board-row me' : 'board-row'}>
                <span className="board-avatar">
                  <Avatar path={entry.avatar_path} name={entry.display_name} />
                  <span className={`rank${podium}`} data-testid="rank">{rank}</span>
                </span>
                <div className="board-main">
                  <div className="board-line">
                    <span className="board-who">
                      <span className="board-name">{entry.display_name}</span>
                      {levels?.has(entry.user_id) && <LevelBadge points={levels.get(entry.user_id) ?? 0} />}
                      {isMe && <span className="tag">Tu</span>}
                    </span>
                    <strong className="num board-pts">{entry.days_met}/7</strong>
                  </div>
                  <WeekBar met={entry.days_met} />
                  <div className="board-line">
                    <span className="hint">
                      serie {days(entry.streak)}
                      {cheerable.has(entry.user_id) && <span className="board-done"> · 🎉 obiettivo di oggi</span>}
                    </span>
                    {!isMe && (
                      <span className="board-actions">
                        {cheerable.has(entry.user_id) &&
                          (cheerable.get(entry.user_id) ? (
                            <button className="poke cheer" disabled aria-label={`Complimenti già inviati a ${entry.display_name}`}>
                              {cheerable.get(entry.user_id)} Inviati
                            </button>
                          ) : (
                            REACTIONS.map(([emoji, label]) => (
                              <button
                                key={emoji}
                                className="poke cheer"
                                disabled={poking}
                                aria-label={`${label} a ${entry.display_name}`}
                                onClick={() => void cheer(entry, emoji)}
                              >
                                {emoji}
                              </button>
                            ))
                          ))}
                        {!challenged.has(entry.user_id) && (
                          <button className="poke" disabled={poking} aria-label={`Sfida ${entry.display_name}`} onClick={() => void challenge(entry)}>
                            ⚔️ Sfida
                          </button>
                        )}
                        <button className="poke" disabled={poking} aria-label={`Sprona ${entry.display_name}`} onClick={() => void poke(entry)}>
                          👋 Sprona
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {user && (
        <FriendsPanel
          userId={user.id}
          group={group}
          friends={!group && entries ? entries.filter((e) => e.user_id !== user.id) : null}
          onChanged={changed}
        />
      )}

      <details className="fold">
        <summary>Come funziona</summary>
        <div className="fold-body">
          <p className="hint">Vince chi raggiunge il proprio obiettivo in più giorni, da lunedì a domenica. A parità, conta la serie più lunga di giorni consecutivi. Valgono solo obiettivi da 1,5 L in su.</p>
          <p className="hint">Il numero accanto al nome è il livello: si sale bevendo e raggiungendo l'obiettivo, settimana dopo settimana. I dettagli sono nello Storico.</p>
          <p className="hint">Con «Sfida» proponi a un amico una sfida 1 contro 1: se accetta, vince chi raggiunge l'obiettivo in più giorni questa settimana. Il punteggio si vede qui sopra.</p>
          <p className="hint">Con «Sprona» mandi a un amico una notifica per ricordargli di bere. Al massimo 3 volte al giorno, e una volta all'ora per la stessa persona.</p>
          <p className="hint">In classifica ci sono solo i tuoi amici, oppure i membri di un gruppo. Per aggiungere un amico inserisci il suo codice; per un gruppo, il codice invito che ti manda chi ne fa parte.</p>
          <p className="hint">Quando qualcuno raggiunge l'obiettivo del giorno, i suoi amici e compagni di gruppo ricevono un avviso e possono mandargli i complimenti 👏, dalla notifica o da qui. Puoi spegnere questi avvisi nel Profilo.</p>
          <p className="hint">Nome e foto li vedono solo i tuoi amici e chi è nei tuoi gruppi, insieme ai giorni in cui hai raggiunto l'obiettivo. Le quantità bevute restano private.</p>
          <p className="hint">Una foto usa una tua opera senza permesso, o un nome o una foto è offensivo? <a href="#/segnala">Segnalalo</a>: lo controlliamo e, se serve, lo togliamo.</p>
        </div>
      </details>
    </Stagger>
  )
}
