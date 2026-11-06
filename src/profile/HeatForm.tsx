import { useState, type FormEvent } from 'react'
import { useProfile } from '../auth/ProfileProvider'
import { findCity, roundCoord } from '../goal/boosts'

/** Obiettivo che si adatta al caldo: la città serve solo a leggere la temperatura massima di oggi. */
export function HeatForm() {
  const { profile, saveProfile } = useProfile()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!profile) return null
  const enabled = profile.heat_boost ?? false
  const hasPlace = profile.city_lat != null && profile.city_lon != null
  const showForm = enabled && (editing || !hasPlace)

  async function toggle(on: boolean) {
    setError(null)
    if (!(await saveProfile({ heat_boost: on }))) setError('Salvataggio non riuscito. Controlla la connessione e riprova')
  }

  async function place(city: { name: string; lat: number; lon: number }) {
    if (await saveProfile({ city_name: city.name, city_lat: city.lat, city_lon: city.lon })) {
      setEditing(false)
      setQuery('')
    } else setError('Salvataggio non riuscito. Controlla la connessione e riprova')
  }

  async function search(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (query.trim().length < 2) return setError('Scrivi il nome della tua città')
    setBusy(true)
    try {
      const city = await findCity(query)
      if (city) await place(city)
      else setError(`Non trovo «${query.trim()}». Prova con un altro nome.`)
    } catch {
      setError('Non riesco a cercare la città. Controlla la connessione e riprova')
    }
    setBusy(false)
  }

  function useMyPosition() {
    setError(null)
    if (!navigator.geolocation) return setError('Questo telefono non può dare la posizione: scrivi la città')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void place({ name: 'La tua zona', lat: roundCoord(position.coords.latitude), lon: roundCoord(position.coords.longitude) }).finally(() => setBusy(false))
      },
      () => {
        setError('Posizione non disponibile: scrivi la città')
        setBusy(false)
      },
      { maximumAge: 3_600_000, timeout: 15_000 },
    )
  }

  return (
    <div className="stack" aria-label="Giorni caldi" role="group">
      <h3>Giorni caldi</h3>
      <label className="row">
        Più acqua nei giorni caldi
        <input type="checkbox" checked={enabled} onChange={(e) => void toggle(e.target.checked)} />
      </label>
      <p className="hint">+250 ml dai 25 °C, +500 ml dai 30 °C, +750 ml dai 35 °C. La città va a Open-Meteo solo per leggere la temperatura massima di oggi.</p>
      {enabled && hasPlace && !editing && (
        <p className="link-row-inline">
          Città: <strong>{profile.city_name ?? 'La tua zona'}</strong>{' '}
          <button type="button" className="ghost" onClick={() => setEditing(true)}>Cambia</button>
        </p>
      )}
      {showForm && (
        <form className="stack" onSubmit={search} noValidate>
          <label>
            Città
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Es. Milano" autoComplete="address-level2" />
          </label>
          <div className="hours-pair">
            <button className="secondary" disabled={busy}>Cerca</button>
            <button type="button" className="ghost" disabled={busy} onClick={useMyPosition}>Usa la mia posizione</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  )
}
