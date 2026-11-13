import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { drinkLabel, formatAmount } from '../domain/hydration'
import { supabase } from '../lib/supabase'
import { DrinkTypeSelect, hydrationOf, parseAmount, useDrinkOptions } from './drinkOptions'

const SAVE_ERROR = 'Salvataggio non riuscito. Controlla la connessione e riprova'

export function CupsPage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const userId = user?.id ?? null
  const { cups, custom, reload } = useDrinkOptions(userId)
  const [cupName, setCupName] = useState('')
  const [cupMl, setCupMl] = useState('250')
  const [cupType, setCupType] = useState('water')
  const [drinkName, setDrinkName] = useState('')
  const [drinkPct, setDrinkPct] = useState('100')
  const [error, setError] = useState<string | null>(null)

  async function addCup(event: FormEvent) {
    event.preventDefault()
    if (!userId) return
    const ml = parseAmount(cupMl)
    if (!cupName.trim()) return setError('Dai un nome alla tazza')
    if (ml === null) return setError('La quantità deve essere tra 1 e 2000 ml')
    setError(null)
    const { error: failed } = await supabase.from('cups').insert({
      user_id: userId,
      name: cupName.trim(),
      amount_ml: ml,
      drink_type: cupType,
      hydration_pct: hydrationOf(cupType, custom),
    })
    if (failed) return setError(SAVE_ERROR)
    setCupName('')
    await reload()
  }

  async function addDrink(event: FormEvent) {
    event.preventDefault()
    if (!userId) return
    const pct = Number(drinkPct)
    if (!drinkName.trim()) return setError('Dai un nome alla bevanda')
    if (!Number.isInteger(pct) || pct < 0 || pct > 150) return setError('La percentuale deve essere tra 0 e 150')
    setError(null)
    const { error: failed } = await supabase.from('drink_types').insert({ user_id: userId, name: drinkName.trim(), hydration_pct: pct })
    if (failed) return setError('Salvataggio non riuscito: forse questa bevanda esiste già')
    setDrinkName('')
    await reload()
  }

  async function remove(table: 'cups' | 'drink_types', id: string | undefined) {
    if (!id) return
    const { error: failed } = await supabase.from(table).delete().eq('id', id)
    if (failed) return setError(SAVE_ERROR)
    await reload()
  }

  return (
    <main className="page">
      <div className="row">
        <h1>Tazze e bevande</h1>
        <Link to="/bevute">Bevute</Link>
      </div>
      {error && <p role="alert" className="error">{error}</p>}

      <section className="section">
        <h2>Le tue tazze</h2>
        {cups.length === 0 && <p className="hint">Finché non ne crei una, l'app propone bicchiere, tazza e bottiglia.</p>}
        <ul className="list">
          {cups.map((cup) => (
            <li key={cup.id}>
              <span className="grow">{cup.name} · {formatAmount(cup.amount_ml, profile?.units)} · {drinkLabel(cup.drink_type)}</span>
              <button className="ghost" aria-label={`Elimina ${cup.name}`} onClick={() => void remove('cups', cup.id)}>Elimina</button>
            </li>
          ))}
        </ul>
        <form className="stack" onSubmit={addCup} noValidate>
          <label>
            Nome della tazza
            <input maxLength={40} value={cupName} onChange={(e) => setCupName(e.target.value)} />
          </label>
          <label>
            Millilitri
            <input inputMode="numeric" value={cupMl} onChange={(e) => setCupMl(e.target.value)} />
          </label>
          <DrinkTypeSelect value={cupType} onChange={setCupType} custom={custom} />
          <button className="secondary">Aggiungi tazza</button>
        </form>
      </section>

      <section className="section">
        <h2>Le tue bevande</h2>
        <p className="hint">La percentuale indica quanto la bevanda conta verso l'obiettivo: 100 è come l'acqua.</p>
        <ul className="list">
          {custom.map((drink) => (
            <li key={drink.id}>
              <span className="grow">{drink.name} · {drink.hydration_pct}%</span>
              <button className="ghost" aria-label={`Elimina ${drink.name}`} onClick={() => void remove('drink_types', drink.id)}>Elimina</button>
            </li>
          ))}
        </ul>
        <form className="stack" onSubmit={addDrink} noValidate>
          <label>
            Nome della bevanda
            <input maxLength={40} value={drinkName} onChange={(e) => setDrinkName(e.target.value)} />
          </label>
          <label>
            Quanto idrata (%)
            <input inputMode="numeric" value={drinkPct} onChange={(e) => setDrinkPct(e.target.value)} />
          </label>
          <button className="secondary">Aggiungi bevanda</button>
        </form>
      </section>
    </main>
  )
}
