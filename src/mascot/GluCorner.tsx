import { Bubble } from './Bubble'
import { Glu } from './Glu'
import type { GluMood } from './mood'

interface Props {
  mood: GluMood
  text: string
  /** Quanto è pieno Glu (0-1): senza un dato della pagina un aspetto neutro. */
  fill?: number
}

/** Glu in piccolo in cima alle pagine: una frase sul contesto, senza coprire niente. */
export function GluCorner({ mood, text, fill = 0.6 }: Props) {
  return (
    <div className="glu-corner">
      <Glu mood={mood} fill={Math.min(1, Math.max(0, fill))} size={64} />
      <Bubble text={text} />
    </div>
  )
}
