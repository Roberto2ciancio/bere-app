import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shareImage } from './shareImage'

const blob = new Blob(['png'], { type: 'image/png' })

describe('shareImage', () => {
  let clicked: HTMLAnchorElement[]

  beforeEach(() => {
    clicked = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this)
    })
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'share')
    Reflect.deleteProperty(navigator, 'canShare')
  })

  function stubShare(share: (data: ShareData) => Promise<void>, canShare = true) {
    Object.defineProperty(navigator, 'share', { value: vi.fn(share), configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: vi.fn(() => canShare), configurable: true })
  }

  it('con la condivisione dei file: manda il PNG e non scarica niente', async () => {
    stubShare(async () => {})
    await expect(shareImage(blob, 'bere-settimana.png', 'La mia settimana su Bere')).resolves.toBe('shared')
    const data = vi.mocked(navigator.share).mock.calls[0][0] as ShareData
    expect(data.title).toBe('La mia settimana su Bere')
    expect(data.files?.[0].name).toBe('bere-settimana.png')
    expect(data.files?.[0].type).toBe('image/png')
    expect(clicked).toHaveLength(0)
  })

  it('senza condivisione dei file: scarica il PNG con il nome giusto', async () => {
    stubShare(async () => {}, false)
    await expect(shareImage(blob, 'bere-settimana.png', 'La mia settimana su Bere')).resolves.toBe('downloaded')
    expect(navigator.share).not.toHaveBeenCalled()
    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe('bere-settimana.png')
    expect(clicked[0].href).toBe('blob:fake')
  })

  it('senza navigator.share: scarica', async () => {
    await expect(shareImage(blob, 'bere-settimana.png', 'x')).resolves.toBe('downloaded')
    expect(clicked).toHaveLength(1)
  })

  it('annullata da chi condivide: «cancelled», niente download', async () => {
    stubShare(async () => {
      throw new DOMException('annullata', 'AbortError')
    })
    await expect(shareImage(blob, 'bere-settimana.png', 'x')).resolves.toBe('cancelled')
    expect(clicked).toHaveLength(0)
  })

  it('altri errori arrivano a chi chiama', async () => {
    stubShare(async () => {
      throw new DOMException('no', 'NotAllowedError')
    })
    await expect(shareImage(blob, 'bere-settimana.png', 'x')).rejects.toThrow('no')
  })
})
