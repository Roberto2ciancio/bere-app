import { useState } from 'react'
import { useProfile } from '../auth/ProfileProvider'
import { formatLiters } from '../domain/format'
import { ACTIVITIES, HOT_DAY_CELSIUS, suggestGoal, type Activity } from '../domain/hydration'

// Una cifra decimale basta al meteo: circa 10 km, senza rivelare l'indirizzo.
async function todayMaxTemperature(): Promise<number> {
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('non disponibile'))
    navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 3_600_000, timeout: 15_000 })
  })
  const { latitude, longitude } = position.coords
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(1)}&longitude=${longitude.toFixed(1)}&daily=temperature_2m_max&forecast_days=1&timezone=auto`,
  )
  const data = (await response.json()) as { daily: { temperature_2m_max: number[] } }
  return data.daily.temperature_2m_max[0]
}

export function GoalCalculator({ onUse }: { onUse(goalMl: number): void }) {
  const { profile, updateProfile } = useProfile()
  const [weight, setWeight] = useState(profile?.weight_kg ? String(profile.weight_kg) : '')
  const [activity, setActivity] = useState<Activity>(profile?.activity ?? 'sedentary')
  const [hot, setHot] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const kg = Number(weight.trim().replace(',', '.'))
  const valid = Number.isFinite(kg) && kg >= 20 && kg <= 400
  const suggested = valid ? suggestGoal(kg, activity, hot) : null

  async function checkWeather() {
    setError(null)
    setNote(null)
    try {
      const celsius = await todayMaxTemperature()
      setHot(celsius >= HOT_DAY_CELSIUS)
      setNote(`Massima di oggi: ${Math.round(celsius)} °C.`)
    } catch {
      setError('Non riesco a controllare il meteo. Puoi indicare a mano se fa caldo.')
    }
  }

  return (
    <details>
      <summary>Calcolalo per me</summary>
      <div className="stack">
        <label>
          Peso (kg)
          <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label>
          Attività
          <select value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
            {ACTIVITIES.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </label>
        <label className="row">
          Oggi fa caldo
          <input type="checkbox" checked={hot} onChange={(e) => setHot(e.target.checked)} />
        </label>
        <button type="button" className="ghost" onClick={() => void checkWeather()}>Controlla il meteo di oggi</button>
        <p className="hint">Il meteo usa la tua posizione approssimata e la invia a Open-Meteo solo se tocchi il pulsante.</p>
        {note && <p className="hint">{note}</p>}
        {error && <p role="alert" className="error">{error}</p>}
        {suggested !== null && (
          <>
            <p><strong>Suggerito: {formatLiters(suggested)} al giorno.</strong></p>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                onUse(suggested)
                void updateProfile({ weight_kg: kg, activity })
              }}
            >
              Usa questo obiettivo
            </button>
          </>
        )}
        <p className="hint">È solo una stima e non è un consiglio medico. In gravidanza o con problemi di salute chiedi al tuo medico.</p>
      </div>
    </details>
  )
}
