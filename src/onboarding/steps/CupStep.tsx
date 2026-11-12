import { useState, type ReactNode } from 'react'
import { useProfile } from '../../auth/ProfileProvider'
import { OnboardingShell } from '../OnboardingShell'

/** Icone a tratto (currentColor), nello stile di quelle della barra. */
function CupIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

const CUPS: { ml: number; label: string; icon: ReactNode }[] = [
  {
    ml: 100, label: 'Tazzina',
    icon: <CupIcon><path d="M4 10h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M16 11.5h1.5a2.5 2.5 0 0 1 0 5H15.5" /><path d="M8 3.5v3M12 3.5v3" /></CupIcon>,
  },
  {
    ml: 200, label: 'Bicchiere',
    icon: <CupIcon><path d="M6 4h12l-1.4 15a1.5 1.5 0 0 1-1.5 1.4H8.9a1.5 1.5 0 0 1-1.5-1.4z" /><path d="M6.6 10h10.8" /></CupIcon>,
  },
  {
    ml: 500, label: 'Bottiglietta',
    icon: <CupIcon><path d="M10 2.5h4v2.5h-4z" /><path d="M10 5c0 2-3 2.5-3 5.5v9a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5v-9C17 7.5 14 7 14 5" /><path d="M7 12h10" /></CupIcon>,
  },
  {
    ml: 750, label: 'Borraccia',
    icon: <CupIcon><path d="M9 2.5h6v3H9z" /><path d="M8 5.5h8a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V7A1.5 1.5 0 0 1 8 5.5z" /><path d="M6.5 10h11M6.5 16h11" /></CupIcon>,
  },
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
