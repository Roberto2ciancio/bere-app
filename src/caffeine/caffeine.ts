/** Milligrammi segnati da ogni tocco su "Caffè". Ogni voce salva i propri mg: cambiare il valore non tocca quelle passate. */
export const COFFEE_MG = 20

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
