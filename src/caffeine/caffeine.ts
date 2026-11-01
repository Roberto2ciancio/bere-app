/** Espresso: valore tipico. */
export const COFFEE_MG = 80

/** Riferimento EFSA per un adulto sano nell'arco della giornata. */
export const CAFFEINE_LIMIT_MG = 400

export function summarizeCaffeine(entries: { kind: string; mg: number }[]) {
  const totalMg = entries.reduce((sum, e) => sum + e.mg, 0)
  return {
    totalMg,
    coffees: entries.filter((e) => e.kind === 'coffee').length,
    overLimit: totalMg > CAFFEINE_LIMIT_MG,
  }
}
