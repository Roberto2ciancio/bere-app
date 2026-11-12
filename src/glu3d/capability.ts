import { useEffect, useState } from 'react'
import { readCache, writeCache } from '../lib/cache'
import { isGlu3dOn } from '../mascot/glu3dPref'
import { GLU_3D_ENABLED } from './enabled'
import type { CheckResult } from './probe'

export type { CheckResult } from './probe'
export type Glu3dRuntime = typeof import('./runtime')

export const CHECK_KEY = 'bere.glu3dCheck'
export const CHOICE_TIMEOUT_MS = 4000
export { PROBE_FRAMES, SLOW_FRAME_MS } from './probe'

interface StoredCheck {
  result: CheckResult
  version: string
}

let runtime: Glu3dRuntime | null = null
let loading: Promise<Glu3dRuntime | null> | null = null
let probing: Promise<CheckResult> | null = null
// Oltre il tempo massimo resta 2D per tutta la visita.
let timedOut = false
// Il pacchetto non si è caricato: 2D per tutta la visita.
let loadFailed = false

/** Avvia (una volta sola) il caricamento del pacchetto 3D. No-op se il 3D è spento. */
export function startGlu3d(load?: () => Promise<Glu3dRuntime>): void {
  if (!GLU_3D_ENABLED || loading || !load) return
  loading = load().then(
    (r) => (runtime = r),
    () => {
      loadFailed = true
      return null
    },
  )
}

export function getRuntime(): Glu3dRuntime | null {
  return runtime
}

function savedCheck(): CheckResult | null {
  const c = readCache<StoredCheck>(CHECK_KEY)
  if (!c || typeof c !== 'object') return null
  if (c.version !== __APP_VERSION__) return null
  return c.result === 'ok' || c.result === 'slow' || c.result === 'nowebgl' ? c.result : null
}

function initial(userId: string | null): '3d' | '2d' | 'pending' {
  if (!GLU_3D_ENABLED || !userId || !isGlu3dOn(userId) || timedOut) return '2d'
  if (loadFailed) return '2d'
  const saved = savedCheck()
  if (saved && saved !== 'ok') return '2d'
  if (saved === 'ok' && runtime) return '3d'
  return 'pending'
}

async function resolveChoice(): Promise<'3d' | '2d'> {
  const rt = loading ? await loading : null
  if (!rt) return '2d'
  let result = savedCheck()
  if (!result) {
    try {
      probing ??= rt.probe()
      result = await probing
    } catch {
      result = 'nowebgl'
    } finally {
      probing = null
    }
    writeCache(CHECK_KEY, { result, version: __APP_VERSION__ } satisfies StoredCheck)
  }
  return result === 'ok' ? '3d' : '2d'
}

export function useGlu3dChoice(userId: string | null): '3d' | '2d' | 'pending' {
  const [choice, setChoice] = useState(() => initial(userId))

  useEffect(() => {
    if (choice !== 'pending') return
    let alive = true
    const timer = setTimeout(() => {
      timedOut = true
      if (alive) setChoice('2d')
    }, CHOICE_TIMEOUT_MS)
    void resolveChoice().then((c) => {
      if (!alive || timedOut) return
      clearTimeout(timer)
      setChoice(c)
    })
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [choice])

  return choice
}

/** Solo per i test: azzera lo stato del modulo. */
export function resetGlu3dForTests(): void {
  runtime = null
  loading = null
  probing = null
  timedOut = false
  loadFailed = false
}

