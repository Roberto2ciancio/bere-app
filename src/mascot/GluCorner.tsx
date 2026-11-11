import { Bubble } from './Bubble'
import { useGluAccessories } from './accessories'
import { Glu } from './Glu'
import type { CrownTier } from './reactions'
import type { GluMood } from './mood'

interface Props {
  mood: GluMood
  text: string
  /** Quanto è pieno Glu (0-1): senza un dato della pagina un aspetto neutro. */
  fill?: number
  /** Corona già nota alla pagina (lo Storico ha la serie): altrimenti quella salvata. */
  crown?: CrownTier
}

/** Glu in piccolo in cima alle pagine: una frase sul contesto, senza coprire niente. */
export function GluCorner({ mood, text, fill = 0.6, crown }: Props) {
  const accessories = useGluAccessories()
  return (
    <div className="glu-corner">
      <Glu mood={mood} fill={Math.min(1, Math.max(0, fill))} size={64} extras={{ crown: crown ?? accessories.crown, headband: accessories.headband }} />
      <Bubble text={text} />
    </div>
  )
}
