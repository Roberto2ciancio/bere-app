// Passeggiate di Glu nell'angolo (puro).
export const WALK_MIN_MS = 20000
export const WALK_MAX_MS = 40000
export const WALK_LEG_MS = 2500
export const WALK_PAUSE_MS = 1000

export function nextWalkDelay(random: () => number): number {
  return WALK_MIN_MS + random() * (WALK_MAX_MS - WALK_MIN_MS)
}

// Andata, sosta, ritorno. t in ms dall'inizio della passeggiata.
export function walkTimeline(
  t: number,
  fromX: number,
  toX: number,
): { x: number; dir: -1 | 0 | 1; walking: boolean; done: boolean } {
  const out: -1 | 1 = toX >= fromX ? 1 : -1
  const back: -1 | 1 = out === 1 ? -1 : 1
  const total = WALK_LEG_MS * 2 + WALK_PAUSE_MS
  if (t >= total) return { x: fromX, dir: 0, walking: false, done: true }
  if (t < WALK_LEG_MS) {
    const p = Math.max(0, t) / WALK_LEG_MS
    return { x: fromX + (toX - fromX) * p, dir: out, walking: true, done: false }
  }
  if (t <= WALK_LEG_MS + WALK_PAUSE_MS) return { x: toX, dir: 0, walking: false, done: false }
  const p = (t - WALK_LEG_MS - WALK_PAUSE_MS) / WALK_LEG_MS
  return { x: toX + (fromX - toX) * p, dir: back, walking: true, done: false }
}
