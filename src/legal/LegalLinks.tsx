import { legalUrl } from './links'

/** Privacy e condizioni d'uso, leggibili anche senza profilo. */
export function LegalLinks() {
  return (
    <p className="hint legal-links">
      <a href={legalUrl('privacy')}>Privacy</a>
      <span aria-hidden="true"> · </span>
      <a href={legalUrl('termini')}>Condizioni d'uso</a>
    </p>
  )
}
