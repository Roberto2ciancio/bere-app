import { CHANGELOG } from './changelog'

type Release = (typeof CHANGELOG)[number]

export const SEEN_VERSION_KEY = 'bere.seenVersion'

/** 1.10.0 viene dopo 1.9.0: si confrontano i numeri, non il testo. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Le versioni da presentare all'avvio.
 * - Nessuna versione vista e nessun dato salvato: è una nuova installazione, niente popup.
 * - Nessuna versione vista ma dati già presenti: chi usava l'app prima di questo popup vede la versione attuale.
 * - Altrimenti: tutte le versioni uscite dopo l'ultima vista, dalla più recente.
 */
export function releasesToShow(seen: string | null, current: string, hadData: boolean, changelog: Release[] = CHANGELOG): Release[] {
  if (seen === null) return hadData ? changelog.filter((r) => r.version === current) : []
  return changelog.filter((r) => compareVersions(r.version, seen) > 0 && compareVersions(r.version, current) <= 0)
}

let hadDataAtStartup = false

export const startedWithData = () => hadDataAtStartup

/** Da chiamare prima del primo render: dopo, l'app stessa salva dati e una nuova installazione sembrerebbe vecchia. */
export function rememberStartupData(storage: Storage = localStorage) {
  try {
    hadDataAtStartup = Object.keys(storage).some((key) => key.startsWith('bere.') && key !== SEEN_VERSION_KEY)
  } catch {
    hadDataAtStartup = false
  }
}

export function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_VERSION_KEY)
  } catch {
    return null
  }
}

export function writeSeen(version: string) {
  try {
    localStorage.setItem(SEEN_VERSION_KEY, version)
  } catch {
    // Senza spazio salvato il popup ricomparirà: meglio che bloccare l'app.
  }
}


export const NEWS_READ_KEY = 'bere.newsRead'

/** Il pallino sull'icona della Newsletter: c'è una versione che non hai ancora aperto lì. */
export function hasUnreadNews(current: string = __APP_VERSION__): boolean {
  try {
    const read = localStorage.getItem(NEWS_READ_KEY)
    return read === null || compareVersions(current, read) > 0
  } catch {
    return false
  }
}

export function markNewsRead(current: string = __APP_VERSION__) {
  try {
    localStorage.setItem(NEWS_READ_KEY, current)
  } catch {
    // Il pallino resterà acceso: meglio che bloccare la pagina.
  }
}
