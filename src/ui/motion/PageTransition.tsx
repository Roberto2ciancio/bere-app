import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { m } from 'motion/react'

export const TAB_ORDER = ['/home', '/storico', '/classifica', '/profilo'] as const

// +1 se si va a una scheda più a destra, -1 a sinistra, 0 per le sottopagine (solo dissolvenza).
function direction(from: string, to: string): number {
  const a = TAB_ORDER.indexOf(from as (typeof TAB_ORDER)[number])
  const b = TAB_ORDER.indexOf(to as (typeof TAB_ORDER)[number])
  if (a < 0 || b < 0 || a === b) return 0
  return b > a ? 1 : -1
}

// Anima solo la pagina che entra: con l'uscita (AnimatePresence) la vecchia pagina resta
// nel DOM per un istante e i test trovano titoli doppi.
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [seen, setSeen] = useState({ path: pathname, dir: 0 })
  // Aggiornare lo stato durante il render (schema ufficiale) ricava la direzione dalla pagina precedente.
  if (seen.path !== pathname) setSeen({ path: pathname, dir: direction(seen.path, pathname) })
  const dir = seen.path === pathname ? seen.dir : 0

  return (
    <m.div
      key={pathname}
      className="page-transition"
      initial={{ opacity: 0, x: dir * 36 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </m.div>
  )
}
