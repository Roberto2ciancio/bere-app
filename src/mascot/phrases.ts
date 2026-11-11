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
}

function hash(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

// Stabile per blocchi di 30 s, così il fumetto non sfarfalla a ogni render.
export function phraseFor(mood: GluMood, name: string, now: number): string {
  const list = PHRASES[mood]
  const raw = list[(Math.floor(now / 30000) + hash(mood)) % list.length]
  const n = name.trim()
  if (n) return raw.replaceAll('{nome}', n)
  return raw.replace(/[, ]\s*\{nome\}/g, '').replace(/\s{2,}/g, ' ')
}
