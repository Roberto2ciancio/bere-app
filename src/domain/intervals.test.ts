import { describe, expect, it } from 'vitest'
import { describeDays, intervalLabel, intervalMinutes, MIN_INTERVAL, MAX_INTERVAL } from './intervals'

describe('intervalMinutes', () => {
  it('ogni ora dalle 8 alle 22 include entrambi gli estremi', () => {
    const times = intervalMinutes(480, 1320, 60)
    expect(times).toHaveLength(15)
    expect(times[0]).toBe(480)
    expect(times.at(-1)).toBe(1320)
  })

  it('ogni 30 minuti dalle 8 alle 22 sono 29 promemoria', () => {
    expect(intervalMinutes(480, 1320, 30)).toHaveLength(29)
  })

  it('non supera mai la fine', () => {
    expect(intervalMinutes(480, 585, 30)).toEqual([480, 510, 540, 570])
  })

  it('una fine prima dell\'inizio non produce orari', () => {
    expect(intervalMinutes(1320, 480, 60)).toEqual([])
  })

  it('un intervallo non valido non produce orari e non si blocca', () => {
    expect(intervalMinutes(480, 1320, 0)).toEqual([])
    expect(intervalMinutes(480, 1320, -30)).toEqual([])
    expect(intervalMinutes(480, 1320, Number.NaN)).toEqual([])
  })

  it('i limiti lasciano fuori intervalli troppo fitti', () => {
    expect(MIN_INTERVAL).toBe(15)
    expect(MAX_INTERVAL).toBe(720)
  })
})

describe('intervalLabel', () => {
  it.each([
    [30, '30 min'],
    [45, '45 min'],
    [60, '1 ora'],
    [90, '1 ora e mezza'],
    [120, '2 ore'],
    [135, '135 min'],
  ])('%i minuti diventano "%s"', (minutes, label) => {
    expect(intervalLabel(minutes)).toBe(label)
  })
})

describe('describeDays', () => {
  it.each([
    [[1, 2, 3, 4, 5, 6, 7], 'Ogni giorno'],
    [[1, 2, 3, 4, 5], 'Lun-Ven'],
    [[6, 7], 'Sab-Dom'],
    [[5, 1, 3], 'Lun, Mer, Ven'],
  ])('%j diventa "%s"', (days, label) => {
    expect(describeDays(days)).toBe(label)
  })
})
