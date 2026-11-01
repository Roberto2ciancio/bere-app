import { useCallback, useEffect, useState } from 'react'
import { BUILT_IN_DRINKS, DEFAULT_CUPS } from '../domain/hydration'
import { readCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'

export interface Cup {
  id?: string
  name: string
  amount_ml: number
  drink_type: string
  hydration_pct: number
}

export interface CustomDrink {
  id: string
  name: string
  hydration_pct: number
}

/** Tazze e bevande dell'utente, salvate anche sul telefono per poterle usare senza rete. */
export function useDrinkOptions(userId: string | null) {
  const key = `bere.drinkOptions.${userId}`
  const [cups, setCups] = useState<Cup[]>([])
  const [custom, setCustom] = useState<CustomDrink[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    if (!userId) return
    const [cupRows, typeRows] = await Promise.all([
      supabase.from('cups').select('*').eq('user_id', userId),
      supabase.from('drink_types').select('*').eq('user_id', userId),
    ])
    if (cupRows.error || typeRows.error) return
    const nextCups = (cupRows.data ?? []) as Cup[]
    const nextCustom = (typeRows.data ?? []) as CustomDrink[]
    setCups(nextCups)
    setCustom(nextCustom)
    setLoaded(true)
    writeCache(key, { cups: nextCups, custom: nextCustom })
  }, [userId, key])

  useEffect(() => {
    const cached = readCache<{ cups: Cup[]; custom: CustomDrink[] }>(key)
    if (cached) {
      setCups(cached.cups)
      setCustom(cached.custom)
    }
    void reload()
  }, [key, reload])

  return { cups, custom, loaded, reload, shownCups: cups.length > 0 ? cups : (DEFAULT_CUPS as Cup[]) }
}

export function hydrationOf(type: string, custom: CustomDrink[]): number {
  return BUILT_IN_DRINKS.find((d) => d.id === type)?.hydrationPct ?? custom.find((d) => d.name === type)?.hydration_pct ?? 100
}

export function DrinkTypeSelect({ value, onChange, custom }: { value: string; onChange(type: string): void; custom: CustomDrink[] }) {
  return (
    <label>
      Bevanda
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {BUILT_IN_DRINKS.map((drink) => (
          <option key={drink.id} value={drink.id}>{drink.label} ({drink.hydrationPct}%)</option>
        ))}
        {custom.map((drink) => (
          <option key={drink.id} value={drink.name}>{drink.name} ({drink.hydration_pct}%)</option>
        ))}
      </select>
    </label>
  )
}

/** Restituisce i millilitri, o null se fuori dai limiti del database. */
export function parseAmount(text: string): number | null {
  const ml = Number(text.trim())
  return Number.isInteger(ml) && ml >= 1 && ml <= 2000 ? ml : null
}
