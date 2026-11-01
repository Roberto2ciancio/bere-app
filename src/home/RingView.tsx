import { fillRatio, type ViewProps } from './views'

const RADIUS = 84
const LENGTH = 2 * Math.PI * RADIUS

export function RingView({ totalMl, goalMl, pulse }: ViewProps) {
  return (
    <div className="ring-box" data-testid="ring-view" aria-hidden="true">
      <svg viewBox="0 0 190 190">
        <circle className="ring-track" cx="95" cy="95" r={RADIUS} />
        <circle
          className="ring-fill"
          cx="95"
          cy="95"
          r={RADIUS}
          strokeDasharray={LENGTH}
          strokeDashoffset={LENGTH * (1 - fillRatio(totalMl, goalMl))}
        />
      </svg>
      {pulse > 0 && <span key={pulse} className="ripple" />}
    </div>
  )
}
