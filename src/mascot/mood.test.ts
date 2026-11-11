import { describe, expect, it } from 'vitest'
import { pickMood, type MoodState } from './mood'

const base: MoodState = {
  nowMinutes: 600,
  totalMl: 500,
  goalMl: 2000,
  expectedMl: null,
  todayMinutes: [480, 720, 1080],
  paused: false,
  justDrank: false,
  levelUp: false,
  firstOpenToday: false,
  yesterdayMet: null,
  sadShown: false,
}
const mood = (o: Partial<MoodState>) => pickMood({ ...base, ...o })

describe('pickMood: ogni umore', () => {
  it('idle di default', () => expect(mood({})).toBe('idle'))
  it('drink', () => expect(mood({ justDrank: true })).toBe('drink'))
  it('levelup', () => expect(mood({ levelUp: true })).toBe('levelup'))
  it('goal', () => expect(mood({ totalMl: 2000 })).toBe('goal'))
  it('sleep in pausa', () => expect(mood({ paused: true })).toBe('sleep'))
  it('sleep prima della fascia (min - 30)', () => {
    expect(mood({ nowMinutes: 449 })).toBe('sleep')
    expect(mood({ nowMinutes: 450 })).toBe('idle')
  })
  it('sleep dopo la fascia (max + 60)', () => {
    expect(mood({ nowMinutes: 1141 })).toBe('sleep')
    expect(mood({ nowMinutes: 1140 })).toBe('idle')
  })
  it('hello', () => expect(mood({ firstOpenToday: true })).toBe('hello'))
  it('sad', () => expect(mood({ yesterdayMet: false })).toBe('sad'))
  it('thirsty', () => {
    expect(mood({ nowMinutes: 720, expectedMl: 1000, totalMl: 500 })).toBe('thirsty')
  })
})

describe('pickMood: priorità adiacenti', () => {
  it('drink > levelup', () => expect(mood({ justDrank: true, levelUp: true })).toBe('drink'))
  it('drink > goal', () => expect(mood({ justDrank: true, totalMl: 2000 })).toBe('drink'))
  it('levelup > goal', () => expect(mood({ levelUp: true, totalMl: 2000 })).toBe('levelup'))
  it('goal > sleep', () => expect(mood({ totalMl: 2000, nowMinutes: 1400 })).toBe('goal'))
  it('sleep > hello', () => expect(mood({ paused: true, firstOpenToday: true })).toBe('sleep'))
  it('hello > sad', () => {
    expect(mood({ firstOpenToday: true, yesterdayMet: false })).toBe('hello')
  })
  it('sad > thirsty', () => {
    const late = { nowMinutes: 800, expectedMl: 1000, totalMl: 100 }
    expect(mood({ ...late, yesterdayMet: false })).toBe('sad')
    expect(mood({ ...late, yesterdayMet: false, sadShown: true })).toBe('thirsty')
  })
  it('thirsty > idle', () => {
    expect(mood({ nowMinutes: 800, expectedMl: 1000, totalMl: 100 })).toBe('thirsty')
  })
})

describe('pickMood: casi limite', () => {
  it('senza promemoria alle 23:30 e senza pausa non dorme', () => {
    expect(mood({ todayMinutes: [], nowMinutes: 1410 })).toBe('idle')
  })
  it('goalMl 0 non è obiettivo raggiunto', () => {
    expect(mood({ goalMl: 0, totalMl: 0 })).toBe('idle')
  })
  it('thirsty non prima di mezzogiorno', () => {
    expect(mood({ nowMinutes: 719, expectedMl: 1000, totalMl: 0 })).toBe('idle')
  })
  it('thirsty solo sotto il 60% dell\'atteso', () => {
    expect(mood({ nowMinutes: 800, expectedMl: 1000, totalMl: 600 })).toBe('idle')
    expect(mood({ nowMinutes: 800, expectedMl: 1000, totalMl: 599 })).toBe('thirsty')
  })
  it('expectedMl null o 0 non è thirsty', () => {
    expect(mood({ nowMinutes: 800, expectedMl: null, totalMl: 0 })).toBe('idle')
    expect(mood({ nowMinutes: 800, expectedMl: 0, totalMl: 0 })).toBe('idle')
  })
  it('sad non se ieri è andata bene o sconosciuto', () => {
    expect(mood({ yesterdayMet: true })).toBe('idle')
    expect(mood({ yesterdayMet: null })).toBe('idle')
  })
})
