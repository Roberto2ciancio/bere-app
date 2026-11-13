import { useEffect, useState, useSyncExternalStore } from 'react'
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

// Una sola richiesta condivisa per tutte le istanze di Glu sullo schermo (rinnovata dopo un minuto).
const SHARED_TTL_MS = 60_000
let shared: { points: Map<string, number> | null; at: number; inflight: boolean } = { points: null, at: 0, inflight: false }
const listeners = new Set<() => void>()

/** Solo per i test. */
export function resetSharedLevels() {
  shared = { points: null, at: 0, inflight: false }
}

function ensureShared() {
  if (shared.inflight || (shared.points && Date.now() - shared.at < SHARED_TTL_MS)) return
  shared = { ...shared, inflight: true }
  Promise.resolve(supabase.rpc('get_levels'))
    .then(({ data, error }) => {
      if (error || !Array.isArray(data)) return
      shared = { ...shared, points: new Map((data as { user_id: string; points: number }[]).map((r) => [r.user_id, r.points])), at: Date.now() }
    })
    .catch(() => {
      // Senza rete i livelli restano quelli già noti.
    })
    .finally(() => {
      shared = { ...shared, inflight: false, at: shared.points ? shared.at : Date.now() }
      listeners.forEach((l) => l())
    })
}

/** Come useLevels, ma condiviso fra tutte le istanze; con enabled=false non chiede niente. */
export function useSharedLevels(enabled: boolean): Map<string, number> | null {
  useEffect(() => {
    if (enabled) ensureShared()
  }, [enabled])
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => shared.points,
  )
}
