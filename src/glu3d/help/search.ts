// Ricerca offline nella guida di Glu: pura, senza React e senza rete.

export interface GuideEntry {
  id: string
  title: string
  questions: string[]
  keywords: string[]
  answer: string[]
  route?: string
}

/** Sotto questa soglia non c'è una risposta sicura. */
export const MIN_SCORE = 3

/** Il primo deve superare il secondo di almeno il 20%. */
const GAP = 1.2

/** Soglia dei suggerimenti: almeno MIN_SCORE × 0,5 e il 35% del punteggio del primo. */
export const SUGGEST_MIN_FACTOR = 0.5
export const SUGGEST_REL = 0.35

/** Parole vuote italiane (già senza accenti). Aggiungere qui, in minuscolo. */
export const STOPWORDS = new Set([
  // articoli e preposizioni
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
  'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
  'del', 'dello', 'della', 'dei', 'degli', 'delle',
  'al', 'allo', 'alla', 'ai', 'agli', 'alle',
  'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
  'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
  'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
  // congiunzioni e pronomi
  'e', 'o', 'ma', 'che', 'chi', 'cui', 'se', 'anche', 'non', 'si', 'mi', 'ti', 'ci', 'vi',
  'io', 'tu', 'mio', 'mia', 'miei', 'questo', 'questa', 'quello', 'quella',
  // domande e verbi di servizio
  'come', 'cosa', 'dove', 'quando', 'quanto', 'perche', 'perch', 'quale', 'quali',
  'posso', 'puoi', 'puo', 'possibile', 'voglio', 'vorrei', 'devo', 'deve',
  'fare', 'faccio', 'fa', 'fai', 'essere', 'sono', 'ho', 'ha', 'hai', 'ce', 'c',
  'dimmi', 'spiegami', 'aiuto', 'ciao', 'grazie', 'favore', 'app',
  // riempitivi
  'dell', 'dall', 'nell', 'sull', 'all', 'quell', 'cos', 'qual', 'dov', 'com', 'anch', 'un',
  'piu', 'molto', 'poco', 'mai', 'sempre', 'dopo', 'poi', 'quindi', 'dovrei', 'quanta', 'quanti', 'quante',
])

/** Gruppi di sinonimi: la prima parola è la forma canonica. Estendere qui. */
export const SYNONYMS: string[][] = [
  ['notifica', 'avviso', 'push'],
  ['obiettivo', 'target'],
  ['togliere', 'cancellare', 'eliminare', 'rimuovere', 'annullare', 'cancello'],
  ['bevuta', 'bere', 'bevo', 'bevuto'],
  ['segnare', 'registrare', 'annotare'],
  ['caffe', 'caffeina', 'espresso'],
  ['storico', 'cronologia'],
  ['telefono', 'cellulare', 'smartphone'],
  ['installare', 'scaricare'],
  ['uscire', 'logout', 'disconnettere'],
  ['foto', 'immagine'],
  ['scuro', 'dark', 'tema', 'buio'],
]

const SUFFIXES = ['iamo', 'ando', 'endo', 'ano', 'ono', 'are', 'ere', 'ire', 'ato', 'ati', 'ata', 'ate', 'i', 'e', 'o', 'a']

/** Radice leggera: una sola desinenza, solo se la parola resta di almeno 4 lettere. */
function stem(w: string): string {
  if (w.length <= 3) return w
  if ((w.endsWith('che') || w.endsWith('chi')) && w.length - 2 >= 4) return w.slice(0, -2)
  if ((w.endsWith('ghe') || w.endsWith('ghi')) && w.length - 2 >= 4) return w.slice(0, -2)
  for (const s of SUFFIXES) {
    if (w.endsWith(s) && w.length - s.length >= 4) return w.slice(0, -s.length)
  }
  return w
}

function clean(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/bb/g, 'b')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
}

const canonical = new Map<string, string>()
for (const group of SYNONYMS) {
  const head = stem(clean(group[0])[0])
  for (const word of group) for (const w of clean(word)) canonical.set(stem(w), head)
}

