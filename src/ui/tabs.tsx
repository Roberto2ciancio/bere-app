import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useProfile } from '../auth/ProfileProvider'
import { backgroundUrl } from '../profile/imageUpload'
import { syncPushSubscription } from '../push/subscribe'

export function TabsLayout() {
  const { profile } = useProfile()
  const style = profile?.home_style ?? 'bottle'
  const backgroundPath = profile?.background_path ?? null
  const [background, setBackground] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.dataset.style = style
  }, [style])

  useEffect(() => {
    void syncPushSubscription().catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    if (!backgroundPath) {
      setBackground(null)
      return
    }
    void backgroundUrl(backgroundPath).then((url) => {
      if (active) setBackground(url)
    })
    return () => {
      active = false
    }
  }, [backgroundPath])

  return (
    <div className="shell">
      {background && <div className="shell-bg" style={{ backgroundImage: `url("${background}")` }} />}
      <div className="shell-body">
        <Outlet />
      </div>
      <nav className="tabs" aria-label="Sezioni">
        <NavLink to="/home">Oggi</NavLink>
        <NavLink to="/storico">Storico</NavLink>
        <NavLink to="/classifica">Classifica</NavLink>
        <NavLink to="/profilo">Profilo</NavLink>
      </nav>
    </div>
  )
}
