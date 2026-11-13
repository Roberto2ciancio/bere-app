import { describe, expect, it, vi } from 'vitest'

const flag = vi.hoisted(() => ({ on: false }))
vi.mock('../../mascot/variantsFlag', () => ({
  get GLU_VARIANTS() {
    return flag.on
  },
}))

import { activeGuide } from './guide'
import { searchGuide } from './search'

describe('activeGuide e le varianti di Glu', () => {
  it('app vera (flag spento): niente «Cambiare Glu»', () => {
    flag.on = false
    expect(activeGuide().some((e) => e.id === 'glu-variants')).toBe(false)
    expect(searchGuide('come cambio Glu', activeGuide()).best?.id).not.toBe('glu-variants')
  })

  it('app di prova (flag acceso): «come cambio Glu» trova la voce', () => {
    flag.on = true
    expect(searchGuide('come cambio Glu', activeGuide()).best?.title).toBe('Cambiare Glu')
  })
})
