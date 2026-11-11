import { describe, expect, it } from 'vitest'
import { CORNER_PHRASES, historyStreakPhrase, PHRASES, phraseFor, profileGreeting, SPECIAL_PHRASES } from './phrases'
import type { GluMood } from './mood'

const moods = Object.keys(PHRASES) as GluMood[]

describe('PHRASES', () => {
  it.each(moods)('%s: 4-6 frasi, al massimo 60 caratteri', (mood) => {
    expect(PHRASES[mood].length).toBeGreaterThanOrEqual(4)
    expect(PHRASES[mood].length).toBeLessThanOrEqual(6)
    for (const p of PHRASES[mood]) expect(p.length).toBeLessThanOrEqual(60)
  })

  it('ha frasi per ogni umore, anche «almost»', () => {
    expect(PHRASES.almost?.length).toBeGreaterThanOrEqual(4)
  })

  it('drink contiene «glu glu!» in ogni frase', () => {
    for (const p of PHRASES.drink) expect(p.toLowerCase()).toContain('glu glu')
    expect(PHRASES.drink.some((p) => p.toLowerCase().includes('glu glu!'))).toBe(true)
  })
})

describe('PHRASES: lingua neutra', () => {
  it('nessuna forma al maschile/femminile rivolta a chi usa l’app', () => {
    const vietate = /(bravo|brava|salito|salita|stanco|stanca|pronto a|pronta a|pronto per|pronta per|contento|contenta|solo|sola)/i
    for (const mood of moods) for (const p of PHRASES[mood]) expect(p).not.toMatch(vietate)
  })
})

describe('frasi di Glu in Storico, Classifica e Profilo', () => {
  const all = () => [
    ...Object.values(CORNER_PHRASES).filter((p) => !p.includes('{nome}')),
    historyStreakPhrase(1),
    historyStreakPhrase(7),
    historyStreakPhrase(365),
    profileGreeting('Anna'),
    profileGreeting('Anna Maria Rossi'),
    profileGreeting('  '),
  ]
  it('al massimo 60 caratteri e senza segnaposto', () => {
    for (const p of all()) {
      expect(p.length).toBeLessThanOrEqual(60)
      expect(p).not.toContain('{nome}')
    }
    expect(profileGreeting('x'.repeat(40)).length).toBeLessThanOrEqual(60)
  })
  it('nessuna forma al maschile/femminile rivolta a chi usa l’app', () => {
    const vietate = /(bravo|brava|salito|salita|stanco|stanca|pronto a|pronta a|pronto per|pronta per|contento|contenta|solo|sola)/i
    for (const p of all()) expect(p).not.toMatch(vietate)
  })
  it('usa il primo nome e il singolare per un giorno', () => {
    expect(profileGreeting('Anna Maria')).toBe('Ciao Anna! Qui sistemi tutto a modo tuo.')
    expect(historyStreakPhrase(1)).toBe('Serie di 1 giorno! Continuiamo così.')
  })
})

describe('phraseFor', () => {
  it('sostituisce {nome} e non lo lascia mai', () => {
    for (const mood of moods) {
      for (let i = 0; i < 6; i++) {
        const t = i * 30000
        const out = phraseFor(mood, 'Anna', t)
        expect(out).not.toContain('{nome}')
      }
    }
    const seen = PHRASES.goal.map((_, i) => phraseFor('goal', 'Anna', i * 30000))
    expect(seen.some((s) => s.includes('Anna'))).toBe(true)
  })

  it('senza nome: niente virgole o spazi doppi sbagliati', () => {
    for (const mood of moods) {
      for (let i = 0; i < 6; i++) {
        const out = phraseFor(mood, '', i * 30000)
        expect(out).not.toContain('{nome}')
        expect(out).not.toMatch(/\s{2,}/)
        expect(out).not.toMatch(/,\s*[!.?]/)
        expect(out).not.toMatch(/\s[!.?,]/)
      }
    }
    expect(phraseFor('hello', '   ', 0)).not.toMatch(/\s{2,}/)
  })

  it('stesso risultato nello stesso blocco di 30 s', () => {
    for (const mood of moods) {
      const t = 5 * 30000 + 100
      expect(phraseFor(mood, 'Anna', t)).toBe(phraseFor(mood, 'Anna', t + 29_000 - 100))
    }
  })

  it('cambia frase al blocco successivo', () => {
    expect(phraseFor('idle', 'Anna', 0)).not.toBe(phraseFor('idle', 'Anna', 30000))
  })
})

describe('SPECIAL_PHRASES', () => {
  it('al massimo 60 caratteri, lingua neutra', () => {
    const vietate = /(bravo|brava|salito|salita|stanco|stanca|pronto a|pronta a|pronto per|pronta per|contento|contenta|solo|sola)/i
    for (const list of Object.values(SPECIAL_PHRASES)) {
      for (const p of list) {
        expect(p.length).toBeLessThanOrEqual(60)
        expect(p).not.toMatch(vietate)
      }
    }
  })
  it('il caffè usa il tu: «Gustalo con calma»', () => {
    expect(PHRASES.coffee).toContain('Gustalo con calma, io sto qui.')
  })
})
