import { useCallback, useEffect, useRef, useState } from 'react'

export const TILT_MAX = 25
const KEY = 'bere.tiltPermission'

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

  const latest = useRef(0)
  useEffect(() => {
    if (!listening) return
    let frame = 0
    const onOrientation = (event: Event) => {
      const gamma = (event as DeviceOrientationEvent).gamma
      if (typeof gamma !== 'number' || Number.isNaN(gamma)) return
      latest.current = Math.max(-TILT_MAX, Math.min(TILT_MAX, gamma))
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setTilt(latest.current)
      })
    }
    window.addEventListener('deviceorientation', onOrientation)
    return () => {
      window.removeEventListener('deviceorientation', onOrientation)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [listening])

  const decide = useCallback((value: Permission) => {
    storePermission(value)
    setPermission(value)
  }, [])

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
