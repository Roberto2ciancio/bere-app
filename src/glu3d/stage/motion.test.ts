import { describe, expect, it } from 'vitest'
import { travelFor, type GluSpot } from './motion'

const base = { still: false, calm: false }

describe('travelFor', () => {
  it.each<GluSpot>(['ring', 'corner', 'away'])('primo posto (%s): compare', (to) => {
    expect(travelFor(null, to, base)).toEqual({ kind: 'appear', ms: 0, hop: false })
  })
  it.each([
    ['ring', 'corner', { kind: 'fly', ms: 600, hop: true }],
    ['corner', 'ring', { kind: 'fly', ms: 600, hop: false }],
    ['corner', 'corner', { kind: 'hop', ms: 0, hop: true }],
    ['corner', 'away', { kind: 'walk-out', ms: 900, hop: false }],
    ['away', 'corner', { kind: 'walk-in', ms: 900, hop: false }],
    ['ring', 'away', { kind: 'fade', ms: 250, hop: false }],
    ['away', 'ring', { kind: 'fade', ms: 250, hop: false }],
  ] as [GluSpot, GluSpot, unknown][])('%s -> %s', (from, to, expected) => {
    expect(travelFor(from, to, base)).toEqual(expected)
  })
  it('still: sempre compare, senza saltelli', () => {
    const spots: (GluSpot | null)[] = [null, 'ring', 'corner', 'away']
    for (const f of spots)
      for (const t of ['ring', 'corner', 'away'] as GluSpot[])
        expect(travelFor(f, t, { still: true, calm: false })).toEqual({ kind: 'appear', ms: 0, hop: false })
  })
  it('calm: stessi kind e ms, senza saltelli', () => {
    expect(travelFor('ring', 'corner', { still: false, calm: true })).toEqual({ kind: 'fly', ms: 600, hop: false })
    expect(travelFor('corner', 'corner', { still: false, calm: true })).toEqual({ kind: 'hop', ms: 0, hop: false })
    expect(travelFor('corner', 'away', { still: false, calm: true })).toEqual({ kind: 'walk-out', ms: 900, hop: false })
  })
})
