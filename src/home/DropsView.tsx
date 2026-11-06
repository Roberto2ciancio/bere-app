import type { CSSProperties } from 'react'
import type { ViewProps } from './views'

const MAX_DROPS = 30

export function DropsView({ totalMl, goalMl, drinkMl, pulse }: ViewProps) {
  const count = Math.min(MAX_DROPS, Math.max(1, Math.ceil(goalMl / drinkMl)))
  const filled = Math.min(count, Math.floor((totalMl / goalMl) * count + 1e-9))
  return (
    <div className="drops" data-testid="drops-view" aria-hidden="true" style={{ '--rows': Math.ceil(count / 5) } as CSSProperties}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i === filled - 1 ? `${i}-${pulse}` : i}
          className={`drop${i < filled ? ' on' : ''}${pulse > 0 && i === filled - 1 ? ' pop' : ''}`}
        />
      ))}
    </div>
  )
}
