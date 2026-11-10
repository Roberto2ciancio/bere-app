import { useEffect, useState } from 'react'
import { NavLink, useOutlet } from 'react-router-dom'
import { useProfile } from '../auth/ProfileProvider'
import { touchLastSeen } from '../lib/lastSeen'
import { backgroundUrl } from '../profile/imageUpload'
import { HomeIcon, ProfileIcon, StatsIcon, TrophyIcon } from './icons'
import { PageTransition } from './motion/PageTransition'
import { WhatsNew } from '../profile/WhatsNewDialog'
import { syncPushSubscription } from '../push/subscribe'

export function TabsLayout() {
  const { profile } = useProfile()
  const style = profile?.home_style ?? 'bottle'
  const backgroundPath = profile?.background_path ?? null
  const outlet = useOutlet()
  const [background, setBackground] = useState<string | null>(null)

  useEffect(() => {
    // Serve solo alle viste della Home: non cambia più i colori
    document.documentElement.dataset.style = style
  }, [style])

  useEffect(() => {
    void syncPushSubscription().catch(() => {})
  }, [])

  useEffect(() => {
    touchLastSeen()
    const onVisible = () => document.visibilityState === 'visible' && touchLastSeen()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
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
        <PageTransition>{outlet}</PageTransition>
      </div>
      <nav className="tabs" aria-label="Sezioni">
        <NavLink to="/home"><span className="tab-icon"><HomeIcon /></span>Oggi</NavLink>
        <NavLink to="/storico"><span className="tab-icon"><StatsIcon /></span>Storico</NavLink>
        <NavLink to="/classifica"><span className="tab-icon"><TrophyIcon /></span>Classifica</NavLink>
        <NavLink to="/profilo"><span className="tab-icon"><ProfileIcon /></span>Profilo</NavLink>
      </nav>
      <WhatsNew />
    </div>
  )
}
