import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { GluExtras } from '../../mascot/Glu'
import type { GluMood } from '../../mascot/mood'
import type { GluSpot } from './motion'

/** Quello che una pagina chiede a Glu: dove stare, con che umore e (nell'angolo) che frase dire. */
export interface GluSpotSpec {
  spot: GluSpot
  mood: GluMood
  fill?: number
  extras?: GluExtras
  text?: string
  calm?: boolean
}

interface Entry {
  id: string
  spec: GluSpotSpec | null
}

interface StageValue {
  active: boolean
  spec: GluSpotSpec | null
  /** Chi ha dichiarato il posto corrente: cambia a ogni pagina nuova (anche corner → corner). */
  specId: string | null
  ringEl: HTMLElement | null
  setEntry(id: string, spec: GluSpotSpec | null): void
  removeEntry(id: string): void
  setRing(el: HTMLElement | null): void
  fail(): void
}

const StageContext = createContext<StageValue | null>(null)

export function GluStageProvider({ active, children }: { active: boolean; children: ReactNode }) {
  // Le pagine si registrano in ordine: vale l'ultima arrivata (durante un cambio pagina
  // la vecchia può restare montata un attimo, ma la nuova ha già la parola).
  const [entries, setEntries] = useState<Entry[]>([])
  const [ringEl, setRingEl] = useState<HTMLElement | null>(null)
  const [failed, setFailed] = useState(false)

  const setEntry = useCallback((id: string, spec: GluSpotSpec | null) => {
    setEntries((list) => {
      const i = list.findIndex((e) => e.id === id)
      if (i < 0) return [...list, { id, spec }]
      const next = list.slice()
      next[i] = { id, spec }
      return next
    })
  }, [])
  const removeEntry = useCallback((id: string) => {
    setEntries((list) => list.filter((e) => e.id !== id))
  }, [])
  const fail = useCallback(() => setFailed(true), [])

  const current = entries.length ? entries[entries.length - 1] : null
  const spec = current ? current.spec : null
  const specId = current ? current.id : null
  const value = useMemo<StageValue>(
    () => ({ active: active && !failed, spec, specId, ringEl, setEntry, removeEntry, setRing: setRingEl, fail }),
    [active, failed, spec, specId, ringEl, setEntry, removeEntry, fail],
  )
  return <StageContext.Provider value={value}>{children}</StageContext.Provider>
}

/** Interno al palcoscenico (GluStage). */
export function useStageInternals(): StageValue | null {
  return useContext(StageContext)
}

/** La pagina dichiara dove sta Glu; null (o nessuna chiamata) vale 'away'. */
export function useGluSpot(spec: GluSpotSpec | null): void {
  const ctx = useContext(StageContext)
  const id = useId()
  // Oggetti scritti in linea dalle pagine: si confronta il contenuto, non l'identità.
  const key = spec ? JSON.stringify(spec) : null
  const setEntry = ctx?.setEntry
  const removeEntry = ctx?.removeEntry
  useEffect(() => {
    setEntry?.(id, key === null ? null : (JSON.parse(key) as GluSpotSpec))
  }, [setEntry, id, key])
  useEffect(() => () => removeEntry?.(id), [removeEntry, id])
}

/** Palcoscenico montato e non guasto. */
export function useGluStageActive(): boolean {
  return !!useContext(StageContext)?.active
}

/** Palcoscenico attivo e Glu in scena (posto corrente diverso da 'away'). */
export function useGluStageShowsGlu(): boolean {
  const ctx = useContext(StageContext)
  return !!ctx?.active && !!ctx.spec && ctx.spec.spot !== 'away'
}

const noop = () => {}

/** Ref da mettere sull'elemento che prenota l'anello della Home. */
export function useRingSlot(): (el: HTMLElement | null) => void {
  return useContext(StageContext)?.setRing ?? noop
}
