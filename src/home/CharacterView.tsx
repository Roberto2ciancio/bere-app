import { useId } from 'react'
import { fillRatio, type ViewProps } from './views'

const SHAPES = {
  'drop-face': 'M50 6 C50 6 16 44 16 64 A34 32 0 0 0 84 64 C84 44 50 6 50 6 Z',
  cat: 'M18 14 L38 30 A38 36 0 0 1 62 30 L82 14 L84 56 A34 36 0 0 1 16 56 Z',
  fish: 'M6 54 C20 26 56 24 74 48 L94 30 C90 44 90 62 94 76 L74 60 C56 84 20 82 6 54 Z',
  can: 'M36 5 H64 L70 14 V86 L64 95 H36 L30 86 V14 Z',
}

export type CharacterId = keyof typeof SHAPES

export function CharacterView({ shape, totalMl, goalMl, pulse }: ViewProps & { shape: CharacterId }) {
  const clip = useId()
  const level = fillRatio(totalMl, goalMl)
  const path = SHAPES[shape]
  const isCan = shape === 'can'
  return (
    <div key={pulse} className={`character-box character-${shape}${pulse > 0 ? ' slosh' : ''}`} data-testid={`character-${shape}`} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs>
          <clipPath id={clip}>
            <path d={path} />
          </clipPath>
        </defs>
        <path d={path} className="character-body" />
        <rect className="character-water" clipPath={`url(#${clip})`} x="0" width="100" y={100 - level * 100} height={level * 100} />
        <path d={path} className="character-outline" />
        {isCan ? (
          // Blu e argento come la lattina vera, ma senza logo: toro e scritta sono marchi registrati.
          <>
            <path d="M30 14 H70 M30 86 H70" className="can-rim" />
            <path d="M43 9 H57" className="can-tab" />
            <g className="can-pattern" clipPath={`url(#${clip})`}>
              <path d="M30 34 L50 22 L70 34 L50 46 Z" />
              <path d="M30 62 L50 50 L70 62 L50 74 Z" />
            </g>
          </>
        ) : (
          <>
            <circle cx="39" cy="54" r="4" className="character-face" />
            <circle cx="61" cy="54" r="4" className="character-face" />
            <path d="M40 66 Q50 76 60 66" className="character-smile" />
          </>
        )}
      </svg>
    </div>
  )
}
