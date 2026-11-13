import type { CSSProperties, ReactNode } from 'react'
import { useGluStageShowsGlu } from '../glu3d/stage/stageContext'
import { useGluAccessories } from './accessories'
import { Glu } from './Glu'
import type { GluMood } from './mood'
import { useGluVariant } from './useGluVariant'

interface Props {
  mood: GluMood
  title: string
  size?: number
  /** Glu accanto al testo invece che sopra: per le pagine con un modulo subito sotto. */
  compact?: boolean
  children?: ReactNode
}

/** Una pagina senza niente da mostrare: Glu (se non è già in scena) e una riga che dice perché, senza spingere giù le azioni. */
export function EmptyState({ mood, title, size = 120, compact = false, children }: Props) {
  const accessories = useGluAccessories()
  const variant = useGluVariant()
  // Col palcoscenico Glu è già in scena: niente secondo Glu.
  const stageGlu = useGluStageShowsGlu()
  return (
    <div className={compact ? 'empty-state compact' : 'empty-state'} style={{ '--glu-size': `${size}px` } as CSSProperties}>
      {!stageGlu && <Glu mood={mood} fill={0.5} size={size} variant={variant} extras={accessories} />}
      <p className="empty-state-title">{title}</p>
      {children}
    </div>
  )
}
