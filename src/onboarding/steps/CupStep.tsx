import { useState } from 'react'
import { useProfile } from '../../auth/ProfileProvider'
import { OnboardingShell } from '../OnboardingShell'

const CUPS = [
  { ml: 100, label: 'Tazzina', icon: '☕' },
  { ml: 200, label: 'Bicchiere', icon: '🥛' },
  { ml: 500, label: 'Bottiglietta', icon: '🧴' },
  { ml: 750, label: 'Borraccia', icon: '🫗' },
]

export function CupStep({ goalMl, onNext }: { goalMl: number; onNext: () => void }) {
  const { profile, saveProfile } = useProfile()
  const [drinkMl, setDrinkMl] = useState(() => CUPS.find((c) => c.ml === profile?.drink_ml)?.ml ?? 200)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const count = Math.ceil(goalMl / drinkMl)

  async function next() {
    setBusy(true)
    setError(false)
    if (await saveProfile({ drink_ml: drinkMl })) onNext()
    else setError(true)
    setBusy(false)
  }

  return (
    <OnboardingShell
      step="cup" title="Il tuo bicchiere"
      mood="idle"
      say={`Circa ${count} ${count === 1 ? 'bicchiere' : 'bicchieri'} al giorno, ce la fai!`}
      onNext={() => void next()}
      onSkip={onNext}
      nextLabel="Avanti"
      nextDisabled={busy}
    >
      <div className="ob-cups" role="group" aria-label="Quanto bevi in una volta?">
        {CUPS.map((cup) => (
          <button key={cup.ml} type="button" className="ob-cup" aria-pressed={drinkMl === cup.ml} onClick={() => setDrinkMl(cup.ml)}>
            <span className="ob-cup-icon" aria-hidden="true">{cup.icon}</span>
            <span>{cup.label}</span>
            <span className="num ob-cup-ml">{cup.ml} ml</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="error">Salvataggio non riuscito. Controlla la connessione e riprova.</p>}
    </OnboardingShell>
  )
}
