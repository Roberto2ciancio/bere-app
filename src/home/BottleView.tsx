import { fillRatio, type ViewProps } from './views'

const BUBBLES = [14, 62, 30, 78, 44, 22]

export function BottleView({ totalMl, goalMl, pulse }: ViewProps) {
  return (
    <div className="bottle-box" data-testid="bottle-view" aria-hidden="true">
      <div className="bottle-cap" />
      <div key={pulse} className={pulse > 0 ? 'bottle slosh' : 'bottle'}>
        <div className="water" data-testid="bottle-water" style={{ height: `${fillRatio(totalMl, goalMl) * 100}%` }}>
          <svg className="wave" viewBox="0 0 200 10" preserveAspectRatio="none">
            <path d="M0 10V5q12.5-5 25 0t25 0 25 0 25 0 25 0 25 0 25 0 25 0v5z" />
          </svg>
        </div>
        {pulse > 0 &&
          BUBBLES.map((left, i) => <span key={i} className="bubble" style={{ left: `${left}%`, animationDelay: `${i * 80}ms` }} />)}
      </div>
    </div>
  )
}
