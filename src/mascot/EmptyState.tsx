import type { ReactNode } from 'react'
import { Glu } from './Glu'
import type { GluMood } from './mood'

interface Props {
  mood: GluMood
  title: string
  children?: ReactNode
}

/** Una pagina senza niente da mostrare: Glu e una riga che dice perché, senza spingere giù le azioni. */
export function EmptyState({ mood, title, children }: Props) {
  return (
    <div className="empty-state">
      <Glu mood={mood} fill={0.5} size={120} />
      <p className="empty-state-title">{title}</p>
      {children}
    </div>
  )
}
