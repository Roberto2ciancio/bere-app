import { beforeEach, describe, expect, it } from 'vitest'
import { isGlu3dOn, setGlu3dOn } from './glu3dPref'

beforeEach(() => localStorage.clear())

describe('glu3dPref', () => {
  it('è acceso di default', () => {
    expect(isGlu3dOn('u1')).toBe(true)
  })

  it('spegnendolo salva la chiave', () => {
    setGlu3dOn('u1', false)
    expect(isGlu3dOn('u1')).toBe(false)
    expect(localStorage.getItem('bere.glu3d.u1')).not.toBeNull()
  })

  it('riaccendendolo toglie la chiave', () => {
    setGlu3dOn('u1', false)
    setGlu3dOn('u1', true)
    expect(isGlu3dOn('u1')).toBe(true)
    expect(localStorage.getItem('bere.glu3d.u1')).toBeNull()
  })
})
