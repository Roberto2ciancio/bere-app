import { useEffect, useRef, useState } from 'react'
import type { Units } from '../domain/hydration'
import { useGluVariant } from '../mascot/useGluVariant'
import type { PreparedWeek } from '../share/shareWeek'
import type { DayResult } from './stats'

interface Props {
  /** Gli ultimi 7 giorni, oggi compreso. */
  week: DayResult[]
  currentStreak: number
  units: Units | undefined
  today: string
  /** Attesa prima di preparare l'immagine in anticipo, per non rallentare l'apertura dello Storico. */
  prepareDelayMs?: number
}

type ShareModule = typeof import('../share/shareWeek')

interface Pending {
  key: string
  promise: Promise<{ mod: ShareModule; prepared: PreparedWeek }>
  /** Pronta: al tocco si condivide subito, senza attese (Safari vuole il tocco «fresco»). */
  ready?: { mod: ShareModule; prepared: PreparedWeek }
}

/** «Condividi la settimana»: l'immagine si prepara in anticipo, in un pezzo di codice caricato a parte. */
export function ShareWeekButton({ week, currentStreak, units, today, prepareDelayMs = 1500 }: Props) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const pending = useRef<Pending | null>(null)
  // Glu dell'immagine nei colori della variante scelta (classico in produzione: stessa immagine di sempre).
  const { id: variantId, palette } = useGluVariant()
  // Cambiano i dati (una bevuta, un altro giorno, un altro Glu): l'immagine pronta non vale più.
  const key = JSON.stringify([week, currentStreak, units, today, variantId])
  const latest = useRef({ week, currentStreak, units, today, palette })
  latest.current = { week, currentStreak, units, today, palette }

  function prepare(forKey: string): Pending {
    if (pending.current?.key === forKey) return pending.current
    const args = latest.current
    const entry: Pending = {
      key: forKey,
      promise: import('../share/shareWeek').then(async (mod) => ({
        mod,
        prepared: await mod.prepareWeek(args.week, args.currentStreak, args.units, args.today, args.palette),
      })),
    }
    entry.promise.then(
      (result) => {
        entry.ready = result
      },
      () => {
        // Al prossimo tocco si riprova da capo.
        if (pending.current === entry) pending.current = null
      },
    )
    pending.current = entry
    return entry
  }

  useEffect(() => {
    const timer = setTimeout(() => prepare(key), prepareDelayMs)
    return () => clearTimeout(timer)
    // prepare legge i dati da latest: basta la chiave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, prepareDelayMs])

  async function share() {
    if (busy) return
    setFailed(false)
    const entry = prepare(key)
    if (entry.ready) {
      // Nessuna attesa prima di navigator.share.
      const outcome = entry.ready.mod.shareWeekImage(entry.ready.prepared)
      try {
        await outcome
      } catch {
        setFailed(true)
      }
      return
    }
    setBusy(true)
    try {
      const { mod, prepared } = await entry.promise
      await mod.shareWeekImage(prepared)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="secondary share-week" aria-disabled={busy || undefined} aria-busy={busy || undefined} onClick={() => void share()}>
        {busy ? "Preparo l'immagine…" : 'Condividi la settimana'}
      </button>
      <span className="visually-hidden" role="status">{busy ? "Preparo l'immagine…" : ''}</span>
      {failed && <p role="alert" className="error">Non sono riuscito a preparare l'immagine. Riprova.</p>}
    </>
  )
}
