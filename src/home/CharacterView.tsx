import { useId } from 'react'
import { fillRatio, type ViewProps } from './views'

const SHAPES = {
  'drop-face': 'M50 6 C50 6 16 44 16 64 A34 32 0 0 0 84 64 C84 44 50 6 50 6 Z',
  cat: 'M18 14 L38 30 A38 36 0 0 1 62 30 L82 14 L84 56 A34 36 0 0 1 16 56 Z',
  fish: 'M6 54 C20 26 56 24 74 48 L94 30 C90 44 90 62 94 76 L74 60 C56 84 20 82 6 54 Z',
}

export type CharacterId = keyof typeof SHAPES

export function CharacterView({ shape, totalMl, goalMl, pulse }: ViewProps & { shape: CharacterId }) {
  const clip = useId()
  const level = fillRatio(totalMl, goalMl)
  const path = SHAPES[shape]
  return (
    <div key={pulse} className={pulse > 0 ? 'character-box slosh' : 'character-box'} data-testid={`character-${shape}`} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs>
          <clipPath id={clip}>
            <path d={path} />
          </clipPath>
        </defs>
        <path d={path} className="character-body" />
        <rect className="character-water" clipPath={`url(#${clip})`} x="0" width="100" y={100 - level * 100} height={level * 100} />
        <path d={path} className="character-outline" />
        <circle cx="39" cy="54" r="4" className="character-face" />
        <circle cx="61" cy="54" r="4" className="character-face" />
        <path d="M40 66 Q50 76 60 66" className="character-smile" />
      </svg>
    </div>
  )
}
