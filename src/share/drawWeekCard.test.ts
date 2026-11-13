import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARD_HEIGHT, CARD_WIDTH, drawWeekCard, GLU_TIMEOUT_MS } from './drawWeekCard'
import type { WeekCardData } from './weekCard'

const DATA: WeekCardData = {
  title: 'La mia settimana su Bere',
  bars: ['L', 'M', 'M', 'G', 'V', 'S', 'Oggi'].map((label, i) => ({ label, ratio: i / 6, met: i % 2 === 0 })),
  metLine: '4 giorni su 7 a obiettivo',
  litersLine: '12,5 L bevuti',
  streakLine: 'Serie: 3 giorni',
  mood: 'tranquillo',
}

/** jsdom non ha il canvas: un contesto finto che registra testi e colori. */
function fakeCanvas() {
  const texts: string[] = []
  const fills: string[] = []
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: vi.fn(function (this: { fillStyle: string }) {
      fills.push(this.fillStyle)
    }),
    fillText: vi.fn((text: string) => texts.push(text)),
    measureText: vi.fn((text: string) => ({ width: text.length * 20 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(function (this: { fillStyle: string }) {
      fills.push(this.fillStyle)
    }),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  }
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
  vi.spyOn(canvas, 'toBlob').mockImplementation((cb, type) => cb(new Blob(['png'], { type })))
  return { canvas, ctx, texts, fills }
}

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

describe('drawWeekCard', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', FakeImage)
    URL.createObjectURL = vi.fn(() => 'blob:glu')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('disegna un PNG 1080×1350 con titolo, righe, giorni e indirizzo', async () => {
    const { canvas, ctx, texts } = fakeCanvas()
    const blob = await drawWeekCard(DATA, canvas)
    expect(blob.type).toBe('image/png')
    expect(canvas.width).toBe(CARD_WIDTH)
    expect(canvas.height).toBe(CARD_HEIGHT)
    expect([CARD_WIDTH, CARD_HEIGHT]).toEqual([1080, 1350])
    expect(texts).toEqual(
      expect.arrayContaining(['La mia settimana su Bere', '4 giorni su 7 a obiettivo', '12,5 L bevuti', 'Serie: 3 giorni', 'Oggi', 'G', 'Bere · roberto2ciancio.github.io/bere-app']),
    )
    // Glu c'è: l'immagine dell'SVG finisce sul canvas.
    expect(ctx.drawImage).toHaveBeenCalledTimes(1)
  })

  it('sempre nei colori chiari, anche col tema scuro', async () => {
    const { canvas, fills } = fakeCanvas()
    await drawWeekCard(DATA, canvas)
    expect(fills[0].toLowerCase()).toBe('#f2faff')
  })

  it('senza serie la riga non c’è', async () => {
    const { canvas, texts } = fakeCanvas()
    await drawWeekCard({ ...DATA, streakLine: null }, canvas)
    expect(texts.some((t) => t.startsWith('Serie'))).toBe(false)
  })

  it('se Glu non si carica, l’immagine si fa lo stesso', async () => {
    class BrokenImage extends FakeImage {
      override set src(_value: string) {
        queueMicrotask(() => this.onerror?.())
      }
    }
    vi.stubGlobal('Image', BrokenImage)
    const { canvas, ctx } = fakeCanvas()
    await expect(drawWeekCard(DATA, canvas)).resolves.toBeInstanceOf(Blob)
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })

  it('se Glu non risponde mai, dopo 3 secondi l’immagine si fa senza di lui', async () => {
    class SilentImage extends FakeImage {
      override set src(_value: string) {}
    }
    vi.stubGlobal('Image', SilentImage)
    vi.useFakeTimers()
    try {
      const { canvas, ctx } = fakeCanvas()
      const result = drawWeekCard(DATA, canvas)
      await vi.advanceTimersByTimeAsync(GLU_TIMEOUT_MS)
      await expect(result).resolves.toBeInstanceOf(Blob)
      expect(ctx.drawImage).not.toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:glu')
    } finally {
      vi.useRealTimers()
    }
  })

  it('se il canvas non dà il PNG, l’errore arriva a chi chiama', async () => {
    const { canvas } = fakeCanvas()
    vi.spyOn(canvas, 'toBlob').mockImplementation((cb) => cb(null))
    await expect(drawWeekCard(DATA, canvas)).rejects.toThrow()
  })
})
