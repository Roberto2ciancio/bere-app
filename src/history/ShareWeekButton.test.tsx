import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DayResult } from './stats'
import { ShareWeekButton } from './ShareWeekButton'

const prepareWeek = vi.fn()
const shareWeekImage = vi.fn()
vi.mock('../share/shareWeek', () => ({
  prepareWeek: (...args: unknown[]) => prepareWeek(...args),
  shareWeekImage: (...args: unknown[]) => shareWeekImage(...args),
}))

const WEEK: DayResult[] = Array.from({ length: 7 }, (_, i) => ({ day: `2026-11-${String(7 + i).padStart(2, '0')}`, totalMl: 2000, goalMl: 2000, met: true }))
const PREPARED = { blob: new Blob(['png'], { type: 'image/png' }), title: 'La mia settimana su Bere' }
const LABEL = 'Condividi la settimana'
const BUSY = "Preparo l'immagine…"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/** Senza preparazione in anticipo (attesa lunghissima): si prepara al tocco. */
const LATE = 60_000

describe('ShareWeekButton', () => {
  afterEach(() => {
    prepareWeek.mockReset()
    shareWeekImage.mockReset()
  })

  it('l’immagine si prepara in anticipo e al tocco si condivide subito, senza ridisegnarla', async () => {
    prepareWeek.mockResolvedValue(PREPARED)
    shareWeekImage.mockResolvedValue('shared')
    render(<ShareWeekButton week={WEEK} currentStreak={4} units="ml" today="2026-11-13" prepareDelayMs={0} />)
    await waitFor(() => expect(prepareWeek).toHaveBeenCalledWith(WEEK, 4, 'ml', '2026-11-13'))
    // Il caricamento del modulo e il disegno finiscono in un attimo (finti).
    await new Promise((r) => setTimeout(r, 20))
    await userEvent.click(screen.getByRole('button', { name: LABEL }))
    expect(shareWeekImage).toHaveBeenCalledWith(PREPARED)
    expect(prepareWeek).toHaveBeenCalledTimes(1)
    // Già pronta: nessun «Preparo l'immagine…».
    expect(screen.queryByRole('button', { name: BUSY })).toBeNull()
  })

  it('se i dati cambiano, l’immagine pronta non vale più', async () => {
    prepareWeek.mockResolvedValue(PREPARED)
    shareWeekImage.mockResolvedValue('shared')
    const { rerender } = render(<ShareWeekButton week={WEEK} currentStreak={4} units="ml" today="2026-11-13" prepareDelayMs={0} />)
    await waitFor(() => expect(prepareWeek).toHaveBeenCalledTimes(1))
    const newer = { ...PREPARED, blob: new Blob(['nuova'], { type: 'image/png' }) }
    const second = deferred<typeof PREPARED>()
    prepareWeek.mockReturnValueOnce(second.promise)
    const changed = WEEK.map((d, i) => (i === 6 ? { ...d, totalMl: 2500 } : d))
    rerender(<ShareWeekButton week={changed} currentStreak={5} units="ml" today="2026-11-13" prepareDelayMs={LATE} />)
    await userEvent.click(screen.getByRole('button', { name: LABEL }))
    // Tocco prima che la nuova sia pronta: si aspetta quella nuova, non si usa la vecchia.
    expect(prepareWeek).toHaveBeenLastCalledWith(changed, 5, 'ml', '2026-11-13')
    expect(shareWeekImage).not.toHaveBeenCalled()
    second.resolve(newer)
    await waitFor(() => expect(shareWeekImage).toHaveBeenCalledWith(newer))
  })

  it('mentre prepara: aria-disabled e aria-busy, lo annuncia, ignora altri tocchi e tiene il focus', async () => {
    const pending = deferred<typeof PREPARED>()
    prepareWeek.mockReturnValue(pending.promise)
    shareWeekImage.mockResolvedValue('shared')
    render(<ShareWeekButton week={WEEK} currentStreak={4} units="ml" today="2026-11-13" prepareDelayMs={LATE} />)
    await userEvent.click(screen.getByRole('button', { name: LABEL }))
    const busy = await screen.findByRole('button', { name: BUSY })
    expect(busy).toHaveAttribute('aria-disabled', 'true')
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(busy).not.toBeDisabled()
    expect(busy).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(BUSY)
    await userEvent.click(busy)
    expect(prepareWeek).toHaveBeenCalledTimes(1)
    pending.resolve(PREPARED)
    const idle = await screen.findByRole('button', { name: LABEL })
    expect(idle).not.toHaveAttribute('aria-disabled')
    expect(shareWeekImage).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('se qualcosa va storto mostra l’errore, e al tocco dopo si riprova', async () => {
    prepareWeek.mockRejectedValueOnce(new Error('canvas')).mockResolvedValueOnce(PREPARED)
    shareWeekImage.mockResolvedValue('downloaded')
    render(<ShareWeekButton week={WEEK} currentStreak={0} units="ml" today="2026-11-13" prepareDelayMs={LATE} />)
    await userEvent.click(screen.getByRole('button', { name: LABEL }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Non sono riuscito a preparare l'immagine. Riprova.")
    await userEvent.click(screen.getByRole('button', { name: LABEL }))
    await waitFor(() => expect(shareWeekImage).toHaveBeenCalledWith(PREPARED))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('se chi condivide annulla non succede niente', async () => {
    prepareWeek.mockResolvedValue(PREPARED)
    shareWeekImage.mockResolvedValue('cancelled')
    render(<ShareWeekButton week={WEEK} currentStreak={0} units="ml" today="2026-11-13" prepareDelayMs={LATE} />)
    await userEvent.click(screen.getByRole('button', { name: LABEL }))
    await waitFor(() => expect(shareWeekImage).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: LABEL })).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
