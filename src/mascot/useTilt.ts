import { useCallback, useEffect, useRef, useState } from 'react'

export const TILT_MAX = 25
const KEY = 'bere.tiltPermission'
const RECHECK_MS = 2000

type Permission = 'granted' | 'denied'
type OrientationWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }

function permissionApi(): (() => Promise<string>) | null {
  if (typeof DeviceOrientationEvent === 'undefined') return null
  const request = (DeviceOrientationEvent as OrientationWithPermission).requestPermission
  return typeof request === 'function' ? request.bind(DeviceOrientationEvent) : null
}

function readPermission(): Permission | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'granted' || value === 'denied' ? value : null
  } catch {
    return null
  }
}

function storePermission(value: Permission): void {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    // Senza memoria l'invito può ricomparire: pazienza.
  }
}

/** L'inclinazione laterale del telefono (gamma, ±25°): ascolta solo se serve e aggiorna una volta a frame. */
export function useTilt(enabled: boolean) {
  const needsPermission = permissionApi() !== null
  const [permission, setPermission] = useState<Permission | null>(readPermission)
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  const [tilt, setTilt] = useState(0)
  const listening = enabled && visible && (!needsPermission || permission === 'granted')

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const decide = useCallback((value: Permission) => {
    storePermission(value)
    setPermission(value)
  }, [])

  const latest = useRef(0)
  useEffect(() => {
    if (!listening) return
    let frame = 0
    let gotEvent = false
    const startedAt = Date.now()
    const onOrientation = (event: Event) => {
      const gamma = (event as DeviceOrientationEvent).gamma
      if (typeof gamma !== 'number' || Number.isNaN(gamma)) return
      gotEvent = true
      // Mezzo grado: il rumore del sensore non deve ridisegnare 60 volte al secondo.
      latest.current = Math.round(Math.max(-TILT_MAX, Math.min(TILT_MAX, gamma)) * 2) / 2
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setTilt(latest.current)
      })
    }
    window.addEventListener('deviceorientation', onOrientation)

    // iOS può aver dimenticato il permesso salvato: se dopo 2 s non è arrivato nulla, al primo tocco lo richiede
    // (il tocco serve: fuori da un gesto iOS rifiuta). Se è ancora concesso risponde in silenzio.
    const ask = permissionApi()
    let asked = false
    const onTap = () => {
      if (!ask || asked || gotEvent || Date.now() - startedAt < RECHECK_MS) return
      asked = true
      ask().then(
        (answer) => answer !== 'granted' && decide('denied'),
        () => decide('denied'),
      )
    }
    if (ask) document.addEventListener('pointerdown', onTap, true)
    return () => {
      window.removeEventListener('deviceorientation', onOrientation)
      document.removeEventListener('pointerdown', onTap, true)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [listening, decide])

  /** Va chiamata da un tocco: su iOS il permesso non si può chiedere altrimenti. */
  const request = useCallback(async () => {
    const ask = permissionApi()
    if (!ask) return
    try {
      decide((await ask()) === 'granted' ? 'granted' : 'denied')
    } catch {
      decide('denied')
    }
  }, [decide])

  /** «Non ora»: l'invito non torna più, come dopo un rifiuto. */
  const dismiss = useCallback(() => decide('denied'), [decide])

  return { tilt: listening ? tilt : 0, needsPermission, permission, request, dismiss }
}
