import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GLU_VARIANTS_LIST, unlockedVariants, variantById } from './variants'

const state = vi.hoisted(() => ({
  flag: true,
  homeStyle: 'menta' as string,
  userId: 'u1' as string | null,
  points: null as Map<string, number> | null,
}))
vi.mock('./variantsFlag', () => ({
  get GLU_VARIANTS() {
    return state.flag
  },
}))
vi.mock('../auth/ProfileProvider', () => ({ useOptionalProfile: () => ({ profile: { home_style: state.homeStyle } }) }))
vi.mock('../auth/AuthProvider', () => ({ useOptionalAuth: () => (state.userId ? { user: { id: state.userId } } : null) }))
vi.mock('../levels/useLevels', () => ({ useLevels: () => state.points }))

import { useGluVariant } from './useGluVariant'

const HEX = /^#[0-9A-F]{6}$/i

describe('tabella varianti', () => {
  it('ha esattamente le sei varianti con livelli e colori validi', () => {
    expect(GLU_VARIANTS_LIST.map((v) => [v.id, v.name, v.level, v.detail])).toEqual([
      ['glu', 'Glu', 1, 'none'],
      ['menta', 'Glu Menta', 2, 'mint'],
      ['limone', 'Glu Limone', 3, 'lemon'],
      ['fragola', 'Glu Fragola', 4, 'strawberry'],
      ['cocco', 'Glu Cocco', 5, 'straw'],
      ['notte', 'Glu Notte', 6, 'moon'],
    ])
    for (const v of GLU_VARIANTS_LIST) for (const c of Object.values(v.palette)) expect(c).toMatch(HEX)
    expect(variantById('glu').palette).toEqual({ body: '#CFEBFB', water: '#19A0E8', limb: '#8CCDF2', feet: '#19A0E8' })
  })
  it('variantById ripiega su classico e unlockedVariants segue il livello', () => {
    expect(variantById('boh').id).toBe('glu')
    expect(unlockedVariants(1).map((v) => v.id)).toEqual(['glu'])
    expect(unlockedVariants(3).map((v) => v.id)).toEqual(['glu', 'menta', 'limone'])
    expect(unlockedVariants(9)).toHaveLength(6)
  })
})

describe('useGluVariant', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.assign(state, { flag: true, homeStyle: 'menta', userId: 'u1', points: null })
  })
  const id = () => renderHook(() => useGluVariant()).result.current.id

  it('livello sufficiente → la scelta', () => {
    state.points = new Map([['u1', 100]]) // livello 2
    expect(id()).toBe('menta')
  })
  it('variante bloccata → classico', () => {
    state.homeStyle = 'notte'
    state.points = new Map([['u1', 100]])
    expect(id()).toBe('glu')
  })
  it('flag spento → classico', () => {
    state.flag = false
    state.points = new Map([['u1', 5000]])
    expect(id()).toBe('glu')
  })
  it('livello sconosciuto senza cache → classico', () => {
    expect(id()).toBe('glu')
  })
  it('livello sconosciuto con cache sufficiente → la scelta', () => {
    localStorage.setItem('bere.lastLevel.u1', '3')
    expect(id()).toBe('menta')
  })
  it('livello sconosciuto con cache insufficiente → classico', () => {
    localStorage.setItem('bere.lastLevel.u1', '1')
    expect(id()).toBe('glu')
  })
})
