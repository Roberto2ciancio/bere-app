import { describe, expect, it } from 'vitest'
import { MIN_SCORE, normalize, searchGuide, type GuideEntry } from './search'

const entry = (e: Partial<GuideEntry> & { id: string; title: string }): GuideEntry => ({
  questions: [],
  keywords: [],
  answer: ['passo'],
  ...e,
})

const goal = entry({
  id: 'goal',
  title: "Cambiare l'obiettivo",
  questions: ["come cambio l'obiettivo", 'voglio bere meno al giorno'],
  keywords: ['obiettivo', 'cambiare', 'meta'],
})
const remove = entry({
  id: 'remove',
  title: 'Togliere una bevuta',
  questions: ['ho sbagliato quantità', 'come tolgo una bevuta'],
  keywords: ['togliere', 'sbagliato'],
})
const notif = entry({
  id: 'notif',
  title: 'Attivare le notifiche',
  questions: ['non arrivano le notifiche'],
  keywords: ['notifica', 'avviso'],
})
const coffee = entry({
  id: 'coffee',
  title: 'Caffè e caffeina',
  questions: ['il caffè conta come acqua'],
  keywords: ['caffè', 'caffeina'],
})
const entries = [goal, remove, notif, coffee]

describe('normalize', () => {
  it('toglie parole vuote e porta alla radice', () => {
    const w = normalize("Come cambio L'obiettivo?")
    expect(w).toContain('cambi')
    expect(w).toContain('obiettiv')
    expect(w).not.toContain('come')
    expect(w).not.toContain('l')
  })
  it('gestisce plurali in -che e verbi', () => {
    const w = normalize('Perché non arrivano le notifiche!')
    expect(w).toContain('notific')
    expect(w).toContain('arriv')
  })
  it('toglie gli accenti', () => {
    expect(normalize('caffè')).toEqual(['caff'])
  })
  it('bb diventa b', () => {
    expect(normalize('obbiettivo')).toEqual(normalize('obiettivo'))
  })
  it("L'obiettivo! → obiettiv", () => {
    expect(normalize("L'obiettivo!")).toEqual(['obiettiv'])
  })
})

describe('searchGuide', () => {
  it('trova la voce giusta', () => {
    expect(searchGuide("come cambio l'obiettivo", entries).best?.id).toBe('goal')
    expect(searchGuide('non arrivano le notifiche', entries).best?.id).toBe('notif')
  })
  it('usa i sinonimi: eliminare → togliere', () => {
    expect(searchGuide('eliminare una bevuta', entries).best?.id).toBe('remove')
  })
  it('tollera obbiettivo con doppia b', () => {
    expect(searchGuide('obbiettivo', entries).best?.id).toBe('goal')
  })
  it('frase senza senso: niente', () => {
    const r = searchGuide('xyz qwerty', entries)
    expect(r.best).toBeNull()
    expect(r.suggestions).toEqual([])
  })
  it('query vuota: niente', () => {
    expect(searchGuide('  ', entries)).toEqual({ best: null, suggestions: [] })
  })
  it('pari merito: nessun best, due suggerimenti', () => {
    const a = entry({ id: 'a', title: 'Alfa', keywords: ['tazza'] })
    const b = entry({ id: 'b', title: 'Beta', keywords: ['tazza'] })
    const r = searchGuide('tazza', [a, b, coffee])
    expect(r.best).toBeNull()
    expect(r.suggestions.map((s) => s.id).sort()).toEqual(['a', 'b'])
  })
  it('suggestions max 3 e senza best', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      entry({ id: `e${i}`, title: `Voce ${i}`, keywords: ['tazza'], questions: [] }),
    )
    const r = searchGuide('tazza', [...many, goal])
    expect(r.suggestions.length).toBeLessThanOrEqual(3)
    const strong = searchGuide("cambiare l'obiettivo", [...many, goal, remove, notif])
    expect(strong.best?.id).toBe('goal')
    expect(strong.suggestions.length).toBeLessThanOrEqual(3)
    expect(strong.suggestions).not.toContain(strong.best)
  })
  it('MIN_SCORE è positivo', () => {
    expect(MIN_SCORE).toBeGreaterThan(0)
  })
})
