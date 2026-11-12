import { describe, expect, it } from 'vitest'
import { ageOn, MIN_AGE } from './age'

const today = new Date(2026, 10, 12) // 12 novembre 2026

describe('ageOn', () => {
  it('conta gli anni compiuti', () => {
    expect(ageOn('1990-05-01', today)).toBe(36)
  })

  it('il giorno del compleanno gli anni sono compiuti, il giorno prima no', () => {
    expect(ageOn('2012-11-12', today)).toBe(14)
    expect(ageOn('2012-11-13', today)).toBe(13)
  })

  it('rifiuta date impossibili, future o mal scritte', () => {
    expect(ageOn('2010-02-30', today)).toBeNull()
    expect(ageOn('2030-01-01', today)).toBeNull()
    expect(ageOn('', today)).toBeNull()
    expect(ageOn('01/05/1990', today)).toBeNull()
    expect(ageOn('1800-01-01', today)).toBeNull()
  })

  it('la soglia è 14 anni (Italia), che copre anche i 13 degli Stati Uniti', () => {
    expect(MIN_AGE).toBe(14)
  })
})
