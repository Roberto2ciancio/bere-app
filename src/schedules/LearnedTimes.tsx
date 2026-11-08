import { useEffect, useState } from 'react'
import type { ActiveHours } from '../domain/activeHours'
import { formatTime } from '../domain/format'
import { addDays, localParts } from '../domain/time'
import { storageKey } from '../lib/storageKey'
import { supabase } from '../lib/supabase'
import { LEARN_DAYS, suggestTimes } from './suggestTimes'
import { toReminders, type Schedule } from './schedulesApi'

const DISMISS_KEY = () => storageKey('bere.learnedTimes.dismissed')
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY()))
    return Number.isFinite(at) && Date.now() - at < DISMISS_MS
  } catch {
    return false
  }
}

/** Il programma a cui aggiungere: quello attivo che copre più giorni. */
function targetSchedule(schedules: Schedule[]): Schedule | null {
  return schedules.filter((s) => s.enabled).sort((a, b) => b.weekdays.length - a.weekdays.length)[0] ?? null
}

function joinTimes(times: string[]): string {
  return times.length === 1 ? times[0] : `${times.slice(0, -1).join(', ')} e ${times.at(-1)}`
}

interface Props {
  userId: string
  tz: string
  schedules: Schedule[]
  hours?: ActiveHours
  onAdd(schedule: Schedule, minutes: number): Promise<void>
}

/** «Orari che imparano»: propone i promemoria negli orari in cui di solito bevi davvero. */
export function LearnedTimes({ userId, tz, schedules, hours, onAdd }: Props) {
  const [drunkAt, setDrunkAt] = useState<string[] | null>(null)
  const [dismissed, setDismissed] = useState(dismissedRecently)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (dismissed) return
    let active = true
    const from = addDays(localParts(new Date(), tz).date, -LEARN_DAYS)
    Promise.resolve(supabase.from('drinks').select('drunk_at').eq('user_id', userId).gte('local_date', from))
      .then(({ data }) => {
        if (active) setDrunkAt(((data ?? []) as { drunk_at: string }[]).map((d) => d.drunk_at))
      })
      .catch(() => null)
    return () => {
      active = false
    }
  }, [userId, tz, dismissed])

  const target = targetSchedule(schedules)
  if (dismissed || !drunkAt || !target) return null
  const suggestions = suggestTimes(drunkAt, tz, toReminders(schedules).map((r) => r.minutes), hours)
  if (suggestions.length === 0) return null

  async function add(minutes: number) {
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      await onAdd(target, minutes)
    } catch {
      setError('Non è stato possibile aggiungere l\'orario. Controlla la connessione e riprova.')
    } finally {
      setBusy(false)
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY(), String(Date.now()))
    } catch {
      // Senza memoria del browser la proposta tornerà alla prossima apertura: va bene lo stesso.
    }
    setDismissed(true)
  }

  return (
    <section className="card learned-times" aria-labelledby="learned-times-title">
      <h2 id="learned-times-title">Orari che imparano</h2>
      <p>
        Nelle ultime settimane di solito hai bevuto verso le {joinTimes(suggestions.map(formatTime))}, ma lì non ti arriva
        nessun promemoria. {suggestions.length === 1 ? 'Lo aggiungo' : 'Li aggiungo'} a «{target.name}»?
      </p>
      <ul className="choices" aria-label="Orari proposti" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {suggestions.map((minutes) => (
          <li key={minutes}>
            <button type="button" className="choice num" aria-label={`Aggiungi ${formatTime(minutes)}`} disabled={busy} onClick={() => void add(minutes)}>
              + {formatTime(minutes)}
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="button" className="ghost" onClick={dismiss}>Non ora</button>
    </section>
  )
}
