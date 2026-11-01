import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { drinkLabel, formatAmount, type Units } from '../domain/hydration'
import { DrinkTypeSelect, hydrationOf, parseAmount, useDrinkOptions } from './drinkOptions'
import type { DrinkInput } from './useDrinks'

interface Props {
  userId: string | null
  units: Units | undefined
  defaultMl: number
  onDrink(input: DrinkInput): void
  onClose(): void
}

export function DrinkSheet({ userId, units, defaultMl, onDrink, onClose }: Props) {
  const { shownCups, custom } = useDrinkOptions(userId)
  const [type, setType] = useState('water')
  const [amount, setAmount] = useState(String(defaultMl))
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const ml = parseAmount(amount)
    if (ml === null) return setError('La quantità deve essere tra 1 e 2000 ml')
    onDrink({ amountMl: ml, drinkType: type, hydrationPct: hydrationOf(type, custom) })
  }

  return (
    <div className="sheet-overlay">
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <h2 id="sheet-title">Cosa hai bevuto?</h2>
        <div className="choices">
          {shownCups.map((cup) => (
            <button
              key={cup.id ?? cup.name}
              className="choice"
              onClick={() => onDrink({ amountMl: cup.amount_ml, drinkType: cup.drink_type, hydrationPct: cup.hydration_pct })}
            >
              {cup.name} · {formatAmount(cup.amount_ml, units)}
              {cup.drink_type !== 'water' && ` · ${drinkLabel(cup.drink_type)}`}
            </button>
          ))}
        </div>
        <form className="stack" onSubmit={submit} noValidate>
          <DrinkTypeSelect value={type} onChange={setType} custom={custom} />
          <label>
            Quantità (ml)
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setError(null)
              }}
            />
          </label>
          {error && <p role="alert" className="error">{error}</p>}
          <button className="primary">Segna</button>
        </form>
        <p className="hint">La percentuale dice quanto la bevanda conta verso l'obiettivo: è un valore indicativo.</p>
        <Link to="/tazze">Gestisci tazze e bevande</Link>
        <button className="ghost" onClick={onClose}>Chiudi</button>
      </div>
    </div>
  )
}
