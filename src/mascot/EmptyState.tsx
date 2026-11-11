import type { CSSProperties, ReactNode } from 'react'
import { Glu } from './Glu'
import type { GluMood } from './mood'

interface Props {
  mood: GluMood
  title: string
  size?: number
  /** Glu accanto al testo invece che sopra: per le pagine con un modulo subito sotto. */
  compact?: boolean
  children?: ReactNode
}

/** Una pagina senza niente da mostrare: Glu e una riga che dice perché, senza spingere giù le azioni. */
export function EmptyState({ mood, title, size = 120, compact = false, children }: Props) {
  return (
    <div className={compact ? 'empty-state compact' : 'empty-state'} style={{ '--glu-size': `${size}px` } as CSSProperties}>
      <Glu mood={mood} fill={0.5} size={size} />
      <p className="empty-state-title">{title}</p>
      {children}
    </div>
  )
}
