// Viaggi di Glu tra i posti del palcoscenico (puro, senza React né three).
export type GluSpot = 'ring' | 'corner' | 'away'

export interface Travel {
  kind: 'appear' | 'fly' | 'hop' | 'walk-out' | 'walk-in' | 'fade'
  ms: number
  hop: boolean
}

export function travelFor(
  from: GluSpot | null,
  to: GluSpot,
  opts: { still: boolean; calm: boolean },
): Travel {
  const appear: Travel = { kind: 'appear', ms: 0, hop: false }
  if (opts.still || from === null || from === to && to !== 'corner') return appear
  let t: Travel
  if (from === 'corner' && to === 'corner') t = { kind: 'hop', ms: 0, hop: true }
  else if (from === 'ring' && to === 'corner') t = { kind: 'fly', ms: 600, hop: true }
  else if (from === 'corner' && to === 'ring') t = { kind: 'fly', ms: 600, hop: false }
  else if (from === 'corner' && to === 'away') t = { kind: 'walk-out', ms: 900, hop: false }
  else if (from === 'away' && to === 'corner') t = { kind: 'walk-in', ms: 900, hop: false }
  else t = { kind: 'fade', ms: 250, hop: false }
  return opts.calm ? { ...t, hop: false } : t
}
