import { useEffect, useState } from 'react'
import { NavLink, useOutlet } from 'react-router-dom'
import { useOptionalAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { useGlu3dChoice } from '../glu3d/capability'
import { GLU_3D_ENABLED } from '../glu3d/enabled'
import { GluStage } from '../glu3d/stage/GluStage'
import { GluStageProvider } from '../glu3d/stage/stageContext'
import { touchLastSeen } from '../lib/lastSeen'
import { useGlu3dOn } from '../mascot/glu3dPref'
import { backgroundUrl } from '../profile/imageUpload'
import { HomeIcon, ProfileIcon, StatsIcon, TrophyIcon } from './icons'
import { PageTransition } from './motion/PageTransition'
import { WhatsNew } from '../profile/WhatsNewDialog'
import { syncPushSubscription } from '../push/subscribe'

export function TabsLayout() {
  const { profile } = useProfile()
  const backgroundPath = profile?.background_path ?? null
  const outlet = useOutlet()
  // Glu 3D o 2D: finché non si sa, si aspetta (al massimo pochi secondi) per non cambiare Glu sotto gli occhi.
  const userId = useOptionalAuth()?.user?.id ?? null
  const gluChoice = useGlu3dChoice(userId)
  // Spegnere «Glu in 3D» vale subito; riaccenderlo riporta il 3D solo se la visita era partita in 3D.
  const glu3dOn = useGlu3dOn(userId)
  // Il palcoscenico: un solo Glu 3D che viaggia tra le schede (quando il 3D è scelto e acceso).
  const stage = GLU_3D_ENABLED && gluChoice === '3d' && glu3dOn
  const [background, setBackground] = useState<string | null>(null)

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
    <GluStageProvider active={stage}>
      <div className="shell">
        {background && <div className="shell-bg" style={{ backgroundImage: `url("${background}")` }} />}
        <div className="shell-body">
          {gluChoice === 'pending' ? <p className="center-note">Caricamento…</p> : <PageTransition>{outlet}</PageTransition>}
        </div>
        <nav className="tabs" aria-label="Sezioni">
          <NavLink to="/home"><span className="tab-icon"><HomeIcon /></span>Oggi</NavLink>
          <NavLink to="/storico"><span className="tab-icon"><StatsIcon /></span>Storico</NavLink>
          <NavLink to="/classifica"><span className="tab-icon"><TrophyIcon /></span>Classifica</NavLink>
          <NavLink to="/profilo"><span className="tab-icon"><ProfileIcon /></span>Profilo</NavLink>
        </nav>
        {GLU_3D_ENABLED && stage && <GluStage />}
        <WhatsNew />
      </div>
    </GluStageProvider>
  )
}
