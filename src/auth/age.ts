/**
 * Età minima per iscriversi: 14 anni, la soglia italiana per il consenso ai servizi online (art. 2-quinquies del
 * Codice privacy). Copre anche i 13 anni della COPPA negli Stati Uniti. Sotto questa età niente profilo.
 */
export const MIN_AGE = 14

/** Chiave sul telefono: chi ha indicato un'età troppo bassa non può riprovare subito cambiando la data. */
export const AGE_BLOCK_KEY = 'bere.ageBlocked'

/** Anni compiuti alla data `today` per chi è nato il giorno `birth` (formato AAAA-MM-GG). Null se la data non vale. */
export function ageOn(birth: string, today: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  let age = today.getFullYear() - year
  const beforeBirthday = today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)
  if (beforeBirthday) age -= 1
  if (age < 0 || age > 120) return null
  return age
}

export function isAgeBlocked(): boolean {
  try {
    return localStorage.getItem(AGE_BLOCK_KEY) === '1'
  } catch {
    return false
  }
}

export function blockAge() {
  try {
    localStorage.setItem(AGE_BLOCK_KEY, '1')
  } catch {
    // Senza spazio sul telefono il blocco vale solo per questa visita.
  }
}
