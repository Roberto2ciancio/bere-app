import { describe, expect, it } from 'vitest'
import { PHRASES, phraseFor } from './phrases'
import type { GluMood } from './mood'

const moods = Object.keys(PHRASES) as GluMood[]

describe('PHRASES', () => {
  it.each(moods)('%s: 4-6 frasi, al massimo 60 caratteri', (mood) => {
    expect(PHRASES[mood].length).toBeGreaterThanOrEqual(4)
    expect(PHRASES[mood].length).toBeLessThanOrEqual(6)
    for (const p of PHRASES[mood]) expect(p.length).toBeLessThanOrEqual(60)
  })

  it('drink contiene «glu glu!» in ogni frase', () => {
    for (const p of PHRASES.drink) expect(p.toLowerCase()).toContain('glu glu')
    expect(PHRASES.drink.some((p) => p.toLowerCase().includes('glu glu!'))).toBe(true)
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
