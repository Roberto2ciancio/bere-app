import { describe, expect, it } from 'vitest'
import { nextWalkDelay, walkTimeline } from './walks'

describe('nextWalkDelay', () => {
  it('copre 20-40 s', () => {
    expect(nextWalkDelay(() => 0)).toBe(20000)
    expect(nextWalkDelay(() => 1)).toBe(40000)
    expect(nextWalkDelay(() => 0.5)).toBe(30000)
  })
})

describe('walkTimeline', () => {
  const from = 300
  const to = 16
  it('andata', () => {
    expect(walkTimeline(0, from, to)).toEqual({ x: from, dir: -1, walking: true, done: false })
    const m = walkTimeline(1250, from, to)
    expect(m.x).toBeCloseTo((from + to) / 2, 0)
    expect(m.dir).toBe(-1)
  })
  it('sosta', () => {
    for (const t of [2500, 3000, 3500]) {
      expect(walkTimeline(t, from, to)).toEqual({ x: to, dir: 0, walking: false, done: false })
    }
  })
  it('ritorno e fine', () => {
    const m = walkTimeline(4750, from, to)
    expect(m.x).toBeCloseTo((from + to) / 2, 0)
    expect(m.dir).toBe(1)
    expect(m.walking).toBe(true)
    expect(walkTimeline(6000, from, to)).toEqual({ x: from, dir: 0, walking: false, done: true })
    expect(walkTimeline(9000, from, to).done).toBe(true)
  })
})
