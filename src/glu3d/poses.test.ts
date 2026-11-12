import { describe, expect, it } from 'vitest'
import { poseFor, type PoseInput } from './poses'

const base: PoseInput = { mood: 'idle', extras: {}, fill: 0.5, t: 1, moodT: 0, calm: false, still: false }
const p = (o: Partial<PoseInput>) => poseFor({ ...base, ...o })

describe('poseFor', () => {
  it('hello: saluta poi abbassa il braccio', () => {
    expect(p({ mood: 'hello', moodT: 0.5 }).armR).toBeGreaterThan(1)
    expect(p({ mood: 'hello', moodT: 3 }).armR).toBeLessThan(0.3)
  })
  it('drink: salto con braccia su, poi a terra', () => {
    const a = p({ mood: 'drink', moodT: 0.3 })
    expect(a.jumpY).toBeGreaterThan(0)
    expect(a.armL).toBeGreaterThan(2)
    expect(a.armR).toBeGreaterThan(2)
    expect(p({ mood: 'drink', moodT: 1 }).jumpY).toBe(0)
  })
  it('sleep e coffee', () => {
    const s = p({ mood: 'sleep' })
    expect(s.eyeOpen).toBe(0)
    expect(s.zzz).toBe(true)
    expect(p({ mood: 'coffee' }).eyeOpen).toBe(1)
    const ex = { jitter: true }
    const sh = [0.1, 0.2].map((t) => p({ mood: 'coffee', extras: ex, t }).shakeX)
    expect(sh.some((x) => x !== 0)).toBe(true)
  })
  it('sete', () => {
    const a = p({ extras: { thirst: 0 } })
    expect(Math.abs(a.scaleY - 1)).toBeLessThanOrEqual(0.02)
    expect(a.bodyColor).toBe('#CFEBFB')
    const b = p({ extras: { thirst: 1 } })
    expect(b.scaleY).toBeLessThanOrEqual(0.93)
    expect(b.bodyColor).toBe('#9DB4C4')
    expect(b.fan).toBe(true)
    const m = p({ extras: { thirst: 0.5 } }).bodyColor
    expect(m).not.toBe('#CFEBFB')
    expect(m).not.toBe('#9DB4C4')
  })
  it('corona', () => {
    for (const c of [7, 14, 30] as const) expect(p({ extras: { crown: c } }).crown).toBe(c)
    expect(p({ extras: { crown: 7, crownDrop: true }, moodT: 0 }).crownDropY).toBeGreaterThan(0)
    expect(p({ extras: { crown: 7, crownDrop: true }, moodT: 1.5 }).crownDropY).toBe(0)
  })
  it('inclinazione e livello', () => {
    expect(p({ extras: { tilt: 20 } }).waterTilt).toBe(-20)
    expect(p({ fill: 0.4 }).waterLevel).toBe(0.4)
  })
  it('calm spegne sete, tremarella, sudore, inclinazione; restano fascia e corona', () => {
    const a = p({ calm: true, extras: { thirst: 1, jitter: true, sweat: true, tilt: 20, headband: true, crown: 14 } })
    expect(a.shakeX).toBe(0)
    expect(a.fan).toBe(false)
    expect(a.sweat).toBe(false)
    expect(a.waterTilt).toBe(0)
    expect(a.bodyColor).toBe('#CFEBFB')
    expect(a.headband).toBe(true)
    expect(a.crown).toBe(14)
  })
  it('still: niente movimento nel tempo', () => {
    const ex = { thirst: 0.4, jitter: true }
    expect(p({ still: true, t: 0, extras: ex })).toEqual(p({ still: true, t: 7.3, extras: ex }))
    const d = p({ mood: 'drink', still: true, moodT: 0.3 })
    expect(d.jumpY).toBe(0)
    expect(d.armL).toBeLessThan(0.3)
  })
})
