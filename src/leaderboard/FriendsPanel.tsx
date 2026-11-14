import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export interface Group {
  id: string
  name: string
  invite_code: string
  members: number
}

interface Friend {
  user_id: string
  display_name: string
}

interface Props {
  userId: string
  /** Gli amici (dalla classifica «Amici», senza di me): null mentre si carica o se si guarda un gruppo. */
  friends: Friend[] | null
  /** Il gruppo che si sta guardando, se c'è. */
  group: Group | null
  onChanged(select?: string | null): void
}

const USE_CODE_ERRORS: Record<string, string> = {
  'not-found': 'Codice non trovato. Controlla le lettere e riprova.',
  self: 'Questo è il tuo codice: mandalo a un amico.',
  limit: 'Hai raggiunto il massimo (200 amici, 10 gruppi).',
  full: 'Questo gruppo è pieno (50 persone).',
}

/** Condivide un testo: menu del telefono se c'è, altrimenti copia negli appunti. */
async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ text })
      return 'shared'
    }
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

const appLink = () => `${location.origin}${location.pathname}`

/** Amici e gruppi: il tuo codice, aggiungere con un codice, creare un gruppo, uscire, togliere un amico. */
export function FriendsPanel({ userId, friends, group, onChanged }: Props) {
  const [myCode, setMyCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [groupName, setGroupName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  // L'elenco degli amici si disegna solo aperto: i nomi sono già nella classifica sopra.
  const [listOpen, setListOpen] = useState(false)

  useEffect(() => {
    let active = true
    Promise.resolve(supabase.from('profiles').select('friend_code').eq('id', userId).maybeSingle())
      .then(({ data }) => {
        if (active) setMyCode((data as { friend_code?: string } | null)?.friend_code ?? null)
      })
      .catch(() => null)
    return () => {
      active = false
    }
  }, [userId])

  async function share(text: string) {
    const result = await shareText(text)
    if (result === 'copied') setMessage('Copiato: incollalo in un messaggio.')
    if (result === 'failed') setMessage(null)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
    } catch {
      setMessage('Non è stato possibile completare l’operazione. Controlla la connessione e riprova.')
    } finally {
      setBusy(false)
    }
  }

  function addCode(event: FormEvent) {
    event.preventDefault()
    if (!code.trim()) return
    void run(async () => {
      const { data, error } = await supabase.rpc('use_code', { p_code: code })
      if (error) throw error
      const r = (data ?? {}) as { ok?: boolean; kind?: string; name?: string; group_id?: string; already?: boolean; reason?: string }
      if (!r.ok) {
        setMessage(USE_CODE_ERRORS[r.reason ?? ''] ?? USE_CODE_ERRORS['not-found'])
        return
      }
      setCode('')
      if (r.kind === 'group') {
        setMessage(r.already ? `Sei già nel gruppo «${r.name}».` : `Sei entrato nel gruppo «${r.name}».`)
        onChanged(r.group_id ?? null)
      } else {
        setMessage(r.already ? `${r.name} è già tra i tuoi amici.` : `${r.name} ora è tra i tuoi amici.`)
        onChanged(null)
      }
    })
  }

  function createGroup(event: FormEvent) {
    event.preventDefault()
    if (!groupName.trim()) return
    void run(async () => {
      const { data, error } = await supabase.rpc('create_group', { p_name: groupName })
      if (error) throw error
      const r = (data ?? {}) as { ok?: boolean; id?: string; name?: string; invite_code?: string; reason?: string }
      if (!r.ok) {
        setMessage(r.reason === 'limit' ? 'Puoi far parte al massimo di 10 gruppi.' : 'Scrivi un nome da 1 a 40 caratteri.')
        return
      }
      setGroupName('')
      setMessage(`Gruppo «${r.name}» creato. Codice invito: ${r.invite_code}`)
      onChanged(r.id ?? null)
    })
  }

  function leave(target: Group) {
    if (confirm !== `group:${target.id}`) {
      setConfirm(`group:${target.id}`)
      return
    }
    setConfirm(null)
    void run(async () => {
      const { error } = await supabase.rpc('leave_group', { p_group: target.id })
      if (error) throw error
      setMessage(`Sei uscito da «${target.name}».`)
      onChanged(null)
    })
  }

  function remove(friend: Friend) {
    if (confirm !== `friend:${friend.user_id}`) {
      setConfirm(`friend:${friend.user_id}`)
      return
    }
    setConfirm(null)
    void run(async () => {
      const { error } = await supabase.rpc('remove_friend', { p_user: friend.user_id })
      if (error) throw error
      setMessage(`${friend.display_name} non è più tra i tuoi amici.`)
      onChanged(null)
    })
  }

  return (
    <section className="card friends-panel" aria-labelledby="friends-title">
      <h2 id="friends-title">Amici e gruppi</h2>

      {group ? (
        <p>
          Codice invito di «{group.name}»: <strong className="num">{group.invite_code}</strong>{' '}
          <button
            type="button"
            className="ghost"
            onClick={() => void share(`Entra nel gruppo «${group.name}» su Bere: in Classifica › Amici e gruppi inserisci il codice ${group.invite_code}. ${appLink()}`)}
          >
            Invita
          </button>
        </p>
      ) : (
        myCode && (
          <p>
            Il tuo codice amico: <strong className="num">{myCode}</strong>{' '}
            <button
              type="button"
              className="ghost"
              onClick={() => void share(`Sfidiamoci su Bere! In Classifica › Amici e gruppi inserisci il mio codice ${myCode}. ${appLink()}`)}
            >
              Condividi
            </button>
          </p>
        )
      )}

      <form onSubmit={addCode} className="inline-form">
        <label htmlFor="friend-code">Codice di un amico o di un gruppo</label>
        <input
          id="friend-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={12}
        />
        <button type="submit" className="secondary" disabled={busy || !code.trim()}>Aggiungi</button>
      </form>

      <form onSubmit={createGroup} className="inline-form">
        <label htmlFor="group-name">Nuovo gruppo</label>
        <input id="group-name" value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={40} placeholder="Famiglia, ufficio…" />
        <button type="submit" className="secondary" disabled={busy || !groupName.trim()}>Crea</button>
      </form>

      {message && <p role="status" className="hint">{message}</p>}

      {group && (
        <button type="button" className="ghost" disabled={busy} onClick={() => leave(group)}>
          {confirm === `group:${group.id}` ? 'Conferma: esci dal gruppo' : 'Esci dal gruppo'}
        </button>
      )}

      {!group && friends && friends.length > 0 && (
        <details className="fold" onToggle={(e) => setListOpen(e.currentTarget.open)}>
          <summary>I tuoi amici ({friends.length})</summary>
          {listOpen && (
          <ul className="fold-body friends-list">
            {friends.map((f) => (
              <li key={f.user_id}>
                <span>{f.display_name}</span>
                <button type="button" className="ghost" disabled={busy} onClick={() => remove(f)} aria-label={`Rimuovi ${f.display_name}`}>
                  {confirm === `friend:${f.user_id}` ? 'Conferma' : 'Rimuovi'}
                </button>
              </li>
            ))}
          </ul>
          )}
        </details>
      )}
    </section>
  )
}
