import type { ReactNode } from 'react'

const RADIUS = 46
const LENGTH = 2 * Math.PI * RADIUS

/**
 * Anello del progresso attorno al disegno al centro della Home (Glu o gli altri stili).
 * fill va da 0 a 1 ed è lo stesso valore della percentuale mostrata sotto.
 */
export function ProgressRing({ fill, wide = false, children }: { fill: number; wide?: boolean; children: ReactNode }) {
  const level = Number.isNaN(fill) ? 0 : Math.min(1, Math.max(0, fill))
  // A 0% resta un puntino in cima: fa capire da dove parte l'anello.
  const dash = Math.max(level * LENGTH, 0.5)
  return (
    <div className="progress-ring" data-testid="progress-ring">
      <svg className="progress-ring-svg" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="progress-ring-track" cx="50" cy="50" r={RADIUS} />
        <circle
          className="progress-ring-bar"
          data-testid="progress-ring-bar"
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={`${Math.round(dash * 100) / 100} ${Math.round(LENGTH * 100) / 100}`}
        />
      </svg>
      <div className={wide ? 'progress-ring-art wide' : 'progress-ring-art'}>{children}</div>
    </div>
  )
}
