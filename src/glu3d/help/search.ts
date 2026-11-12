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
export const MIN_SCORE = 2

/** Il primo deve superare il secondo di almeno il 20%. */
const GAP = 1.2

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
])

/** Gruppi di sinonimi: la prima parola è la forma canonica. Estendere qui. */
export const SYNONYMS: string[][] = [
  ['notifica', 'avviso', 'push'],
  ['obiettivo', 'meta', 'target'],
  ['togliere', 'cancellare', 'eliminare', 'rimuovere', 'annullare', 'cancello'],
  ['bevuta', 'acqua', 'bere', 'bevo', 'bevuto', 'bicchiere'],
  ['segnare', 'registrare', 'annotare', 'aggiungere', 'inserire'],
  ['caffe', 'caffeina', 'espresso'],
  ['storico', 'cronologia'],
  ['telefono', 'cellulare', 'smartphone'],
  ['installare', 'scaricare'],
  ['uscire', 'logout', 'disconnettere'],
  ['foto', 'immagine'],
  ['scuro', 'dark', 'notte'],
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

function score(q: string[], e: GuideEntry): number {
  const p = prepare(e)
  let kw = 0
  let ti = 0
  for (const t of q) {
    if (has(p.keywords, t)) kw += 3
    if (has(p.title, t)) ti += 2
  }
  let qs = 0
  for (const sentence of p.questions) {
    qs = Math.max(qs, q.filter((t) => has(sentence, t)).length)
  }
  return (kw + ti + qs) / Math.sqrt(q.length)
}

export function searchGuide(
  query: string,
  entries: GuideEntry[],
): { best: GuideEntry | null; suggestions: GuideEntry[] } {
  const q = [...new Set(normalize(query))]
  if (q.length === 0) return { best: null, suggestions: [] }
  const ranked = entries
    .map((e) => ({ e, s: score(q, e) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
  const top = ranked[0]
  const sure = top && top.s >= MIN_SCORE && (!ranked[1] || top.s >= ranked[1].s * GAP)
  if (sure) {
    return { best: top.e, suggestions: ranked.slice(1, 3).map((r) => r.e) }
  }
  return { best: null, suggestions: ranked.slice(0, 3).map((r) => r.e) }
}
