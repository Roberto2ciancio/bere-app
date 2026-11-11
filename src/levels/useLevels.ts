import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Punti di tutti (per la classifica e per il proprio livello). null finché non arrivano o se il server non li dà. */
export function useLevels(): Map<string, number> | null {
  const [points, setPoints] = useState<Map<string, number> | null>(null)
  useEffect(() => {
    let active = true
    Promise.resolve(supabase.rpc('get_levels'))
      .then(({ data, error }) => {
        if (!active || error || !Array.isArray(data)) return
        setPoints(new Map((data as { user_id: string; points: number }[]).map((r) => [r.user_id, r.points])))
      })
      .catch(() => {
        // Senza rete i livelli restano nascosti.
      })
    return () => {
      active = false
    }
  }, [])
  return points
}
