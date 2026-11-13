import { useState } from 'react'
import type { Units } from '../domain/hydration'
import type { DayResult } from './stats'

interface Props {
  /** Gli ultimi 7 giorni, oggi compreso. */
  week: DayResult[]
  currentStreak: number
  units: Units | undefined
  today: string
}

/** «Condividi la settimana»: il disegno e la condivisione si caricano solo al tocco. */
export function ShareWeekButton({ week, currentStreak, units, today }: Props) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function share() {
    setBusy(true)
    setFailed(false)
    try {
      const { shareWeek } = await import('../share/shareWeek')
      await shareWeek(week, currentStreak, units, today)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="secondary share-week" disabled={busy} onClick={() => void share()}>
        {busy ? "Preparo l'immagine…" : 'Condividi la settimana'}
      </button>
      {failed && <p role="alert" className="error">Non sono riuscito a preparare l'immagine. Riprova.</p>}
    </>
  )
}
