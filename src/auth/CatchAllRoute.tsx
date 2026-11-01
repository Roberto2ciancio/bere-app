import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

const LINK_TIMEOUT_MS = 10_000

/**
 * I link via email arrivano nell'hash, lo stesso che usa il router. Va lasciato lì finché Supabase
 * non lo legge e lo ripulisce: reindirizzare subito lo cancellerebbe e il link non funzionerebbe più.
 */
export function CatchAllRoute() {
  useLocation() // Ridisegna quando Supabase ripulisce l'hash.
  const [gaveUp, setGaveUp] = useState(false)
  const hash = window.location.hash
  const waitingForLink = hash.includes('access_token=')

  useEffect(() => {
    if (!waitingForLink) return
    const timer = setTimeout(() => setGaveUp(true), LINK_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [waitingForLink])

  if (hash.includes('error_code=') || hash.includes('error=')) return <Navigate to="/recupera" replace state={{ linkExpired: true }} />
  if (waitingForLink && !gaveUp) return <p className="center-note">Caricamento…</p>
  return <Navigate to="/home" replace />
}
