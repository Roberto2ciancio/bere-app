import { useState } from 'react'
import { Bubble } from '../mascot/Bubble'
import { Glu } from '../mascot/Glu'
import type { GluMood } from '../mascot/mood'
import { phraseFor } from '../mascot/phrases'
import { ProgressRing } from './ProgressRing'

/** Glu dentro l'anello del progresso, che si riempie d'acqua e dice la sua nel fumetto. */
export function GluView({ fill, mood, name, now }: { fill: number; mood: GluMood; name: string; now: number }) {
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
      <div className="ring-slot">
        <ProgressRing fill={fill} wide>
          <Glu mood={mood} fill={fill} size={186} />
        </ProgressRing>
      </div>
    </div>
  )
}
