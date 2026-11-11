import { useState } from 'react'
import { Bubble } from '../mascot/Bubble'
import { Glu } from '../mascot/Glu'
import type { GluMood } from '../mascot/mood'
import { phraseFor } from '../mascot/phrases'
import { fillRatio, type ViewProps } from './views'

/** Glu che si riempie d'acqua e dice la sua nel fumetto. */
export function GluView({ totalMl, goalMl, mood, name, now }: ViewProps & { mood: GluMood; name: string; now: number }) {
  // La frase si sceglie quando cambia l'umore o il nome, non a ogni render.
  const [chosen, setChosen] = useState(() => ({ mood, name, text: phraseFor(mood, name, now) }))
  let text = chosen.text
  if (chosen.mood !== mood || chosen.name !== name) {
    text = phraseFor(mood, name, now)
    setChosen({ mood, name, text })
  }
  return (
    <div className="glu-box" data-testid="glu-view">
      <Bubble text={text} />
      <div className="glu-art">
        <Glu mood={mood} fill={fillRatio(totalMl, goalMl)} size={240} />
      </div>
    </div>
  )
}
