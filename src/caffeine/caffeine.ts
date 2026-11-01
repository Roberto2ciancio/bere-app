export type CaffeineKind = 'coffee' | 'redbull' | 'monster'

/** Espresso: valore tipico. Lattine da etichetta, 32 mg per 100 ml: Red Bull da 250 ml, Monster da 500 ml. */
export const CAFFEINE_MG: Record<CaffeineKind, number> = { coffee: 80, redbull: 80, monster: 160 }

/** Riferimento EFSA per un adulto sano nell'arco della giornata. */
export const CAFFEINE_LIMIT_MG = 400

export function summarizeCaffeine(entries: { kind: CaffeineKind; mg: number }[]) {
  const totalMg = entries.reduce((sum, e) => sum + e.mg, 0)
  const count = (kind: CaffeineKind) => entries.filter((e) => e.kind === kind).length
  return {
    totalMg,
    redBulls: count('redbull'),
    coffees: count('coffee'),
    monsters: count('monster'),
    overLimit: totalMg > CAFFEINE_LIMIT_MG,
  }
}
