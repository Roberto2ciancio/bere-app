import { useEffect, useState, type FormEvent } from 'react'
import { useProfile } from '../auth/ProfileProvider'
import { activeHoursError, DEFAULT_ACTIVE_END, DEFAULT_ACTIVE_START } from '../domain/activeHours'
import { formatTime } from '../domain/format'

const STARTS = Array.from({ length: 24 }, (_, h) => h * 60)
const ENDS = Array.from({ length: 24 }, (_, h) => (h + 1) * 60)

/** Fascia attiva: l'obiettivo si divide solo sulle ore tra inizio e fine. */
export function ActiveHoursForm() {
  const { profile, saveProfile } = useProfile()
  const savedStart = profile?.active_start_min ?? DEFAULT_ACTIVE_START
  const savedEnd = profile?.active_end_min ?? DEFAULT_ACTIVE_END
  const enabled = profile?.active_split ?? false
  const [start, setStart] = useState(savedStart)
  const [end, setEnd] = useState(savedEnd)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setStart(savedStart)
    setEnd(savedEnd)
  }, [savedStart, savedEnd])

  if (!profile) return null

  async function toggle(on: boolean) {
    setSaved(false)
    setError(null)
    if (!(await saveProfile({ active_split: on }))) setError('Salvataggio non riuscito. Controlla la connessione e riprova')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    const invalid = activeHoursError(start, end)
    if (invalid) return setError(invalid)
    setError(null)
    if (await saveProfile({ active_start_min: start, active_end_min: end })) setSaved(true)
    else setError('Salvataggio non riuscito. Controlla la connessione e riprova')
  }

  const hours = (end - start) / 60

  return (
    <form className="stack" onSubmit={submit} noValidate aria-label="Fascia attiva">
      <label className="row">
        Dividi l'obiettivo sulle ore attive
        <input type="checkbox" checked={enabled} onChange={(e) => void toggle(e.target.checked)} />
      </label>
      <p className="hint">L'app conta e manda promemoria solo dentro questa fascia, e ricalcola quanto bere ogni ora in base a quello che manca.</p>
      <div className="row">
        <label>
          Dalle
          <select value={start} onChange={(e) => setStart(Number(e.target.value))}>
            {STARTS.map((m) => <option key={m} value={m}>{formatTime(m)}</option>)}
          </select>
        </label>
        <label>
          Alle
          <select value={end} onChange={(e) => setEnd(Number(e.target.value))}>
            {ENDS.map((m) => <option key={m} value={m}>{formatTime(m)}</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {saved && <p role="status" className="hint">Fascia salvata: dalle {formatTime(start)} alle {formatTime(end)}, {hours === 1 ? '1 ora' : `${String(hours).replace('.', ',')} ore`}.</p>}
      <button className="secondary">Salva fascia</button>
    </form>
  )
}
