import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DayResult } from './stats'
import { ShareWeekButton } from './ShareWeekButton'

const shareWeek = vi.fn()
vi.mock('../share/shareWeek', () => ({ shareWeek: (...args: unknown[]) => shareWeek(...args) }))

const WEEK: DayResult[] = Array.from({ length: 7 }, (_, i) => ({ day: `2026-11-${String(7 + i).padStart(2, '0')}`, totalMl: 2000, goalMl: 2000, met: true }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('ShareWeekButton', () => {
  afterEach(() => shareWeek.mockReset())

  it('mentre prepara l’immagine il bottone è spento e lo dice', async () => {
    const pending = deferred<string>()
    shareWeek.mockReturnValue(pending.promise)
    render(<ShareWeekButton week={WEEK} currentStreak={4} units="ml" today="2026-11-13" />)
    await userEvent.click(screen.getByRole('button', { name: 'Condividi la settimana' }))
    const busy = await screen.findByRole('button', { name: "Preparo l'immagine…" })
    expect(busy).toBeDisabled()
    expect(shareWeek).toHaveBeenCalledWith(WEEK, 4, 'ml', '2026-11-13')
    pending.resolve('shared')
    expect(await screen.findByRole('button', { name: 'Condividi la settimana' })).toBeEnabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('se qualcosa va storto mostra l’errore', async () => {
    shareWeek.mockRejectedValue(new Error('canvas'))
    render(<ShareWeekButton week={WEEK} currentStreak={0} units="ml" today="2026-11-13" />)
    await userEvent.click(screen.getByRole('button', { name: 'Condividi la settimana' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Non sono riuscito a preparare l'immagine. Riprova.")
    expect(screen.getByRole('button', { name: 'Condividi la settimana' })).toBeEnabled()
  })

  it('se chi condivide annulla non succede niente', async () => {
    shareWeek.mockResolvedValue('cancelled')
    render(<ShareWeekButton week={WEEK} currentStreak={0} units="ml" today="2026-11-13" />)
    await userEvent.click(screen.getByRole('button', { name: 'Condividi la settimana' }))
    expect(await screen.findByRole('button', { name: 'Condividi la settimana' })).toBeEnabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('un errore sparisce al tentativo successivo', async () => {
    shareWeek.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce('downloaded')
    render(<ShareWeekButton week={WEEK} currentStreak={0} units="ml" today="2026-11-13" />)
    await userEvent.click(screen.getByRole('button', { name: 'Condividi la settimana' }))
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Condividi la settimana' }))
    await screen.findByRole('button', { name: 'Condividi la settimana' })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
