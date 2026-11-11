import type { GluMood } from './mood'

// {nome} compare sempre dopo ", " o " ": senza nome si toglie insieme al separatore.
export const PHRASES: Record<GluMood, string[]> = {
  hello: [
    'Ciao {nome}! Che bello rivederti!',
    'Eccomi! Si parte con una giornata fresca?',
    'Buongiorno {nome}! Iniziamo con un sorso?',
    'Ehi, ci sei! Io ci sono sempre.',
    'Ciao ciao! Oggi si va a gonfie onde.',
  ],
  idle: [
    'Io sono qui, a fare il tifo goccia dopo goccia!',
    'Un sorso quando vuoi, senza fretta.',
    'Che bella giornata per un sorso fresco!',
    'Ti tengo compagnia mentre fai le tue cose.',
    'Tutto tranquillo qui, ondeggio un po’.',
  ],
  thirsty: [
    'Ho la gola secca… un sorso?',
    'Mi sento un po’ asciutto, ci beviamo su?',
    'Un bicchiere e torno a brillare!',
    'Psst, un sorso fa bene a tutti e due.',
  ],
  drink: [
    'Glu glu! Che buono!',
    'Glu glu! Eccone un altro, che forza!',
    'Glu glu glu! Mi sento già meglio!',
    'Fresco fresco! Glu glu!',
    'Glu glu! Un altro passo verso l’obiettivo.',
  ],
  almost: [
    'Ci siamo quasi! Ancora un sorso o due.',
    'Manca pochissimo, {nome}! Lo sento già.',
    'Quasi pieno! Che bella onda che fa.',
    'Ultimo tratto, {nome}: ci arriviamo insieme.',
    'Ancora un goccio e si fa festa!',
  ],
  goal: [
    'Obiettivo raggiunto! Sono fiero di te, {nome}!',
    'Ce l’abbiamo fatta! Che giornata, {nome}!',
    'Missione compiuta! Splash di gioia!',
    'Evviva! Oggi hai fatto centro, {nome}.',
  ],
  sad: [
    'Ieri è andata così… oggi ci riproviamo?',
    'Mi manca un po’ d’acqua, {nome}.',
    'Nessun problema, un sorso e si riparte.',
    'Ci sono io con te, {nome}. Piano piano.',
  ],
  sleep: [
    'Zzz… ci vediamo domani!',
    'Shh, sto sognando un lago.',
    'Zzz… buonanotte, goccia dopo goccia.',
    'Riposo un po’, a domani!',
  ],
  levelup: [
    'Nuovo livello, {nome}! Che salto!',
    'Nuovo livello raggiunto! Facciamo festa!',
    'Livello su! Hai un talento che sprizza, {nome}.',
    'Wow, che crescita! Sono con te, {nome}.',
  ],
  coffee: [
    'Un caffè? Poi un sorso d’acqua, ti va?',
    'Che profumino! Io resto fresco.',
    'Caffè e acqua vanno d’accordo, sai?',
    'Gustalo con calma, io sto qui.',
  ],
  workout: [
    'Si parte! Io ti seguo a ritmo di onde.',
    'Che energia! Un sorso dopo, eh?',
    'Dai dai dai, io faccio il tifo!',
    'Muoviamoci! Poi si beve insieme.',
  ],
}

/** Frasi su misura: festa della corona, sete forte, caffè oltre il limite (al massimo 60 caratteri, lingua neutra). */
export const SPECIAL_PHRASES = {
  streak7: ['7 giorni di fila! Guarda che corona.'],
  streak14: ['14 giorni di fila! La corona ora ha una gemma.'],
  streak30: ['30 giorni di fila! Corona e mantellina: che stile.'],
  thirstyStrong: [
    'Ho la gola secca… un sorso insieme?',
    'Mi sventolo un po’: un bicchiere d’acqua?',
    'Un sorso e torno a gonfiarmi di gioia!',
    'Sono tutto asciutto… beviamo qualcosa?',
  ],
  coffeeOver: ['Tanta caffeina oggi: un bicchiere d’acqua ci sta.', 'Che giornata di caffè! Io ti aspetto con l’acqua.'],
} as const

export type SpecialPhrase = keyof typeof SPECIAL_PHRASES

// Le battute di Glu in cima a Storico, Classifica e Profilo (al massimo 60 caratteri, lingua neutra).
export const CORNER_PHRASES = {
  historyIdle: 'Ogni giorno a obiettivo conta, piano piano.',
  boardLeader: 'Sei in testa!',
  boardIdle: 'Ogni sorso conta per la classifica.',
  profileWithName: 'Ciao {nome}! Qui sistemi tutto a modo tuo.',
  profileNoName: 'Ciao! Qui sistemi tutto a modo tuo.',
} as const

export const historyStreakPhrase = (days: number) => `Serie di ${days === 1 ? '1 giorno' : `${days} giorni`}! Continuiamo così.`

export const profileGreeting = (name: string) => {
  const first = name.trim().split(/\s+/)[0]
  return first ? CORNER_PHRASES.profileWithName.replace('{nome}', first.slice(0, 20)) : CORNER_PHRASES.profileNoName
}

function hash(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

export function specialPhraseFor(kind: SpecialPhrase, now: number): string {
  const list = SPECIAL_PHRASES[kind]
  return list[Math.floor(now / 30000) % list.length]
}

// Stabile per blocchi di 30 s, così il fumetto non sfarfalla a ogni render.
export function phraseFor(mood: GluMood, name: string, now: number): string {
  const list = PHRASES[mood]
  const raw = list[(Math.floor(now / 30000) + hash(mood)) % list.length]
  const n = name.trim()
  if (n) return raw.replaceAll('{nome}', n)
  return raw.replace(/[, ]\s*\{nome\}/g, '').replace(/\s{2,}/g, ' ')
}
