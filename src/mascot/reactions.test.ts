import { describe, expect, it } from 'vitest'
import { coffeeActive, nextStreakReward, streakAccessory, thirstLevel } from './reactions'

const at = (h: number, m = 0) => new Date(2026, 10, 11, h, m)
const dayStart = at(8)

describe('thirstLevel', () => {
  it('sale tra 2 e 4 ore', () => {
    expect(thirstLevel(at(8), at(9, 59), dayStart)).toBe(0)
    expect(thirstLevel(at(8), at(11), dayStart)).toBe(0.5)
    expect(thirstLevel(at(8), at(12), dayStart)).toBe(1)
    expect(thirstLevel(at(8), at(13), dayStart)).toBe(1)
  })
  it('nessuna bevuta oggi: conta dall’inizio giornata', () => {
    expect(thirstLevel(null, at(9), dayStart)).toBe(0)
    expect(thirstLevel(null, at(11), dayStart)).toBe(0.5)
  })
  it('bevuta di ieri sera: conta dall’inizio giornata', () => {
    const yesterday = new Date(2026, 10, 10, 22)
    expect(thirstLevel(yesterday, at(9), dayStart)).toBe(0)
    expect(thirstLevel(yesterday, at(11), dayStart)).toBe(0.5)
  })
})

describe('coffeeActive', () => {
  it('attivo per 20 minuti', () => {
    expect(coffeeActive(at(10), at(10, 19))).toBe(true)
    expect(coffeeActive(at(10), at(10, 21))).toBe(false)
    expect(coffeeActive(null, at(10))).toBe(false)
  })
})

describe('streakAccessory', () => {
  it('traguardi 7, 14, 30', () => {
    const cases: [number, number][] = [[6, 0], [7, 7], [13, 7], [14, 14], [29, 14], [30, 30]]
    for (const [streak, tier] of cases) expect(streakAccessory(streak)).toBe(tier)
  })
})

describe('nextStreakReward', () => {
  it('festeggia il traguardo nuovo', () => {
    expect(nextStreakReward(7, 0)).toEqual({ celebrate: 7, store: 7 })
    expect(nextStreakReward(30, 7)).toEqual({ celebrate: 30, store: 30 })
  })
  it('non ripete lo stesso traguardo', () => {
    expect(nextStreakReward(8, 7)).toEqual({ celebrate: null, store: 7 })
  })
  it('scende di soglia: si ricorda la nuova, risalire festeggia', () => {
    expect(nextStreakReward(7, 30)).toEqual({ celebrate: null, store: 7 })
    expect(nextStreakReward(14, 7)).toEqual({ celebrate: 14, store: 14 })
  })
  it('rottura: azzera, poi si festeggia di nuovo a 7', () => {
    expect(nextStreakReward(3, 7)).toEqual({ celebrate: null, store: 0 })
    expect(nextStreakReward(7, 0)).toEqual({ celebrate: 7, store: 7 })
  })
})
