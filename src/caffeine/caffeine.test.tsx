import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { addDays, localParts } from '../domain/time'
import { HomePage } from '../home/HomePage'
import { CAFFEINE_MG, summarizeCaffeine } from './caffeine'
import { pendingCaffeine } from './caffeineQueue'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
const today = () => localParts(new Date(), tz).date

function row(kind: string, date = today(), mg = 80) {
  return { user_id: 'u1', client_id: crypto.randomUUID(), kind, mg, taken_at: new Date().toISOString(), local_date: date }
}

function renderHome() {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

const redBull = () => screen.findByRole('button', { name: /red bull/i })
const coffee = () => screen.findByRole('button', { name: /caffè/i })

// Ogni tocco avviene oltre la soglia anti doppio tocco.
let clock = 1_800_000_000_000
function tapLater(button: HTMLElement) {
  clock += 1000
  vi.spyOn(Date, 'now').mockReturnValue(clock)
  fireEvent.click(button)
}

beforeEach(() => {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz, sound: 'none' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.tables.drinks = []
  fake.tables.caffeine_intakes = []
})

describe('summarizeCaffeine', () => {
  it('somma i milligrammi e conta ogni tipo', () => {
    const summary = summarizeCaffeine([
      { kind: 'redbull', mg: 80 },
      { kind: 'redbull', mg: 80 },
      { kind: 'coffee', mg: 80 },
    ])
    expect(summary).toEqual({ totalMg: 240, redBulls: 2, coffees: 1, monsters: 0, overLimit: false })
  })

  it('una Monster conta 160 mg', () => {
    expect(summarizeCaffeine([{ kind: 'monster', mg: CAFFEINE_MG.monster }])).toMatchObject({ totalMg: 160, monsters: 1 })
  })

  it('il limite si supera solo oltre 400 mg', () => {
    const entries = (n: number) => Array.from({ length: n }, () => ({ kind: 'coffee' as const, mg: 80 }))
    expect(summarizeCaffeine(entries(5)).overLimit).toBe(false)
    expect(summarizeCaffeine(entries(6)).overLimit).toBe(true)
  })
})

describe('caffeina in home', () => {
  it('mostra Red Bull, caffè e milligrammi di oggi', async () => {
    fake.tables.caffeine_intakes = [row('redbull'), row('redbull'), row('coffee')]
    renderHome()
    expect(await screen.findByRole('button', { name: 'Red Bull, 2 oggi. Aggiungi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Caffè, 1 oggi. Aggiungi' })).toBeInTheDocument()
    expect(screen.getByText('240 mg di caffeina su 400')).toBeInTheDocument()
  })

  it('non conta i giorni precedenti', async () => {
    fake.tables.caffeine_intakes = [row('redbull', addDays(today(), -1))]
    renderHome()
    expect(await screen.findByRole('button', { name: 'Red Bull, 0 oggi. Aggiungi' })).toBeInTheDocument()
    expect(screen.getByText('0 mg di caffeina su 400')).toBeInTheDocument()
  })

  it('una Red Bull si salva con 80 mg e non cambia acqua né conteggio caffè', async () => {
    renderHome()
    tapLater(await redBull())
    expect(await screen.findByRole('button', { name: 'Red Bull, 1 oggi. Aggiungi' })).toBeInTheDocument()
    await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(1))
    expect(fake.tables.caffeine_intakes[0]).toMatchObject({ user_id: 'u1', kind: 'redbull', mg: 80, local_date: today() })
    expect(fake.tables.drinks).toHaveLength(0)
    expect(screen.getByText('0 L')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Caffè, 0 oggi. Aggiungi' })).toBeInTheDocument()
  })

  it('un caffè si salva con 80 mg', async () => {
    renderHome()
    tapLater(await coffee())
    await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(1))
    expect(fake.tables.caffeine_intakes[0]).toMatchObject({ kind: 'coffee', mg: 80 })
  })

  it('il doppio tocco entro 400 ms ne registra una sola', async () => {
    renderHome()
    const button = await redBull()
    clock += 1000
    const now = vi.spyOn(Date, 'now').mockReturnValue(clock)
    fireEvent.click(button)
    now.mockReturnValue(clock + 399)
    fireEvent.click(button)
    await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(1))
  })

  it('senza rete conta subito e sincronizza una sola volta', async () => {
    fake.failures.upsert = 'Failed to fetch'
    renderHome()
    tapLater(await redBull())
    expect(await screen.findByRole('button', { name: 'Red Bull, 1 oggi. Aggiungi' })).toBeInTheDocument()
    await screen.findByText(/appena torna la rete/i)
    expect(pendingCaffeine('u1')).toHaveLength(1)
    fake.failures.upsert = null
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(1))
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(fake.tables.caffeine_intakes).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Red Bull, 1 oggi. Aggiungi' })).toBeInTheDocument()
  })

  it('riaperta senza rete mostra quanto già salvato oggi', async () => {
    fake.tables.caffeine_intakes = [row('redbull')]
    const first = renderHome()
    await screen.findByRole('button', { name: 'Red Bull, 1 oggi. Aggiungi' })
    first.unmount()
    fake.failures.select = 'Failed to fetch'
    renderHome()
    expect(await screen.findByRole('button', { name: 'Red Bull, 1 oggi. Aggiungi' })).toBeInTheDocument()
  })

  it('annulla toglie solo l\'ultima caffeina e lascia acqua e altre voci', async () => {
    fake.tables.caffeine_intakes = [{ ...row('coffee'), taken_at: '2026-01-01T08:00:00Z' }, { ...row('redbull'), taken_at: '2026-01-01T09:00:00Z' }]
    renderHome()
    fireEvent.click(await screen.findByRole('button', { name: 'Annulla caffeina' }))
    expect(await screen.findByRole('button', { name: 'Red Bull, 0 oggi. Aggiungi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Caffè, 1 oggi. Aggiungi' })).toBeInTheDocument()
    await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(1))
  })

  it('senza caffeina non propone di annullare', async () => {
    renderHome()
    await redBull()
    expect(screen.queryByRole('button', { name: 'Annulla caffeina' })).not.toBeInTheDocument()
  })

  describe('Monster', () => {
    const monster = () => screen.findByRole('button', { name: /monster/i })

    it('si salva con 160 mg e parte la punizione che elogia la Red Bull', async () => {
      renderHome()
      tapLater(await monster())
      const dialog = await screen.findByRole('alertdialog')
      expect(dialog).toHaveTextContent(/red bull/i)
      expect(dialog).toHaveTextContent(/un'ora/i)
      await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(1))
      expect(fake.tables.caffeine_intakes[0]).toMatchObject({ kind: 'monster', mg: 160 })
    })

    it('non si può chiudere per i primi 3 secondi', async () => {
      renderHome()
      const button = await monster()
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      try {
        tapLater(button)
        const forgive = screen.getByRole('button', { name: /perdono/i })
        expect(forgive).toBeDisabled()
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2999)
        })
        expect(forgive).toBeDisabled()
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1)
        })
        expect(forgive).toBeEnabled()
        fireEvent.click(forgive)
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })

    it('Red Bull e caffè non fanno partire la punizione', async () => {
      renderHome()
      tapLater(await redBull())
      tapLater(await coffee())
      await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(2))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('il doppio tocco non la registra due volte', async () => {
      renderHome()
      const button = await monster()
      clock += 1000
      const now = vi.spyOn(Date, 'now').mockReturnValue(clock)
      fireEvent.click(button)
      now.mockReturnValue(clock + 399)
      fireEvent.click(button)
      await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(1))
    })
  })

  it('oltre 400 mg lo segnala', async () => {
    fake.tables.caffeine_intakes = Array.from({ length: 6 }, () => row('redbull'))
    renderHome()
    expect(await screen.findByText('480 mg di caffeina: oltre i 400 di riferimento')).toBeInTheDocument()
  })
})
