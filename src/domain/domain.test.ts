import { describe, expect, it } from 'vitest'
import { localParts } from './time'
import { goalChangeDate, goalForDate } from './goals'
import { isDue, nextReminder } from './reminders'
import { formatLiters } from './format'

const ROME = 'Europe/Rome'

describe('localParts', () => {
  it('keeps 8:00 local after the switch to daylight saving', () => {
    expect(localParts(new Date('2026-03-29T06:00:00Z'), ROME)).toMatchObject({ date: '2026-03-29', minutes: 480, weekday: 7 })
  })
  it('keeps 8:00 local before the switch', () => {
    expect(localParts(new Date('2026-03-28T07:00:00Z'), ROME)).toMatchObject({ minutes: 480, weekday: 6 })
  })
  it('counts 00:30 on the new local day', () => {
    expect(localParts(new Date('2026-11-01T23:30:00Z'), ROME).date).toBe('2026-11-02')
  })
  it('reports midnight as minute zero', () => {
    expect(localParts(new Date('2026-11-01T23:00:00Z'), ROME).minutes).toBe(0)
  })
})

describe('goals', () => {
  const changes = [
    { effectiveFrom: '2026-11-01', goalMl: 3000 },
    { effectiveFrom: '2026-11-03', goalMl: 2000 },
  ]
  it('uses the latest change not after the date', () => {
    expect(goalForDate(changes, '2026-11-02')).toBe(3000)
    expect(goalForDate(changes, '2026-11-03')).toBe(2000)
  })
  it('falls back to the default goal before any change', () => {
    expect(goalForDate(changes, '2026-10-01')).toBe(3000)
  })
  it('makes a goal change effective the next local day', () => {
    expect(goalChangeDate(new Date('2026-11-01T12:00:00Z'), ROME)).toBe('2026-11-02')
  })
  it('crosses month ends', () => {
    expect(goalChangeDate(new Date('2026-11-30T12:00:00Z'), ROME)).toBe('2026-12-01')
  })
})

describe('isDue', () => {
  const r = { weekdays: [1], minutes: 480 }
  it('is due at the exact minute', () => {
    expect(isDue(r, new Date('2026-11-02T07:00:00Z'), ROME)).toBe('2026-11-02')
  })
  it('is still due four minutes late', () => {
    expect(isDue(r, new Date('2026-11-02T07:04:00Z'), ROME)).toBe('2026-11-02')
  })
  it('is not due from five minutes late', () => {
    expect(isDue(r, new Date('2026-11-02T07:05:00Z'), ROME)).toBeNull()
  })
  it('is not due before the time', () => {
    expect(isDue(r, new Date('2026-11-02T06:59:00Z'), ROME)).toBeNull()
  })
  it('is not due on other weekdays', () => {
    expect(isDue(r, new Date('2026-11-03T07:00:00Z'), ROME)).toBeNull()
  })
  it('honours a reminder just before midnight when checked just after', () => {
    const late = { weekdays: [1], minutes: 1438 } // lunedì 23:58
    expect(isDue(late, new Date('2026-11-02T23:00:00Z'), ROME)).toBe('2026-11-02') // martedì 00:00
  })
})

describe('nextReminder', () => {
  const reminders = [
    { weekdays: [1], minutes: 480 },
    { weekdays: [1], minutes: 570 },
    { weekdays: [3], minutes: 600 },
  ]
  it('finds the next one today', () => {
    expect(nextReminder(reminders, new Date('2026-11-02T07:30:00Z'), ROME)).toEqual({ date: '2026-11-02', minutes: 570 })
  })
  it('skips to a later day', () => {
    expect(nextReminder(reminders, new Date('2026-11-02T10:00:00Z'), ROME)).toEqual({ date: '2026-11-04', minutes: 600 })
  })
  it('wraps to next week', () => {
    expect(nextReminder(reminders, new Date('2026-11-05T10:00:00Z'), ROME)).toEqual({ date: '2026-11-09', minutes: 480 })
  })
  it('returns null without reminders', () => {
    expect(nextReminder([], new Date('2026-11-02T07:30:00Z'), ROME)).toBeNull()
  })
})

describe('formatLiters', () => {
  it('uses the Italian decimal comma', () => {
    expect(formatLiters(1200)).toBe('1,2 L')
  })
  it('keeps a quarter liter exact', () => {
    expect(formatLiters(250)).toBe('0,25 L')
  })
  it('shows whole liters without decimals', () => {
    expect(formatLiters(3000)).toBe('3 L')
    expect(formatLiters(0)).toBe('0 L')
  })
})
