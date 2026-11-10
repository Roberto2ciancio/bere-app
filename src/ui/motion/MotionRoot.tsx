import type { ReactNode } from 'react'
import { LazyMotion, MotionConfig } from 'motion/react'

// Le funzionalità di animazione si caricano a parte, fuori dal bundle principale.
const loadFeatures = () => import('./features').then((r) => r.default)

// strict: in tutta l'app si usano solo i componenti `m.*`, per tenere leggero il bundle.
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