/** Parole normalizzate: senza accenti, parole vuote e articoli, con radice e sinonimi unificati. */
export function normalize(text: string): string[] {
  const out: string[] = []
  for (const w of clean(text)) {
    if (w.length < 2 || STOPWORDS.has(w)) continue
    const s = stem(w)
    out.push(canonical.get(s) ?? s)
  }
  return out
}

/** Stessa radice, o una è l'altra con una lettera in più (cambio/cambi). */
function close(a: string, b: string): boolean {
  if (a === b) return true
  // Plurale in -e/-i di una parola di 4 lettere (mese/mesi): stessa radice, vocale finale diversa.
  if (a.length === b.length && a.length === 4 && a.slice(0, 3) === b.slice(0, 3) && 'ei'.includes(a[3]) && 'ei'.includes(b[3])) return true
  const [s, l] = a.length <= b.length ? [a, b] : [b, a]
  return s.length >= 4 && l.length - s.length <= 1 && l.startsWith(s)
}

const has = (set: string[], t: string) => set.some((k) => close(k, t))

interface Prepared {
  keywords: string[]
  title: string[]
  questions: string[][]
}
const cache = new WeakMap<GuideEntry, Prepared>()
function prepare(e: GuideEntry): Prepared {
  let p = cache.get(e)
  if (!p) {
    p = {
      keywords: e.keywords.flatMap(normalize),
      title: normalize(e.title),
      questions: e.questions.map(normalize),
    }
    cache.set(e, p)
  }
  return p
}

/**
 * Peso di una parola: quelle che compaiono in molte voci («bevuta», «notifica») contano meno di quelle rare.
 * Va da 1 (in tutte le voci) a 4 (in una sola): i punteggi non scendono mai sotto quelli senza pesi.
 */
function weightOf(t: string, entries: GuideEntry[]): number {
  const n = entries.length
  if (n < 2) return 1
  const df = entries.filter((e) => {
    const p = prepare(e)
    return has(p.keywords, t) || has(p.title, t) || p.questions.some((sentence) => has(sentence, t))
  }).length
  return df === 0 ? 1 : 1 + (3 * Math.log(n / df)) / Math.log(n)
}

function score(q: string[], e: GuideEntry, weights: number[]): number {
  const p = prepare(e)
  let sum = 0
  q.forEach((t, i) => {
    if (has(p.keywords, t)) sum += 3 * weights[i]
    if (has(p.title, t)) sum += 2 * weights[i]
  })
  let qs = 0
  for (const sentence of p.questions) {
    qs = Math.max(qs, q.reduce((acc, t, i) => (has(sentence, t) ? acc + weights[i] : acc), 0))
  }
  return (sum + qs) / Math.sqrt(q.length)
}

/** Le voci con almeno un punto, dalla migliore. */
export function rankGuide(query: string, entries: GuideEntry[]): { entry: GuideEntry; score: number }[] {
  const q = [...new Set(normalize(query))]
  if (q.length === 0) return []
  const weights = q.map((t) => weightOf(t, entries))
  return entries
    .map((entry) => ({ entry, score: score(q, entry, weights) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
}

export function searchGuide(
  query: string,
  entries: GuideEntry[],
): { best: GuideEntry | null; suggestions: GuideEntry[] } {
  const ranked = rankGuide(query, entries)
  const top = ranked[0]
  const sure = top && top.score >= MIN_SCORE && (!ranked[1] || top.score >= ranked[1].score * GAP)
  // Niente argomenti scollegati: un suggerimento deve valere almeno metà soglia e il 35% del primo.
  const floor = top ? Math.max(MIN_SCORE * SUGGEST_MIN_FACTOR, top.score * SUGGEST_REL) : 0
  const near = (list: typeof ranked) => list.filter((r) => r.score >= floor).map((r) => r.entry)
  if (sure) {
    return { best: top.entry, suggestions: near(ranked.slice(1, 3)) }
  }
  return { best: null, suggestions: near(ranked.slice(0, 3)) }
}
