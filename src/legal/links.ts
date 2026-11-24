/** Pagine pubbliche in public/: si leggono senza accedere (servono anche alla scheda del Play Store). */
export type LegalPage = 'privacy' | 'termini' | 'cancella-account'

export function legalUrl(page: LegalPage): string {
  return `${import.meta.env.BASE_URL}${page}.html`
}
